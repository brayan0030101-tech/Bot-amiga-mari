/**
 * Seguridad del CRM: la base de Verónica tiene chats personales, así que nada se ve sin sesión y lo delicado es solo del administrador.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { createTestMiniflare } from "../helpers/miniflareSetup";
import { crmApp, crearInvitacion, __reiniciarTabla } from "../../member/crm-app.local";
import type { Env } from "../../src/env";

let env: Env;
let raiz: Hono<{ Bindings: Env }>;

const pedir = (ruta: string, init: RequestInit = {}, cookie?: string) =>
  raiz.request(`https://bot.example${ruta}`, { ...init, headers: { ...(init.headers as Record<string, string>), ...(cookie ? { cookie } : {}) } }, env);
const form = (o: Record<string, string> = {}) => ({ method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(o).toString() });
const cookieDe = (r: Response) => (r.headers.get("set-cookie") ?? "").split(";")[0];

async function usuario(correo: string, rol: "admin" | "equipo"): Promise<string> {
  const inv = await crearInvitacion(env, { correo, nombre: "Prueba", rol });
  if (!inv.ok) throw new Error(inv.error);
  return cookieDe(await pedir(`/crm/invitacion/${inv.token}`, form({ nombre: "Prueba", clave: "una-clave-larga-1" })));
}

beforeEach(async () => {
  __reiniciarTabla();
  const mf = await createTestMiniflare();
  env = { DB: (await mf.getD1Database("DB")) as any, BUSINESS_NAME: "Bekai Colombia", BOT_TIER: "pro", CRM_SESSION_SECRET: "secreto-de-prueba-largo-123456" } as unknown as Env;
  raiz = new Hono<{ Bindings: Env }>();
  raiz.route("/crm", crmApp());
});

const PAGINAS = ["/crm", "/crm/export.xlsx", "/crm/c/zernio%3A34600000011", "/crm/c/zernio%3A34600000011/ficha.xlsx", "/crm/calendario", "/crm/agendar", "/crm/auditoria", "/crm/informes", "/crm/informes.xlsx", "/crm/plan", "/crm/embudo", "/crm/por-agendar", "/crm/por-agendar.xlsx", "/crm/esperando-humano", "/crm/gastos", "/crm/instrucciones", "/crm/pruebas", "/crm/recomendaciones", "/crm/usuarios", "/crm/pipeline", "/crm/llamada/x"];
const ACCIONES = ["/crm/agendar", "/crm/gastos", "/crm/pruebas/correr", "/crm/instrucciones/restaurar", "/crm/usuarios", "/crm/etapa", "/crm/observacion", "/crm/auditoria/resolver", "/crm/auditoria/aplicar", "/crm/recomendaciones/generar", "/crm/c/x/nota", "/crm/c/x/telefono", "/crm/c/x/analizar", "/crm/por-agendar/clasificar", "/crm/esperando-humano/hecho"];

describe("sin sesión no se ve ni se hace nada", () => {
  it("todas las páginas mandan al acceso del CRM", async () => {
    for (const ruta of PAGINAS) {
      const r = await pedir(ruta);
      expect(r.status, ruta).toBe(302);
      expect(r.headers.get("location"), ruta).toBe("/crm/login");
    }
  });

  it("todas las acciones (POST) responden 401", async () => {
    for (const ruta of ACCIONES) expect((await pedir(ruta, form({ x: "1" }))).status, ruta).toBe(401);
  });

  it("sin la llave de sesión propia, nada abre (503)", async () => {
    env = { ...env, CRM_SESSION_SECRET: undefined } as unknown as Env;
    for (const ruta of ["/crm", "/crm/login", "/crm/calendario"]) expect((await pedir(ruta)).status, ruta).toBe(503);
  });
});

describe("lo delicado es solo del administrador", () => {
  it("el equipo no puede ver ni usar las instrucciones del bot, las pruebas ni los usuarios", async () => {
    const equipo = await usuario("equipo@ejemplo.com", "equipo");
    for (const ruta of ["/crm/instrucciones", "/crm/pruebas", "/crm/usuarios"]) expect((await pedir(ruta, {}, equipo)).status, ruta).toBe(403);
    for (const ruta of ["/crm/pruebas/correr", "/crm/instrucciones/restaurar", "/crm/usuarios", "/crm/auditoria/aplicar"]) expect((await pedir(ruta, form({ id: "1" }), equipo)).status, ruta).toBe(403);
    // y ni siquiera ve esos enlaces en el menú
    const menu = await (await pedir("/crm", {}, equipo)).text();
    expect(menu).not.toContain("Instrucciones del bot");
    expect(menu).not.toContain("Probar el bot");
  });

  it("el administrador sí las ve", async () => {
    const admin = await usuario("admin@ejemplo.com", "admin");
    for (const ruta of ["/crm/instrucciones", "/crm/pruebas", "/crm/usuarios"]) expect((await pedir(ruta, {}, admin)).status, ruta).toBe(200);
    const menu = await (await pedir("/crm", {}, admin)).text();
    expect(menu).toContain("Instrucciones del bot");
    expect(menu).toContain("Probar el bot");
  });

  it("las rutas de lo que aún no existe (Zoho, cotizaciones, seguros) no responden", async () => {
    const admin = await usuario("admin@ejemplo.com", "admin");
    for (const ruta of ["/crm/zoho", "/crm/seguimientos", "/crm/cotizaciones", "/crm/oportunidades", "/crm/reactivacion", "/crm/prospeccion", "/crm/modo"]) expect((await pedir(ruta, {}, admin)).status, ruta).toBe(404);
  });
});
