/**
 * Red de seguridad de la videollamada: si agendarCita reservó de verdad en
 * Cal.com, el cliente SIEMPRE recibe la confirmación con el enlace, aunque el
 * modelo cierre el turno sin escribir nada (pasó en vivo en el bot de referencia:
 * llegó el correo de Cal.com pero el cliente no recibió ningún mensaje) o se
 * olvide del enlace.
 */

export interface DatosConfirmacion {
  /** Zona horaria de la agenda (la del bot). */
  tz: string;
  /** Nombre de la asesora con quien es la llamada. */
  asesora?: string;
}

/** «hora de España» para Madrid; si no, «hora de <ciudad>». */
export function etiquetaZona(tz: string): string {
  if (tz === "Europe/Madrid") return "hora de España";
  return `hora de ${(tz.split("/").pop() || tz).replace(/_/g, " ")}`;
}

function cuando(iso: string | undefined, tz: string): string | null {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return null;
  const fmt = new Intl.DateTimeFormat("es-ES", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return `el ${p.weekday} ${p.day} de ${p.month} a las ${p.hour}:${p.minute}`;
}

/** ¿Se reservó una videollamada de verdad en este turno? (agendarCita devolvió booked=true) */
export function huboReserva(steps: any[]): boolean {
  return (steps ?? []).some((s) => (s?.toolResults ?? []).some((tr: any) => tr?.toolName === "agendarCita" && (tr.output ?? tr.result)?.booked === true));
}

export function aseguraConfirmacionLlamada(text: string, steps: any[], datos: DatosConfirmacion): string {
  let enlace: string | undefined;
  let startTime: string | undefined;
  let horaLocal: string | undefined;
  for (const s of steps ?? []) {
    for (const tr of s?.toolResults ?? []) {
      if (tr?.toolName !== "agendarCita") continue;
      const out = tr.output ?? tr.result;
      if (out?.booked !== true) continue;
      enlace = typeof out.enlace === "string" ? out.enlace : undefined;
      horaLocal = typeof out.horaLocal === "string" ? out.horaLocal : undefined;
      const call = (s.toolCalls ?? []).find((c: any) => c?.toolCallId === tr.toolCallId);
      startTime = typeof call?.input?.startTime === "string" ? call.input.startTime : startTime;
    }
  }
  if (!enlace || text.includes(enlace)) return text;
  if (text.trim()) return `${text.trim()}\n\nEste es tu enlace para entrar:\n${enlace}`;
  return textoConfirmacion({ startTime, enlace, horaLocal }, datos);
}

/** Mensaje de confirmación de la videollamada (el que sale si el modelo no escribió nada). */
export function textoConfirmacion(args: { startTime?: string; enlace: string; horaLocal?: string }, datos: DatosConfirmacion): string {
  const fechaHora = cuando(args.startTime, datos.tz);
  const quien = datos.asesora?.trim() ? `${datos.asesora.trim()} te espera en la llamada` : "Te esperamos en la llamada";
  return (
    `¡Listo, quedó agendada tu videollamada${fechaHora ? ` para ${fechaHora} (${etiquetaZona(datos.tz)}${args.horaLocal ? `; ${args.horaLocal}` : ""})` : ""}! ` +
    `${quien} para darte toda la información que necesitas y aclarar tus dudas.\n\n` +
    `Este es tu enlace para entrar:\n${args.enlace}`
  );
}
