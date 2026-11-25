/**
 * «Gastos del bot»: consumo automático de la IA (libreta ia_usage). WhatsApp entra por Zernio y no tiene saldo que leer aquí.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createTestMiniflare } from "../helpers/miniflareSetup";
import { Db } from "../../src/db/client";
import { cargarConsumo } from "../../member/crm-consumo.local";
import { renderGastos } from "../../member/crm-gastos.local";
import type { Env } from "../../src/env";

let env: Env;
let db: Db;
const NOW = Date.UTC(2026, 9, 20, 12, 0);
const H = 3600_000;
const DIA = 24 * H;

async function uso(fn: string, costo: number, ts: number) {
  await db.run("INSERT INTO ia_usage (created_at, fn, model, cost_usd) VALUES (?,?,?,?)", [ts, fn, "claude-sonnet-5-5", costo]);
}

beforeEach(async () => {
  const mf = await createTestMiniflare();
  const d1 = (await mf.getD1Database("DB")) as any;
  db = new Db(d1);
  env = { DB: d1, BUSINESS_NAME: "Bekai Colombia", BOT_TIER: "pro", DASHBOARD_BASE_URL: "https://bot.example" } as unknown as Env;
  await db.run(`CREATE TABLE IF NOT EXISTS ia_usage (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at INTEGER NOT NULL, fn TEXT NOT NULL, model TEXT NOT NULL, input_tokens INTEGER NOT NULL DEFAULT 0, cached_input_tokens INTEGER NOT NULL DEFAULT 0, cache_creation_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, cost_usd REAL NOT NULL DEFAULT 0, conversation_id TEXT)`);
});

describe("consumo automático", () => {
  it("separa lo que se gasta contestando a clientes de lo demás, por mes y por día", async () => {
    await uso("conversacion", 0.02, NOW - 1 * H);
    await uso("conversacion", 0.03, NOW - 2 * H);
    await uso("trabajo", 0.1, NOW - 1 * H);
    await uso("insights", 0.05, NOW - 40 * DIA); // mes anterior y fuera de los últimos 14 días
    const c = await cargarConsumo(env, NOW);
    expect(c.ia.total).toBe(0.2);
    expect(c.ia.respuestas).toBe(0.05);
    expect(c.ia.otros).toBe(0.15);
    expect(c.ia.mes).toBe(0.15);
    expect(c.ia.dias).toHaveLength(1);
    expect(c.ia.dias[0]).toMatchObject({ dia: "2026-10-20" });
    expect("wa" in c).toBe(false); // no hay saldo de WhatsApp que leer
  });

  it("la página de gastos muestra el consumo automático arriba y los gastos pagados abajo, sin mezclarlos", async () => {
    await uso("conversacion", 0.5, NOW - H);
    const html = await renderGastos(env, { hoy: "2026-10-20" });
    expect(html).toContain("Consumo automático");
    expect(html).toContain("IA de Claude (API)");
    expect(html).not.toContain("YCloud");
    expect(html).toContain("Gastos pagados");
    expect(html).toContain("Respuestas a clientes");
  });

  it("sin datos no se rompe", async () => {
    const c = await cargarConsumo(env, NOW);
    expect(c.ia.total).toBe(0);
    expect(await renderGastos(env)).toContain("Gastos del bot");
  });
});
