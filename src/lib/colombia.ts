/**
 * Regla fija del negocio (decisión del dueño): el bot NUNCA responde ni escribe a números de Colombia.
 * Los clientes que viven en Colombia los atiende otro equipo de la empresa.
 *
 * Vale para todo lo que sale por WhatsApp (respuestas, plantillas, recordatorios, seguimientos) y lo
 * que entra de esos números se ignora. Cubre el teléfono (+57 seguido de 10 dígitos, o 9 en números
 * viejos) y los usuarios de WhatsApp sin teléfono visible, que llegan como «CO.<id>».
 */

/** Usuario de WhatsApp con nombre de usuario (BSUID): «CO.2588780288309047». */
const ES_BSUID = /^[A-Za-z]{2}\.[A-Za-z0-9]{1,128}$/;

export function esNumeroColombiano(id: string | undefined | null): boolean {
  const t = String(id ?? "").trim();
  if (!t) return false;
  if (ES_BSUID.test(t)) return /^co\./i.test(t);
  return /^57\d{9,10}$/.test(t.replace(/\D/g, ""));
}

/**
 * Por Zernio llegan varias plataformas: la regla solo aplica a WhatsApp (en Instagram/Messenger el id
 * es un número interno de Meta, no un teléfono). Sin plataforma conocida se aplica igual, por prudencia.
 */
export function esColombianoEnZernio(id: string | undefined | null, platform: string | null | undefined): boolean {
  const p = (platform ?? "").toLowerCase();
  if (p && p !== "whatsapp") return false;
  return esNumeroColombiano(id);
}
