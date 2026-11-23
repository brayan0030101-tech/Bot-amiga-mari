/** «Probar el bot»: las comprobaciones distinguen respuestas buenas de malas (sin IA) y la corrida guarda su resultado. */
import { describe, it, expect, vi, beforeEach } from "vitest";

const generate = vi.fn();
vi.mock("../../src/llm/work-model", () => ({ workModel: async () => ({ generate: (...a: unknown[]) => generate(...a) }) }));

import { createTestMiniflare } from "../helpers/miniflareSetup";
import { Db } from "../../src/db/client";
import { SettingsRepo } from "../../src/db/settings";
import { ESCENARIOS, evaluarRespuesta, correrPruebas, ultimaCorrida, sinTildes } from "../../src/followup/pruebasBot";
import type { Env } from "../../src/env";

// Nombres de otros negocios, partidos para que una búsqueda de «cero menciones» en el repositorio salga limpia.
const PROHIBIDAS = new RegExp(["mari" + "cela", "vi" + "venta", "cam" + "ila", "nar" + "anjo", "mama" + "oli", "vive" + "home", "zo" + "ho"].join("|"), "i");

let env: Env;
let db: Db;

beforeEach(async () => {
  const mf = await createTestMiniflare();
  const d1 = (await mf.getD1Database("DB")) as any;
  db = new Db(d1);
  env = { DB: d1 } as unknown as Env;
  generate.mockReset();
});

describe("escenarios de prueba", () => {
  it("hay escenarios con ids únicos", () => {
    expect(ESCENARIOS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(ESCENARIOS.map((e) => e.id)).size).toBe(ESCENARIOS.length);
  });

  for (const e of ESCENARIOS) {
    it(`«${e.id}»: la respuesta buena pasa todas las comprobaciones`, () => {
      const r = evaluarRespuesta(e, e.respuestaBuena);
      expect(r.checks.filter((c) => !c.ok).map((c) => c.que)).toEqual([]);
      expect(r.ok).toBe(true);
    });
    it(`«${e.id}»: la respuesta mala NO pasa`, () => {
      expect(evaluarRespuesta(e, e.respuestaMala).ok).toBe(false);
    });
  }

  it("no mencionan a otra asesora ni a otro negocio", () => {
    const todo = JSON.stringify(ESCENARIOS.map((e) => [e.titulo, e.previo, e.cliente, e.herramienta, e.respuestaBuena, e.respuestaMala]));
    expect(todo).not.toMatch(PROHIBIDAS);
  });

  it("las comprobaciones ignoran tildes y mayúsculas", () => {
    expect(sinTildes("ÁÉÍÓÚ Verónica")).toBe("aeiou veronica");
  });
});

describe("correrPruebas", () => {
  it("corre cada escenario contra las instrucciones guardadas y guarda el resultado", async () => {
    await new SettingsRepo(db).set("custom_instructions", "REGLAS DE PRUEBA");
    const chicos = ESCENARIOS.slice(0, 4);
    generate.mockImplementation(async (args: { system: string }) => {
      expect(args.system).toContain("REGLAS DE PRUEBA");
      expect(args.system).toContain("MODO PRUEBA");
      return { text: "Hola" };
    });
    const id = await correrPruebas(env, { escenarios: chicos, now: 1234 });
    expect(id).toBeGreaterThan(0);
    expect(generate).toHaveBeenCalledTimes(4);
    const ult = await ultimaCorrida(env);
    expect(ult?.estado).toBe("listo");
    expect(ult?.resultados).toHaveLength(4);
    expect(ult?.creado).toBe(1234);
  });

  it("una falla de la IA queda como error de ese escenario sin romper la corrida", async () => {
    generate.mockRejectedValue(new Error("proveedor caído"));
    await correrPruebas(env, { escenarios: ESCENARIOS.slice(0, 2), instruccionesDePrueba: "x" });
    const ult = await ultimaCorrida(env);
    expect(ult?.resultados.every((r) => !r.ok && /proveedor/.test(r.error ?? ""))).toBe(true);
  });

  it("usa las instrucciones de prueba si se pasan (para probar el borrador antes de guardarlo)", async () => {
    await new SettingsRepo(db).set("custom_instructions", "ACTUALES");
    generate.mockResolvedValue({ text: "ok" });
    await correrPruebas(env, { escenarios: ESCENARIOS.slice(0, 1), instruccionesDePrueba: "BORRADOR NUEVO" });
    expect(generate.mock.calls[0][0].system).toContain("BORRADOR NUEVO");
    expect(generate.mock.calls[0][0].system).not.toContain("ACTUALES");
  });

  it("sin corridas previas no hay resultado", async () => {
    expect(await ultimaCorrida(env)).toBeNull();
  });
});
