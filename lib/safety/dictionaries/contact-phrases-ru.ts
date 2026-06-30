// Specific solicitations to move to private contact, that do NOT themselves name a messenger
// (messenger names + "verb near messenger" are handled structurally in detectors.ts, and
// phones/emails/handles/links are detected too). Kept specific to avoid false positives on
// ordinary phrases. HOW TO EXTEND: add a lowercase phrase.
export const CONTACT_PHRASES_RU: string[] = [
  "пиши в лс", "напиши в лс", "пиши в личку", "напиши в личку", "в личку напиши", "скинь в лс",
  "пиши в директ", "напиши в директ", "пиши в дм", "напиши в дм",
  "скинь номер", "дай номер", "оставь номер", "скинь телефон", "дай телефон", "мой номер",
  "скинь свой номер", "скинь контакт", "дай контакт", "обмен контактами", "обменяемся контактами",
  "скинь ватсап", "скинь вотсап", "скинь телеграм", "кинь телеграм", "дай телеграм"
];
