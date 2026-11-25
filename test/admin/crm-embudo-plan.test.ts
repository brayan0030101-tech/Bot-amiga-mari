/** «Recorrido del cliente» (embudo) y «Plan del día». */
import { describe, it, expect, beforeEach } from "vitest";
import { createTestMiniflare } from "../helpers/miniflareSetup";
import { Db } from "../../src/db/client";
import { ConversationsRepo } from "../../src/db/conversations";
import { MessagesRepo } from "../../src/db/messages";
import { calcularEmbudo, renderCrmEmbudo } from "../../member/crm-embudo.local";
import { renderCrmPlan } from "../../member/crm-plan.local";
import type { Env } from "../../src/env";

const DIA = 86_400_000;
const NOW = Date.UTC(2026, 9, 22, 12, 0);
let db: Db;
let env: Env;

async function cliente(tel: string, nombre: string, msgs: number, meta?: Record<string, string>, canal = "ycloud") {
  const c = await new ConversationsRepo(db).getOrCreate(canal, tel, nombre);
  for (let i = 0; i < msgs; i++) await new MessagesRepo(db).append(c.id, "user", `mensaje ${i}`, { createdAt: NOW - 3 * DIA + i * 1000 });
  await db.run("UPDATE conversations SET last_message_at = ? WHERE id = ?", [NOW - 2 * DIA, c.id]);
  if (meta) await db.run("INSERT INTO leads (id, conversation_id, name, contact, intent, metadata, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)", [crypto.randomUUID(), c.id, nombre, "x@y.com", "Lead", JSON.stringify(meta), NOW - 2 * DIA, NOW - 2 * DIA]);
  return c.id;
}

beforeEach(async () => {
  const mf = await createTestMiniflare();
  const d1 = (await mf.getD1Database("DB")) as any;
  db = new Db(d1);
  env = { DB: d1, BUSINESS_NAME: "Bekai Colombia", BOT_TIER: "pro", CRM_SESSION_SECRET: "secreto-de-prueba-largo-123456" } as unknown as Env;
});

const COMPLETO = { ciudadResidencia: "España, Madrid", ciudadCompra: "Cali", entregaInmediataOFutura: "futura", ahorroDisponible: "5000", capacidadMensual: "500 euros", tipoEmpleo: "empleado", ingresosMensuales: "2000", reportadoDatacredito: "No", compraSoloOAcompanado: "Solo" };

describe("embudo", () => {
  it("cuenta cada paso, separa por canal y no cuenta números colombianos", async () => {
    await cliente("34600000081", "Solo saluda", 1);
    await cliente("34600000082", "Conversa", 4);
    const c = await cliente("34600000083", "Completo", 8, COMPLETO);
    await cliente("573001234567", "Colombiano", 5, COMPLETO);
    // La cotización solo sale si el cliente la pide: el bot deja un aviso interno con el motivo «Cliente pide cotización».
    await db.run("INSERT INTO tickets (id, conversation_id, category, summary, transcript, status, created_at) VALUES (?, ?, 'other', ?, '', 'open', ?)", ["tk-cot", c, "[Cliente pide cotización] quiere un apartamento en Cali", NOW - 1000]);
    const e = await calcularEmbudo(env, 30, NOW);
    expect(e.total.escribe).toBe(3);
    expect(e.total.conversa).toBe(2);
    expect(e.total.preguntas).toBe(1);
    expect(e.total.califica).toBe(1);
    expect(e.pidieronCotizacion).toBe(1); // la cotización es opcional: no es un paso del recorrido, se cuenta aparte
    expect("cotizacion" in e.total).toBe(false);
    expect(e.total.agenda).toBe(0);
    expect(e.porCanal.WhatsApp.escribe).toBe(3);
    const html = await renderCrmEmbudo(env, 30, NOW);
    expect(html).toContain("Recorrido");
    expect(html).toContain("pidió una cotización");
  });
});

describe("plan del día", () => {
  it("se dibuja aunque no haya nada", async () => {
    const html = await renderCrmPlan(env, NOW);
    expect(html).toContain("Plan del día");
    expect(html).toContain("En cierre");
    expect(html).toContain("Prometido en las llamadas");
  });
});

describe("páginas de instrucciones y pruebas del bot", () => {
  it("se dibujan sin errores", async () => {
    const { renderInstrucciones } = await import("../../member/crm-instrucciones.local");
    const { renderPruebas } = await import("../../member/crm-pruebas.local");
    await db.run("INSERT INTO settings (key, value, updated_at) VALUES ('custom_instructions', 'SISTEMA DE ATENCION BEKAI COLOMBIA', 1)");
    expect(await renderInstrucciones(env)).toContain("Instrucciones del bot");
    expect(await renderPruebas(env)).toContain("Probar el bot");
  });
});
