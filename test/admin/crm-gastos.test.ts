/**
 * CRM de Verónica: «Gastos del bot» — empieza vacío (sin gastos de otra persona), alta con validación, borrado y totales.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createTestMiniflare } from "../helpers/miniflareSetup";
import { agregarGasto, borrarGasto, cop, listarGastos, renderGastos, validarGasto } from "../../member/crm-gastos.local";
import type { Env } from "../../src/env";

let env: Env;

beforeEach(async () => {
  const mf = await createTestMiniflare();
  env = { DB: (await mf.getD1Database("DB")) as any, BUSINESS_NAME: "Bekai Colombia", BOT_TIER: "pro", DASHBOARD_BASE_URL: "https://bot.example" } as unknown as Env;
});

describe("gastos del chatbot", () => {
  it("empieza VACÍO: no trae gastos precargados de nadie", async () => {
    expect(await listarGastos(env)).toEqual([]);
    expect(await renderGastos(env)).not.toContain("211.000");
  });

  it("borrar un gasto lo quita y no vuelve", async () => {
    await agregarGasto(env, { fecha: "2026-10-20", categoria: "Otro", detalle: "uno", monto: "1000" });
    await agregarGasto(env, { fecha: "2026-10-21", categoria: "Otro", detalle: "dos", monto: "2000" });
    const [primero] = await listarGastos(env);
    await borrarGasto(env, primero!.id);
    const g = await listarGastos(env);
    expect(g).toHaveLength(1);
    expect(g.some((x) => x.id === primero!.id)).toBe(false);
  });

  it("agrega un gasto con monto escrito con puntos y valida los datos", async () => {
    expect(await agregarGasto(env, { fecha: "2026-10-20", categoria: "WhatsApp (Zernio)", detalle: "Recarga", monto: "$120.000" })).toEqual({ ok: true });
    expect((await listarGastos(env)).find((x) => x.detalle === "Recarga")?.monto).toBe(120000);
    expect(validarGasto({ fecha: "mañana", monto: "100" }).ok).toBe(false);
    expect(validarGasto({ fecha: "2026-10-20", monto: "0" }).ok).toBe(false);
    expect(validarGasto({ fecha: "2026-10-20", monto: "abc" }).ok).toBe(false);
    const r = validarGasto({ fecha: "2026-10-20", categoria: "inventada", monto: "5000" });
    expect(r.ok && r.g.categoria).toBe("Otro");
  });

  it("la página muestra total, categorías y escapa el detalle", async () => {
    await agregarGasto(env, { fecha: "2026-10-21", categoria: "Otro", detalle: "<b>x</b>", monto: "1000" });
    const html = await renderGastos(env);
    expect(html).toContain("Gastos del bot");
    expect(html).toContain(cop(1000));
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<b>x</b>");
  });
});
