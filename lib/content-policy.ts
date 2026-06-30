export type PolicyDecision = {
  // ALLOW: clean. FLAG: delivered, but a moderation case is recorded (contact-info leak,
  // profanity). REVIEW: held for a moderator. BLOCK: rejected outright.
  action: "ALLOW" | "FLAG" | "REVIEW" | "BLOCK";
  category: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  matches: string[];
};

const hardRules: Array<[string, RegExp]> = [
  ["DRUGS", /(купить|продам|доставка).{0,24}(наркот|кокаин|героин|мефедрон|амфетамин|закладк)/i],
  ["WEAPONS", /(купить|продам|доставка).{0,24}(оружие|пистолет|автомат|боеприпас|взрывчат)/i],
  ["EXTREMISM", /(вербовк|теракт|террорист|экстремист).{0,40}(вступ|поддерж|организ)/i],
  ["EXPLOITATION", /(детск|несовершеннолет).{0,20}(порно|секс|интим)/i],
  ["MALWARE", /(stealer|keylogger|ransomware|вирус).{0,30}(скачать|продам|купить)/i],
  ["FRAUD", /(фишинг|обнал|кардинг|украденн.*карт|гарантированн.*доход)/i]
];

const reviewRules: Array<[string, RegExp]> = [
  ["GAMBLING", /(казино|casino|betting|букмекер|ставк[аи].{0,12}(спорт|матч)|слот[ы]?)/i],
  ["DRUGS", /(наркот|кокаин|героин|мефедрон|амфетамин|закладк)/i],
  ["WEAPONS", /(оружие|пистолет|автомат|боеприпас|взрывчат)/i],
  ["HATE", /(ненавист|уничтожить.{0,20}(наци|расу|народ)|расов.*превосход)/i],
  ["ADULT", /(порно|эротик|интим.*услуг|onlyfans)/i],
  ["ILLEGAL_SERVICES", /(поддельн.*документ|купить.*паспорт|взлом.*аккаунт)/i]
];

// Off-platform contact / deal-leak signals. Scanned on the RAW text (digits intact, unlike
// the leet-normalised text) and never inside SUPPORT, where sharing a phone/email with staff
// is legitimate. These FLAG (deliver + record), they never block.
const contactRules: Array<[string, RegExp]> = [
  ["CONTACT_MESSENGER", /(?<![а-яёa-z])(?:телеграм{1,2}|тел[еэ]га|telegram|вотс?ап|ватс[ао]п|whats?app|вайбер|viber|тг|tg)(?![а-яёa-z])/i],
  ["CONTACT_OFFPLATFORM", /(?:пиш[иуте]+|перейд[еёи]|спишемся|свяжемся|номер|почт)\s*(?:мне|тебе|сюда|в\s+)?\s*(?:личк|лс\b|директ|телег|вотсап|ватсап|whats?app|почт|майл|mail)/i],
  ["CONTACT_TG_HANDLE", /(?:t\.me\/|@)[a-z0-9_]{4,32}/i],
  ["CONTACT_EMAIL", /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i],
  ["CONTACT_PHONE", /(?:\+?\d[\s\-().]?){10,}\d/]
];

// Strong profanity roots, matched after leet-normalisation. FLAG only — never blocks delivery.
const profanityPattern = /(?<![а-яёa-z])(?:бля|[еёе]б[аиоуёл]|[уy]?ху[йяюеё]|пизд|пид[оа]?р|муд[аио]к|залуп|го[нд]дон|долбо[её]б|дроч|шлюх|ублюд)/i;

export function normalizePolicyText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[0@]/g, "о")
    .replace(/[1!]/g, "и")
    .replace(/3/g, "з")
    .replace(/4/g, "ч")
    .replace(/[5$]/g, "с")
    .replace(/6/g, "б")
    .replace(/7/g, "т")
    .replace(/[^a-zа-яё0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function scanContent(value: string, context: "PUBLIC" | "CHAT" | "SUPPORT" = "PUBLIC"): PolicyDecision {
  const raw = value.normalize("NFKC").toLowerCase().slice(0, 5000);
  const text = normalizePolicyText(value).slice(0, 5000);
  for (const [category, pattern] of hardRules) {
    const match = text.match(pattern);
    if (match) {
      return {
        action: context === "SUPPORT" ? "REVIEW" : "BLOCK",
        category,
        severity: "CRITICAL",
        matches: [match[0].slice(0, 100)]
      };
    }
  }
  for (const [category, pattern] of reviewRules) {
    const match = text.match(pattern);
    if (match) return { action: "REVIEW", category, severity: "HIGH", matches: [match[0].slice(0, 100)] };
  }
  if (context !== "SUPPORT") {
    for (const [category, pattern] of contactRules) {
      const match = raw.match(pattern);
      if (match) return { action: "FLAG", category, severity: "MEDIUM", matches: [match[0].slice(0, 100)] };
    }
  }
  const profane = text.match(profanityPattern);
  if (profane) return { action: "FLAG", category: "PROFANITY", severity: "LOW", matches: [profane[0].slice(0, 40)] };
  return { action: "ALLOW", category: "NONE", severity: "LOW", matches: [] };
}
