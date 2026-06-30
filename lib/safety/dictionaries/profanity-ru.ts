// Russian profanity ROOTS. Each entry is matched with an optional common prefix (за-, по-,
// на-, …), gap tolerance between letters, and any trailing suffix — so one root covers a whole
// family (еб → ебать, заебал, выебывается). Matching is word-boundary-aware (see detectors.ts),
// so short roots don't false-match clean words; add genuine clean words to whitelist-ru.ts.
//
// HOW TO EXTEND: append the bare root, lowercase, Cyrillic, no spaces. Keep roots ≥3 chars.
export const PROFANITY_RU: string[] = [
  "хуй", "хуе", "хуё", "хуя", "хуи", "хую", "хуйн", "похуй", "нахуй", "нихуя", "охуе", "хуев",
  "пизд", "пезд", "опизд", "распизд",
  "еб", "ёб", "выеб", "заеб", "наеб", "поеб", "уеб", "отъеб", "разъеб", "съеб", "доеб", "проеб", "ебан", "ебал", "ебуч", "ёбан",
  "бля", "блят", "бляд",
  "муд", "мудак", "мудил", "мудозвон",
  "залуп", "гандон", "гондон",
  "пидор", "пидар", "пидрес", "пидрил",
  "долбоеб", "долбоёб", "далбаеб",
  "дроч", "шлюх", "ублюд", "выблядок", "мраз", "сволоч",
  "хер", "херн", "херов", "херас",
  "чмо", "чмош", "гнид", "залупа",
  "ссанин", "обоссан", "обосрат", "насрат", "сран", "говн", "говён",
  "манда", "мандавошк", "ебланд", "еблан", "ебло", "уебок", "уёбок", "уебан"
];
