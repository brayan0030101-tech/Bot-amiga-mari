// member/config.local.ts — generado por `forja init`. Edítalo cuando quieras.
// NUNCA se sobrescribe al actualizar el bot.

export const memberConfig = {
  businessName: "PENDIENTE",
  botName: "PENDIENTE",
  language: "es" as "es" | "en" | "pt",
  tier: "pro" as "free" | "pro",
  timezone: "Europe/Madrid",
  // Moneda con la que el bot habla de precios ($ | € | R$). El bot la lee de
  // aquí si no la cambiaste en el panel (setting bot_currency manda si existe).
  currency: "$",
  contactEmail: "",
};
export type MemberConfig = typeof memberConfig;

export const businessConfig = {
  hours: "Por definir con la asesora",  // PENDIENTE
  services: [] as { name: string; price: number }[],
  location: "",
  paymentMethods: [] as string[],
  contactPhone: "",
  // PENDIENTE: llenar con los datos reales de la asesora (qué hace, qué ofrece, tono,
  // preguntas frecuentes, reglas de escalación). No copiar datos de otro negocio.
  customFields: {} as Record<string, string>,
};

import type { CommentFunnel } from "../src/channels/comment-funnel";
export const commentFunnels: CommentFunnel[] = [];

export const catalog: { name: string; price: number; description?: string; sku?: string }[] = [];
