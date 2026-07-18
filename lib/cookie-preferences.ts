export const CONSENT_COOKIE = "rp_consent";
export const CONSENT_NECESSARY = "necessary";
export const CONSENT_ANALYTICS = "analytics";

export function analyticsAllowed(value: string | null | undefined) {
  return value === CONSENT_ANALYTICS || value === "all";
}
