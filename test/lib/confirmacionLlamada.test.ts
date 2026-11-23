import { describe, it, expect } from "vitest";
import { aseguraConfirmacionLlamada, huboReserva, etiquetaZona } from "../../src/lib/confirmacionLlamada";

const LINK = "https://meet.google.com/abc-defg-hij";
const DATOS = { tz: "Europe/Madrid", asesora: "Verónica" };
const pasos = (booked: boolean, enlace?: string, horaLocal?: string) => [
  {
    toolCalls: [{ toolCallId: "t1", toolName: "agendarCita", input: { startTime: "2026-10-14T09:30:00.000Z" } }],
    toolResults: [{ toolCallId: "t1", toolName: "agendarCita", output: { booked, ...(enlace ? { enlace } : {}), ...(horaLocal ? { horaLocal } : {}) } }],
  },
];

describe("aseguraConfirmacionLlamada", () => {
  it("sin texto: arma la confirmación con día, hora de la agenda, asesora y enlace", () => {
    const t = aseguraConfirmacionLlamada("", pasos(true, LINK), DATOS);
    expect(t).toContain("miércoles 14 de octubre a las 11:30");
    expect(t).toContain("hora de España");
    expect(t).toContain("Verónica te espera");
    expect(t).toContain(LINK);
  });
  it("con texto sin enlace: agrega el enlace", () => {
    const t = aseguraConfirmacionLlamada("¡Listo, quedó agendada!", pasos(true, LINK), DATOS);
    expect(t.startsWith("¡Listo, quedó agendada!")).toBe(true);
    expect(t).toContain(LINK);
  });
  it("si el texto ya trae el enlace, no lo repite", () => {
    const base = `Entra aquí ${LINK}`;
    expect(aseguraConfirmacionLlamada(base, pasos(true, LINK), DATOS)).toBe(base);
  });
  it("si no se reservó, no toca nada", () => {
    expect(aseguraConfirmacionLlamada("", pasos(false), DATOS)).toBe("");
    expect(aseguraConfirmacionLlamada("hola", [], DATOS)).toBe("hola");
    expect(huboReserva(pasos(false))).toBe(false);
    expect(huboReserva(pasos(true, LINK))).toBe(true);
  });
  it("incluye la hora local del cliente si la herramienta la dio", () => {
    expect(aseguraConfirmacionLlamada("", pasos(true, LINK, "04:30 en Colombia"), DATOS)).toContain("hora de España; 04:30 en Colombia");
  });
  it("nombra la zona de la agenda", () => {
    expect(etiquetaZona("Europe/Madrid")).toBe("hora de España");
    expect(etiquetaZona("America/Bogota")).toBe("hora de Bogota");
  });
  it("no menciona a ninguna otra asesora", () => {
    expect(aseguraConfirmacionLlamada("", pasos(true, LINK), { tz: "Europe/Madrid" })).toContain("Te esperamos en la llamada");
  });
});

describe("nota de hora acordada en la reserva", () => {
  it("el mismo instante se escribe en hora de España", async () => {
    const { notaHoraEspana } = await import("../../src/tools/servicios");
    // 16:30 UTC = 18:30 en España (CEST): es la MISMA hora, solo cambia la zona.
    expect(notaHoraEspana("2026-10-15T16:30:00.000Z")).toBe("Hora acordada con el cliente: jueves 15 de octubre, 18:30 (hora de España)");
    expect(notaHoraEspana("no es fecha")).toBe("");
  });
});

describe("zona horaria del cliente", () => {
  it("deduce la zona de «País, Ciudad» y muestra la hora local", async () => {
    const { zonaDeResidencia, horaEn, esEspana } = await import("../../src/lib/zonaCliente");
    expect(esEspana(zonaDeResidencia("España, Madrid"))).toBe(true);
    const co = zonaDeResidencia("Colombia, Medellín");
    expect(co?.tz).toBe("America/Bogota");
    expect(horaEn("2026-10-15T17:00:00.000Z", co!.tz)).toBe("12:00");
    expect(zonaDeResidencia("Estados Unidos, Miami")?.tz).toBe("America/New_York");
    expect(zonaDeResidencia("")).toBeNull();
    expect(zonaDeResidencia("Narnia")).toBeNull();
  });
});
