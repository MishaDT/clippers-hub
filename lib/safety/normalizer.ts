// Anti-evasion text normalization. Most filter bypasses are typographic: spaced-out letters
// (с л о в о), separators (с.л.о.в.о), leet digits (п1зда), homoglyph swaps (хуй -> xyй),
// repeats (хуууй). We produce canonical forms so detectors match the INTENT, not the exact
// bytes. Pure module (no side effects) so it can be unit tested directly.
//
// Matching is done with gap-tolerant, word-boundary regexes (see detectors.ts) rather than
// naive substring search, so a short root like "еб" never false-matches "хлеб".

const LEET_TO_CYRILLIC: Record<string, string> = {
  "0": "о", "1": "и", "3": "з", "4": "ч", "5": "с", "6": "б", "7": "т", "8": "в", "9": "я",
  "@": "а", "$": "с"
};
// Classic Cyrillic/Latin visual confusables (Latin -> Cyrillic).
const LATIN_TO_CYRILLIC: Record<string, string> = {
  a: "а", c: "с", e: "е", o: "о", p: "р", x: "х", y: "у", k: "к", m: "м", t: "т", b: "ь", h: "н"
};

function base(raw: string) {
  return (raw || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[​-‏‪-‮⁠﻿]/g, "") // zero-width / bidi controls
    .slice(0, 8000);
}

export type NormalizedText = {
  /** NFKC + lowercase + ё→е, 3+ repeats trimmed to 2, single-spaced. For phrases & EN terms. */
  text: string;
  /** Leet + Latin-homoglyph → Cyrillic, every repeat run collapsed to one char, separators
   *  kept (so gap-tolerant regexes can still see them). For Russian term detection. */
  deob: string;
};

export function normalizeText(raw: string): NormalizedText {
  const b = base(raw);

  const text = b.replace(/(.)\1{2,}/g, "$1$1").replace(/[ \t]+/g, " ").trim();

  const deob = b
    .replace(/[0-9@$]/g, (ch) => LEET_TO_CYRILLIC[ch] ?? ch)
    .replace(/[a-z]/g, (ch) => LATIN_TO_CYRILLIC[ch] ?? ch)
    .replace(/(.)\1+/g, "$1")
    .replace(/[ \t]+/g, " ")
    .trim();

  return { text, deob };
}
