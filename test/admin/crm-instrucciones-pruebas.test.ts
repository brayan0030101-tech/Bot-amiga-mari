/** Pantallas «Instrucciones del bot» (versiones y restaurar) y «Probar el bot» (resultado de la última corrida). */
import { describe, it, expect, beforeEach, vi } from "vitest";

const generate = vi.fn();
vi.mock("../../src/llm/work-model", () => ({ workModel: async () => ({ generate: (...a: unknown[]) => generate(...a) }) }));
vi.mock("../../src/lib/equipo", async (orig) => ({ ...(await orig<typeof import("../../src/lib/equipo")>()), notifyEquipo: async () => true }));

import { createTestMiniflare } from "../helpers/miniflareSetup";
import { Db } from "../../src/db/client";
import { SettingsRepo } from "../../src/db/settings";
import { renderInstrucciones, restaurarInstrucciones } from "../../member/crm-instrucciones.local";
import { renderPruebas, correrPruebas } from "../../member/crm-pruebas.local";
import { MARCADORES, runGuardianInstrucciones, versionesInstrucciones } from "../../src/followup/guardianInstrucciones";
import { ESCENARIOS } from "../../src/followup/pruebasBot";
import type { Env } from "../../src/env";

let env: Env;
let db: Db;
const COMPLETO = MARCADORES.map((m) => m.texto).join("\n") + "\nresto del texto";

beforeEach(async () => {
  const mf = await createTestMiniflare();
  const d1 = (await mf.getD1Database("DB")) as any;
  db = new Db(d1);
  env = { DB: d1, BUSINESS_NAME: "Bekai Colombia", BOT_TIER: "pro" } as unknown as Env;
  generate.mockReset();
});

describe("Instrucciones del bot", () => {
  it("sin reglas guardadas se dibuja sin romperse", async () => {
    expect(await renderInstrucciones(env)).toContain("Instrucciones del bot");
  });

  it("lista las versiones, marca la actual y restaura una anterior guardando antes la actual", async () => {
    const st = new SettingsRepo(db);
    await st.set("custom_instructions", COMPLETO);
    await runGuardianInstrucciones(env, 1000);
    await st.set("custom_instructions", COMPLETO + "\nregla nueva");
    await runGuardianInstrucciones(env, 2000);
    const html = await renderInstrucciones(env);
    expect(html).toContain("actual");
    const vs = await versionesInstrucciones(env);
    expect(vs).toHaveLength(2);
    const vieja = vs.find((v) => !v.actual)!;
    const r = await restaurarInstrucciones(env, vieja.id, 3000);
    expect(r.ok).toBe(true);
    expect(await st.get("custom_instructions")).toBe(COMPLETO);
    expect((await restaurarInstrucciones(env, 99999)).ok).toBe(false);
  });

  it("avisa de las reglas imprescindibles que faltan", async () => {
    await new SettingsRepo(db).set("custom_instructions", "texto sin nada");
    await runGuardianInstrucciones(env, 1000);
    const html = await renderInstrucciones(env);
    expect(html).toMatch(/falta/i);
  });
});

describe("Probar el bot", () => {
  it("sin corridas dice que todavía no se corrió nada y avisa del costo", async () => {
    const html = await renderPruebas(env);
    expect(html).toContain("Todavía no se ha corrido ninguna prueba");
    expect(html).toContain(`${ESCENARIOS.length} conversaciones`);
    expect(html).toContain("0,55 USD");
  });

  it("después de una corrida muestra cuántas salieron bien y el detalle de cada una", async () => {
    await new SettingsRepo(db).set("custom_instructions", "reglas");
    generate.mockResolvedValue({ text: "Hola" }); // una respuesta que no cumple casi nada
    await correrPruebas(env, { escenarios: ESCENARIOS.slice(0, 2) });
    const html = await renderPruebas(env);
    expect(html).toContain("Última corrida");
    expect(html).toMatch(/\d de 2 bien/);
    expect(html).toContain(ESCENARIOS[0]!.titulo.slice(0, 20));
  });

  it("escapa el texto de las respuestas (no rompe el HTML)", async () => {
    await new SettingsRepo(db).set("custom_instructions", "reglas");
    generate.mockResolvedValue({ text: "<script>alert(1)</script>" });
    await correrPruebas(env, { escenarios: ESCENARIOS.slice(0, 1) });
    const html = await renderPruebas(env);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
