/**
 * ¿Por qué canal escribe un cliente? En este bot WhatsApp entra por Zernio (channel = "zernio"), igual que Instagram:
 * lo único que los distingue es la plataforma que Zernio anotó al recibir el mensaje (tabla `zernio_ctx`) o, si no se
 * tiene a mano, el propio identificador: un teléfono son solo dígitos (hasta 15 según la norma internacional) y los
 * identificadores de Instagram/Messenger son números internos más largos.
 */
export type NombreCanal = "WhatsApp" | "Instagram" | "Telegram" | string;

const SOLO_DIGITOS = /^\+?\d{10,15}$/; // con prefijo de país un teléfono real tiene al menos 10 dígitos

export function esWhatsApp(channel: string, channelUserId: string, platform?: string | null): boolean {
  if (channel === "ycloud" || channel === "whatsapp" || channel === "twilio") return true;
  if (channel !== "zernio") return false;
  const p = (platform ?? "").toLowerCase();
  if (p) return p === "whatsapp";
  return SOLO_DIGITOS.test(String(channelUserId ?? "").trim());
}

export function nombreCanal(channel: string, channelUserId: string, platform?: string | null): NombreCanal {
  if (esWhatsApp(channel, channelUserId, platform)) return "WhatsApp";
  if (channel === "zernio") {
    const p = (platform ?? "").toLowerCase();
    return p === "facebook" || p === "messenger" ? "Messenger" : p === "telegram" ? "Telegram" : "Instagram";
  }
  if (channel === "instagram") return "Instagram";
  if (channel === "telegram") return "Telegram";
  return channel;
}

/** Canal a partir del id de una conversación («zernio:34600000011», «ycloud:34…»). «Otro» si no se reconoce. */
export function canalDeConvId(convId: string): NombreCanal {
  const i = convId.indexOf(":");
  if (i < 0) return "Otro";
  const ch = convId.slice(0, i);
  const n = nombreCanal(ch, convId.slice(i + 1));
  return n === ch ? "Otro" : n;
}
