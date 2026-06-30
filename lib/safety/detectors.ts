// Detection layer. Pure module (no server-only / DB) so it is fully unit-testable. Each
// detector returns typed hits with a weight; the engine (engine.ts) sums them into a risk
// score. Matching is gap-tolerant and word-boundary-aware to resist evasion without
// false-matching clean words.
import { findPhoneNumbersInText } from "libphonenumber-js";
import type { NormalizedText } from "./normalizer.ts";
import { PROFANITY_RU } from "./dictionaries/profanity-ru.ts";
import { PROFANITY_EN } from "./dictionaries/profanity-en.ts";
import { INSULTS_RU } from "./dictionaries/insults-ru.ts";
import { DEAL_LEAK_RU } from "./dictionaries/deal-leak-ru.ts";
import { CONTACT_PHRASES_RU } from "./dictionaries/contact-phrases-ru.ts";
import { WHITELIST_RU } from "./dictionaries/whitelist-ru.ts";

export type Hit = { code: string; weight: number; sample: string };

const GAP = "[\\s._\\-*=]{0,2}";
const RU_PREFIX = "(?:за|по|на|от|до|вы|об|у|пере|при|раз|съ|подъ|объ|недо|пре|про|разъ)?";
const WHITELIST = new Set(WHITELIST_RU);

function escapeRe(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function gapped(term: string) {
  return term.split("").map(escapeRe).join(GAP);
}

function wordAround(text: string, index: number) {
  let start = index;
  let end = index;
  while (start > 0 && /[а-яёa-z]/i.test(text[start - 1])) start -= 1;
  while (end < text.length && /[а-яёa-z]/i.test(text[end])) end += 1;
  return text.slice(start, end);
}

// Match a list of Cyrillic ROOTS on the deobfuscated text: optional prefix, gap-tolerant,
// any suffix, leading word boundary. Suppresses hits whose surrounding word is whitelisted.
function matchRuRoots(deob: string, roots: string[], code: string, weight: number): Hit[] {
  const hits: Hit[] = [];
  const seen = new Set<string>();
  for (const root of roots) {
    const re = new RegExp(`(?<![а-яё])${RU_PREFIX}${gapped(root)}[а-яё]*`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(deob))) {
      const word = wordAround(deob, m.index);
      if (WHITELIST.has(word)) continue;
      const key = `${code}:${word || m[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({ code, weight, sample: (word || m[0]).slice(0, 40) });
      if (m.index === re.lastIndex) re.lastIndex += 1;
    }
  }
  return hits;
}

function matchEnRoots(text: string, roots: string[], code: string, weight: number): Hit[] {
  const hits: Hit[] = [];
  for (const root of roots) {
    const re = new RegExp(`(?<![a-z])${gapped(root)}[a-z]*`, "i");
    const m = re.exec(text);
    if (m) hits.push({ code, weight, sample: m[0].slice(0, 40) });
  }
  return hits;
}

// Match natural-language phrases on the normalized text, tolerant of whitespace runs.
function matchPhrases(text: string, phrases: string[], code: string, weight: number): Hit[] {
  for (const phrase of phrases) {
    const re = new RegExp(phrase.split(/\s+/).map(escapeRe).join("\\s+"), "i");
    const m = re.exec(text);
    if (m) return [{ code, weight, sample: m[0].slice(0, 60) }];
  }
  return [];
}

export function detectProfanity(n: NormalizedText): Hit[] {
  const ru = matchRuRoots(n.deob, PROFANITY_RU, "PROFANITY", 35);
  const en = matchEnRoots(n.text, PROFANITY_EN, "PROFANITY", 35);
  return ru.length ? ru : en;
}

export function detectInsults(n: NormalizedText): Hit[] {
  return matchRuRoots(n.deob, INSULTS_RU, "INSULT", 30);
}

export function detectDealLeak(n: NormalizedText): Hit[] {
  return matchPhrases(n.text, DEAL_LEAK_RU, "DEAL_LEAK", 80);
}

export function detectContactPhrases(n: NormalizedText): Hit[] {
  return matchPhrases(n.text, CONTACT_PHRASES_RU, "CONTACT_PHRASE", 55);
}

const MESSENGER_RE = /(?<![а-яёa-z])(?:телеграм{1,2}|тел[еэ]га|telegram|вотс?ап|ватс[ао]п|whats?app|вайбер|viber)(?![а-яёa-z])/i;
// A solicitation verb near a messenger name turns a passing mention into a clear "let's move
// off-platform" signal (e.g. "пиши в телеграм", "перейдём в вотсап", "добавь в вайбер").
const SOLICIT_RE = /(пиш|напиш|перейд|добав|скин|кин|спишем|свяжем|обсуд|жду\s+(?:теб|вас)|вот\s+мой|мой\s+ник|давай\s+в|найди\s+мен)/i;
const TG_HANDLE_RE = /(?<![a-z0-9._/])@[a-z0-9_]{4,32}(?![a-z0-9_])/i;
const TG_LINK_RE = /(?:t\.me|telegram\.me|telegram\.dog)\/[a-z0-9_+/-]+/i;
const WA_LINK_RE = /(?:wa\.me|whatsapp\.com|api\.whatsapp\.com)\/[^\s]+|whatsapp:\/\/|viber:\/\//i;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const URL_RE = /https?:\/\/[^\s<>"']+|(?<![@\w])(?:[a-z0-9-]+\.)+[a-z]{2,}\/[^\s<>"']*/i;
const SHORTENERS = /(?:bit\.ly|clck\.ru|vk\.cc|t\.co|goo\.gl|tinyurl\.com|is\.gd|cutt\.ly|surl\.li|u\.to|qps\.ru|gg\.gg)/i;

// Structural contact / PII detection on the RAW text (digits and @ intact).
export function detectContacts(raw: string, n: NormalizedText): Hit[] {
  const hits: Hit[] = [];
  const messenger = n.deob.match(MESSENGER_RE);
  if (messenger) {
    const solicited = SOLICIT_RE.test(n.text);
    hits.push(solicited
      ? { code: "CONTACT_SOLICIT", weight: 55, sample: messenger[0] }
      : { code: "MESSENGER_NAME", weight: 40, sample: messenger[0] });
  }

  let m: RegExpMatchArray | null;
  if ((m = raw.match(TG_LINK_RE))) hits.push({ code: "TELEGRAM_LINK", weight: 55, sample: m[0].slice(0, 60) });
  else if ((m = raw.match(TG_HANDLE_RE))) hits.push({ code: "TELEGRAM_HANDLE", weight: 55, sample: m[0].slice(0, 40) });
  if ((m = raw.match(WA_LINK_RE))) hits.push({ code: "WHATSAPP_LINK", weight: 55, sample: m[0].slice(0, 60) });
  if ((m = raw.match(EMAIL_RE))) hits.push({ code: "EMAIL", weight: 50, sample: m[0].slice(0, 60) });

  try {
    const phones = findPhoneNumbersInText(raw, "RU");
    if (phones.length) hits.push({ code: "CONTACT_PHONE", weight: 55, sample: phones[0].number.number });
  } catch {
    // libphonenumber can throw on pathological input — fall back to nothing.
  }

  const url = raw.match(URL_RE);
  if (url) {
    if (SHORTENERS.test(url[0])) hits.push({ code: "SHORTENER_URL", weight: 50, sample: url[0].slice(0, 80) });
    else hits.push({ code: "EXTERNAL_URL", weight: 30, sample: url[0].slice(0, 80) });
  }
  return hits;
}
