import { describe, it, expect, beforeEach } from "vitest";
import { createTestMiniflare } from "../helpers/miniflareSetup";
import { Db } from "../../src/db/client";
import { ConversationsRepo } from "../../src/db/conversations";
import { LeadsRepo } from "../../src/db/leads";
import { captureLeadTool } from "../../src/tools/captureLead";

let env: any;
let leads: LeadsRepo;
let convId: string;

beforeEach(async () => {
  const mf = await createTestMiniflare();
  const d1 = await mf.getD1Database("DB");
  const db = new Db(d1 as any);
  leads = new LeadsRepo(db);
  // The leads table FKs conversation_id -> conversations(id), so we need a real
  // conversation row before the tool can attach a lead to it (same pattern as
  // the green handoffHuman/pauseBot tool tests).
  const conv = await new ConversationsRepo(db).getOrCreate("telegram", "u1");
  convId = conv.id;
  env = { DB: d1, BOT_TIER: "pro" };
});

describe("captureLeadTool", () => {
  it("creates lead in D1 even without external service", async () => {
    const tool = captureLeadTool(env, () => convId);
    // AI SDK v6: tool.execute is optional + expects (input, options). Invoke with
    // 2 args and cast the result (same pattern as the repo's green tool tests).
    const result = (await tool.execute!(
      {
        name: "María",
        contact: "+5215512345",
        intent: "Corte + barba 5pm",
      },
      {} as any,
    )) as { leadId: string; message: string };
    expect(result.leadId).toBeTruthy();
    const list = await leads.list(10);
    expect(list).toHaveLength(1);
    expect(list[0].intent).toBe("Corte + barba 5pm");
  });

  it("guarda en la ficha los campos del guion de prospección (residencia, primer interés, co-comprador…)", async () => {
    const tool = captureLeadTool(env, () => convId);
    await tool.execute!(
      {
        name: "Laura Pérez",
        intent: "Comprar vivienda en Cali",
        situacionResidencia: "Permiso de residencia",
        primerInteres: "Cuánto le puede prestar un banco",
        reportadoDatacredito: "No está seguro/a",
        ingresosCoComprador: "1.800 euros",
        datosCoComprador: "Pedro, pedro@correo.com",
      },
      {} as any,
    );
    const [lead] = await leads.list(10);
    const meta = typeof lead.metadata === "string" ? JSON.parse(lead.metadata) : lead.metadata;
    expect(meta.situacionResidencia).toBe("Permiso de residencia");
    expect(meta.primerInteres).toBe("Cuánto le puede prestar un banco");
    expect(meta.reportadoDatacredito).toBe("No está seguro/a");
    expect(meta.ingresosCoComprador).toBe("1.800 euros");
    expect(meta.datosCoComprador).toBe("Pedro, pedro@correo.com");
  });

  it("la ficha para el equipo muestra esos campos con su etiqueta", async () => {
    const tool = captureLeadTool(env, () => convId);
    await tool.execute!({ name: "Laura", intent: "Compra", situacionResidencia: "Residencia en trámite", primerInteres: "Precios y proyectos disponibles" }, {} as any);
    const { leadFicha } = await import("../../src/lib/equipo");
    const db = new Db(env.DB);
    const ficha = await leadFicha(db, convId);
    expect(ficha).toContain("Situación de residencia");
    expect(ficha).toContain("Residencia en trámite");
    expect(ficha).toContain("Quiere conocer primero");
  });
});
