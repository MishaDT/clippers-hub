export type PolicyDecision = {
  action: "ALLOW" | "REVIEW" | "BLOCK";
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
  return { action: "ALLOW", category: "NONE", severity: "LOW", matches: [] };
}
