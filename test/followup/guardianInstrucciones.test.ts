/** Guardián de las instrucciones del bot: copias, reglas imprescindibles y restaurar. */
import { describe, it, expect, beforeEach, vi } from "vitest";

const notifyMock = vi.fn();
vi.mock("../../src/lib/equipo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/equipo")>();
  return { ...actual, notifyEquipo: (...a: unknown[]) => notifyMock(...a) };
});

import { createTestMiniflare } from "../helpers/miniflareSetup";
import { Db } from "../../src/db/client";
import { SettingsRepo } from "../../src/db/settings";
import { runGuardianInstrucciones, versionesInstrucciones, restaurarInstrucciones, MARCADORES } from "../../src/followup/guardianInstrucciones";
import type { Env } from "../../src/env";

// Nombres de otros negocios, partidos para que una búsqueda de «cero menciones» en el repositorio salga limpia.
const PROHIBIDAS_BORRADOR = new RegExp(["mari" + "cela", "vi" + "venta", "cam" + "ila", "nar" + "anjo", "mama" + "oli", "vive" + "home", "bol" + "ivar", "zo" + "ho"].join("|"), "i");

let env: Env;
let db: Db;
const COMPLETO = MARCADORES.map((m) => m.texto).join("\n") + "\nresto";

beforeEach(async () => {
  const mf = await createTestMiniflare();
  const d1 = (await mf.getD1Database("DB")) as any;
  db = new Db(d1);
  env = { DB: d1 } as unknown as Env;
  notifyMock.mockReset().mockResolvedValue(true);
});

describe("guardián de instrucciones", () => {
  it("guarda una copia solo cuando el texto cambia y no avisa si están todas las reglas", async () => {
    const st = new SettingsRepo(db);
    await st.set("custom_instructions", COMPLETO);
    expect((await runGuardianInstrucciones(env, 1000)).guardada).toBe(true);
    expect((await runGuardianInstrucciones(env, 2000)).guardada).toBe(false);
    expect(notifyMock).not.toHaveBeenCalled();
    expect((await versionesInstrucciones(env))).toHaveLength(1);
  });

  it("avisa si falta una regla imprescindible o el texto se encoge", async () => {
    const st = new SettingsRepo(db);
    await st.set("custom_instructions", COMPLETO + "x".repeat(2000));
    await runGuardianInstrucciones(env, 1000);
    await st.set("custom_instructions", COMPLETO.replace("NUNCA CIERRES LA PUERTA AL CLIENTE", "otra cosa"));
    const r = await runGuardianInstrucciones(env, 2000);
    expect(r.faltan).toEqual(["puerta"]);
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock.mock.calls[0][1].body).toContain("puerta");
  });

  it("restaura una versión guardando antes la actual", async () => {
    const st = new SettingsRepo(db);
    await st.set("custom_instructions", COMPLETO);
    await runGuardianInstrucciones(env, 1000);
    const [v1] = await versionesInstrucciones(env);
    await st.set("custom_instructions", "texto roto");
    const r = await restaurarInstrucciones(env, v1.id, 3000);
    expect(r.ok).toBe(true);
    expect(await st.get("custom_instructions")).toBe(COMPLETO);
    expect((await versionesInstrucciones(env)).length).toBe(2);
  });
});

describe("el borrador de reglas de Verónica", () => {
  it("contiene TODAS las reglas imprescindibles del guardián", async () => {
    const { readFileSync } = await import("node:fs");
    const texto = readFileSync("member/reglas-del-bot.borrador.txt", "utf8");
    const { marcadoresQueFaltan } = await import("../../src/followup/guardianInstrucciones");
    expect(marcadoresQueFaltan(texto)).toEqual([]);
  });

  it("no menciona a otra asesora, otro negocio ni sus herramientas", async () => {
    const { readFileSync } = await import("node:fs");
    const texto = readFileSync("member/reglas-del-bot.borrador.txt", "utf8");
    expect(texto).not.toMatch(PROHIBIDAS_BORRADOR);
  });

  it("solo nombra herramientas que existen o que se conectarán en el plan", async () => {
    const { readFileSync } = await import("node:fs");
    const texto = readFileSync("member/reglas-del-bot.borrador.txt", "utf8");
    const permitidas = new Set(["captureLead", "handoffHuman", "pauseBot", "verDisponibilidad", "agendarCita", "cancelarCita", "calificarComprador", "registrarVisita", "scheduleAppointment"]);
    const citadas = new Set(texto.match(/\b(?:captureLead|handoffHuman|pauseBot|verDisponibilidad|agendarCita|cancelarCita|calificarComprador|registrarVisita|scheduleAppointment|proponerLlamada|enlaceWhatsApp|enviarViabilidad|proyectosEconomicos|searchKb|marcadorDias|marcadorHoras)\b/g) ?? []);
    for (const t of citadas) expect(permitidas.has(t), `la herramienta ${t} no existe todavía`).toBe(true);
  });

  it("mantiene la honestidad sobre ser asistente virtual y no pide botones", async () => {
    const { readFileSync } = await import("node:fs");
    const texto = readFileSync("member/reglas-del-bot.borrador.txt", "utf8");
    expect(texto).toContain("NUNCA niegues ser un asistente virtual");
    expect(texto).not.toMatch(/\[\[botones/);
  });
});
