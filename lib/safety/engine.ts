// Risk-scoring moderation engine. Combines the hard illegal rules, the review-tier topic
// rules, and the detector layer (profanity, insults, contacts, deal-leak) into a single
// decision with a numeric risk score and explainable flags. Pure + synchronous in `evaluate`
// (unit-testable); `checkMessagePolicy` adds optional async URL-reputation lookups.
import { normalizeText } from "./normalizer.ts";
import {
  detectProfanity, detectInsults, detectDealLeak, detectContactPhrases, detectContacts, type Hit
} from "./detectors.ts";
import { checkUrlReputation } from "./providers/url-reputation.ts";

export type SafetyContext = "PUBLIC" | "CHAT" | "SUPPORT";
export type SafetyRole = "user" | "moderator" | "admin";
export type SafetyAction = "allow" | "flag" | "review" | "block";

export type PolicyResult = {
  allowed: boolean;
  action: SafetyAction;
  riskScore: number;
  cleanedText: string;
  flags: string[];
  reasons: string[];
};

// Topic rules run on the leet-resistant deobfuscated text. Hard rules block (or review in
// support); review rules send to a moderator.
const HARD_RULES: Array<[string, RegExp]> = [
  ["DRUGS", /(купить|продам|доставка|закладк).{0,24}(наркот|кокаин|героин|мефедрон|амфетамин|закладк|меф|гашиш|шишк)/i],
  ["WEAPONS", /(купить|продам|доставка).{0,24}(оружие|пистолет|автомат|боеприпас|взрывчат|ствол\b)/i],
  ["EXTREMISM", /(вербовк|теракт|террорист|экстремист).{0,40}(вступ|поддерж|организ)/i],
  ["EXPLOITATION", /(детск|несовершеннолет).{0,20}(порно|секс|интим)/i],
  ["MALWARE", /(stealer|keylogger|ransomware|вирус|ботнет).{0,30}(скачать|продам|купить|аренд)/i],
  ["FRAUD", /(фишинг|обнал|кардинг|украденн.{0,10}карт|гарантированн.{0,10}доход|схем.{0,10}заработк.{0,20}гарант)/i]
];
const REVIEW_RULES: Array<[string, RegExp]> = [
  ["GAMBLING", /(казино|casino|букмекер|ставк[аи].{0,12}(спорт|матч)|онлайн.{0,6}слот)/i],
  ["DRUGS", /(наркот|кокаин|героин|мефедрон|амфетамин|закладк|гашиш|шишк[аи])/i],
  ["WEAPONS", /(оружие|пистолет|автомат\b|боеприпас|взрывчат)/i],
  ["HATE", /(ненавист.{0,20}(наци|расу|народ)|уничтожить.{0,20}(наци|расу|народ)|расов.{0,6}превосход)/i],
  ["ADULT", /(порнограф|интим.{0,6}услуг|onlyfans|вебкам)/i],
  ["ILLEGAL_SERVICES", /(поддельн.{0,10}документ|купить.{0,10}паспорт|взлом.{0,10}(аккаунт|почт|стран))/i]
];

const REASONS: Record<string, string> = {
  DRUGS: "Запрещённые вещества",
  WEAPONS: "Оружие",
  EXTREMISM: "Экстремизм",
  EXPLOITATION: "Эксплуатация несовершеннолетних",
  MALWARE: "Вредоносное ПО",
  FRAUD: "Мошенничество",
  GAMBLING: "Азартные игры",
  HATE: "Разжигание ненависти",
  ADULT: "Контент 18+",
  ILLEGAL_SERVICES: "Незаконные услуги",
  PROFANITY: "Нецензурная лексика",
  INSULT: "Оскорбление",
  DEAL_LEAK: "Попытка увести сделку с площадки",
  CONTACT_PHRASE: "Призыв перейти в личные сообщения",
  CONTACT_SOLICIT: "Призыв перейти в сторонний мессенджер",
  MESSENGER_NAME: "Упоминание стороннего мессенджера",
  TELEGRAM_LINK: "Ссылка на Telegram",
  TELEGRAM_HANDLE: "Telegram-ник",
  WHATSAPP_LINK: "Ссылка на WhatsApp/Viber",
  EMAIL: "Электронная почта",
  CONTACT_PHONE: "Номер телефона",
  EXTERNAL_URL: "Внешняя ссылка",
  SHORTENER_URL: "Сокращённая ссылка",
  MALWARE_URL: "Ссылка на вредоносный ресурс",
  PHISHING_URL: "Фишинговая ссылка"
};

function scoreToAction(score: number): SafetyAction {
  if (score >= 80) return "block";
  if (score >= 55) return "review";
  if (score >= 30) return "flag";
  return "allow";
}

function decide(hits: Hit[], forced?: SafetyAction): PolicyResult {
  // Sum distinct categories (a category counts once at its weight).
  const byCode = new Map<string, Hit>();
  for (const h of hits) if (!byCode.has(h.code) || byCode.get(h.code)!.weight < h.weight) byCode.set(h.code, h);
  const distinct = [...byCode.values()];
  const riskScore = Math.min(100, distinct.reduce((sum, h) => sum + h.weight, 0));
  const action = forced ?? scoreToAction(riskScore);
  const flags = distinct.map((h) => h.code);
  const reasons = [...new Set(flags.map((code) => REASONS[code] || code))];
  return { allowed: action === "allow" || action === "flag", action, riskScore, cleanedText: "", flags, reasons };
}

export function evaluate(text: string, context: SafetyContext = "PUBLIC"): PolicyResult {
  const n = normalizeText(text);

  for (const [code, re] of HARD_RULES) {
    if (re.test(n.deob) || re.test(n.text)) {
      const forced: SafetyAction = context === "SUPPORT" ? "review" : "block";
      const r = decide([{ code, weight: 100, sample: code }], forced);
      r.cleanedText = n.text;
      return r;
    }
  }

  const hits: Hit[] = [];
  for (const [code, re] of REVIEW_RULES) {
    if (re.test(n.deob) || re.test(n.text)) hits.push({ code, weight: 75, sample: code });
  }
  if (context !== "SUPPORT") {
    hits.push(...detectDealLeak(n), ...detectContactPhrases(n), ...detectContacts(text, n));
  }
  hits.push(...detectProfanity(n), ...detectInsults(n));

  const result = decide(hits);
  result.cleanedText = n.text;
  return result;
}

function applyRole(result: PolicyResult, role: SafetyRole = "user"): PolicyResult {
  // Moderators/admins are never hard-stopped, but their flags are still recorded.
  if ((role === "admin" || role === "moderator") && (result.action === "block" || result.action === "review")) {
    return { ...result, action: result.flags.length ? "flag" : "allow", allowed: true };
  }
  return result;
}

export async function checkMessagePolicy(input: {
  text: string;
  context?: SafetyContext;
  role?: SafetyRole;
}): Promise<PolicyResult> {
  const base = evaluate(input.text, input.context ?? "PUBLIC");

  // URL reputation is only worth a network call when we're not already blocking and there
  // could be a link to check. Fail-open: a provider error never changes the base decision.
  if (base.action !== "block" && /https?:\/\/|\b[a-z0-9-]+\.[a-z]{2,}\//i.test(input.text)) {
    try {
      const rep = await checkUrlReputation(input.text);
      if (rep.malicious) {
        const escalated = decide(
          [...base.flags.map((code) => ({ code, weight: 100, sample: code })), { code: rep.code, weight: 100, sample: rep.sample }],
          "block"
        );
        escalated.cleanedText = base.cleanedText;
        return applyRole(escalated, input.role);
      }
    } catch {
      // ignore — keep base decision
    }
  }
  return applyRole(base, input.role);
}
