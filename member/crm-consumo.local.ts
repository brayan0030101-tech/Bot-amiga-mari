// member/crm-consumo.local.ts — «Gastos del bot»: consumo AUTOMÁTICO de la IA de Claude.
//  · IA: se lee en vivo de la libreta `ia_usage` (cada llamada del bot anota su costo), así que siempre está al día.
//  · WhatsApp entra por Zernio y se cobra en la cuenta de Zernio / de Meta: no hay un saldo que se pueda leer aquí; esos pagos se anotan
//    a mano como gastos en «Gastos del bot».
// Es lo que ya se CONSUMIÓ (en dólares); lo que se paga (en pesos) va aparte, como gastos manuales: no se suman entre sí.
import type { Env } from "../src/env";
import { Db } from "../src/db/client";
import { SettingsRepo } from "../src/db/settings";
import { esc } from "./crm.local";

const DIA = 86_400_000;
const DIAS_TABLA = 14;
/** Si no hay otra tasa guardada (ajuste `crm_usd_cop`), pesos por dólar para mostrar equivalencias aproximadas. */
export const TASA_COP_POR_DEFECTO = 4000;

export interface DiaIa {
  dia: string;
  respuestas: number;
  otros: number;
}
export interface ConsumoIa {
  total: number;
  mes: number;
  respuestas: number;
  otros: number;
  desde: string;
  dias: DiaIa[];
}
export interface Consumo {
  ia: ConsumoIa;
  tasa: number;
}

const ymdMadrid = (ms: number): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
/** Diferencia de España con UTC en ese instante (1 h en invierno, 2 h en verano). */
function madridOffsetMs(ms: number): number {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }).format(new Date(ms)));
  const u = new Date(ms).getUTCHours();
  return ((h - u + 24) % 24) * 3600_000;
}
const redondea = (n: number): number => Math.round(n * 100) / 100;

export async function cargarConsumo(env: Env, now = Date.now()): Promise<Consumo> {
  const db = new Db(env.DB);
  const settings = new SettingsRepo(db);
  const mesIni = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), 1);

  // IA: totales, mes y últimos 14 días, agregados en SQL (la libreta crece con cada llamada del bot).
  const offMs = madridOffsetMs(now);
  const tot = await db
    .first<{ t: number | null; r: number | null; p: number | null }>("SELECT SUM(cost_usd) AS t, SUM(CASE WHEN fn = 'conversacion' THEN cost_usd ELSE 0 END) AS r, MIN(created_at) AS p FROM ia_usage")
    .catch(() => null);
  const delMes = await db.first<{ t: number | null }>("SELECT SUM(cost_usd) AS t FROM ia_usage WHERE created_at >= ?", [mesIni]).catch(() => null);
  const porDia = await db
    .all<{ d: string; r: number | null; o: number | null }>(
      `SELECT date((created_at + ?) / 1000, 'unixepoch') AS d,
              SUM(CASE WHEN fn = 'conversacion' THEN cost_usd ELSE 0 END) AS r,
              SUM(CASE WHEN fn <> 'conversacion' THEN cost_usd ELSE 0 END) AS o
         FROM ia_usage WHERE created_at >= ? GROUP BY d ORDER BY d DESC`,
      [offMs, now - DIAS_TABLA * DIA],
    )
    .catch(() => []);
  const limite = ymdMadrid(now - DIAS_TABLA * DIA);
  const ia: ConsumoIa = {
    total: redondea(tot?.t ?? 0),
    mes: redondea(delMes?.t ?? 0),
    respuestas: redondea(tot?.r ?? 0),
    otros: redondea((tot?.t ?? 0) - (tot?.r ?? 0)),
    desde: tot?.p ? ymdMadrid(tot.p) : "",
    dias: porDia.map((x) => ({ dia: x.d, respuestas: x.r ?? 0, otros: x.o ?? 0 })).filter((x) => x.dia > limite),
  };

  const tasa = Number(await settings.get("crm_usd_cop")) || TASA_COP_POR_DEFECTO;
  return { ia, tasa };
}

const usd = (n: number): string => `$${n.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cop = (n: number): string => `$${Math.round(n).toLocaleString("es-CO")}`;

export function htmlConsumo(c: Consumo): string {
  const { ia, tasa } = c;
  const kpi = (t: string, v: string, sub = "", color = "") =>
    `<div class="crm-kpi"><div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)">${t}</div><div style="font-weight:700;font-size:22px;${color ? `color:${color}` : ""}">${v}</div>${sub ? `<div class="text-dim" style="font-size:11px;margin-top:2px">${sub}</div>` : ""}</div>`;
  const tablaIa = ia.dias.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px"><tr class="text-dim"><th style="text-align:left;padding:3px 0">Día</th><th style="text-align:right">Respuestas a clientes</th><th style="text-align:right">Lo demás</th><th style="text-align:right">Total</th></tr>${ia.dias.map((d) => `<tr style="border-top:1px solid var(--line)"><td style="padding:3px 0">${esc(d.dia)}</td><td style="text-align:right">${usd(d.respuestas)}</td><td style="text-align:right">${usd(d.otros)}</td><td style="text-align:right;font-weight:700">${usd(d.respuestas + d.otros)}</td></tr>`).join("")}</table>`
    : "";
  return `<div class="crm-sec" style="margin:4px 0 8px">Consumo automático <span class="text-dim" style="font-weight:400;font-size:11px">· se actualiza solo (la IA al instante)</span></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;margin-bottom:16px">
      <div class="crm-card" style="padding:16px;border-left:4px solid var(--info)">
        <div style="font-weight:700;color:var(--cream);margin-bottom:8px">🤖 IA de Claude (API)</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px">
          ${kpi("Total", usd(ia.total), `≈ ${cop(ia.total * tasa)} COP${ia.desde ? ` · desde ${esc(ia.desde)}` : ""}`)}
          ${kpi("Este mes", usd(ia.mes), `≈ ${cop(ia.mes * tasa)} COP`)}
          ${kpi("Respuestas a clientes", usd(ia.respuestas), "los chats con clientes")}
          ${kpi("Lo demás", usd(ia.otros), "CRM, análisis, reportes, seguimientos")}
        </div>${tablaIa}</div>
    </div>
    <div class="text-dim" style="font-size:11px;margin:-6px 0 16px">Lo de arriba es lo que YA se consumió (en dólares). Las recargas que pagas en pesos se anotan abajo como gastos: son el dinero que sale de tu bolsillo, no se suman a este consumo. Equivalencia en pesos aproximada a ${cop(tasa)} por dólar.</div>`;
}
