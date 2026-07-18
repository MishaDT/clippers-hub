// Public operator details are supplied through server-only environment variables.
// Never invent these values: they must match the actual person or legal entity.
export const LEGAL = {
  brand: "ReelPay",
  site: "clippers-hub.vercel.app",
  contact: "support@reelpay.app",
  updated: "18 июля 2026",
  operatorName: process.env.LEGAL_OPERATOR_NAME?.trim() || "",
  operatorId: process.env.LEGAL_OPERATOR_ID?.trim() || "",
  operatorAddress: process.env.LEGAL_OPERATOR_ADDRESS?.trim() || ""
};

export const hasPublicOperatorDetails = Boolean(
  LEGAL.operatorName && LEGAL.operatorId && LEGAL.operatorAddress
);

export const LEAD_CONSENT_VERSION = "2026-07-18";

/**
 * Единая формулировка для упоминаний продуктов Meta в российской версии сервиса.
 * Экстремистской признана компания Meta Platforms Inc., а не сами приложения.
 */
export const META_PRODUCTS_NOTICE =
  "Instagram и Facebook — продукты компании Meta Platforms Inc., признанной экстремистской организацией; её деятельность по реализации этих продуктов запрещена на территории Российской Федерации.";
