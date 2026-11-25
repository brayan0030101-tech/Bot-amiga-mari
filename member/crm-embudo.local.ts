// member/crm-embudo.local.ts — CRM de Bekai Colombia: «Recorrido del cliente» (embudo).
// Cuenta, de las personas que escribieron por primera vez en el periodo, cuántas llegan a cada paso y dónde se pierden:
// escribe → conversa (3+ mensajes) → termina las preguntas → califica (tibio/caliente) → agenda videollamada → se conecta →
// formulario enviado (Zoho) → cerrado. La cotización es opcional (solo si el cliente la pide), así que no es un paso: se cuenta aparte. Sin IA y sin costo: sale de las tablas de siempre. Los números colombianos no cuentan.
import type { Env } from "../src/env";
import { Db } from "../src/db/client";
import { armarLeads, evaluarCalificacion } from "../src/followup/resumenDia";
import { esNumeroColombiano } from "../src/lib/colombia";
import { crmLayout } from "./crm-shell.local";
import { esc, ESTILO_CRM } from "./crm.local";
import { esWhatsApp } from "../src/lib/canal";

const DIA = 24 * 3_600_000;
const BASE_PREGUNTAS = ["ciudadResidencia", "ciudadCompra", "entregaInmediataOFutura", "ahorroDisponible", "capacidadMensual", "tipoEmpleo", "ingresosMensuales"];
const FORMULARIO = ["Formulario CC", "En Pre-calificación", "Resultado Pre-calificación", "Pre-calificado Incompleto", "Enviado a constructora", "Puente"];

export const PASOS = [
  { id: "escribe", nombre: "Escribieron", ayuda: "Primer mensaje del cliente" },
  { id: "conversa", nombre: "Conversaron", ayuda: "Mandaron 3 mensajes o más: pasaron del primer saludo" },
  { id: "preguntas", nombre: "Terminaron las preguntas", ayuda: "El bot reunió los 7 datos base" },
  { id: "califica", nombre: "Califican (tibio o caliente)", ayuda: "Cumplen las condiciones de ingresos y cuota" },
  { id: "agenda", nombre: "Agendaron videollamada", ayuda: "Tienen o tuvieron una cita con Verónica" },
  { id: "conecta", nombre: "Se conectaron", ayuda: "La videollamada ya pasó y se analizó" },
  { id: "formulario", nombre: "Formulario enviado", ayuda: "En Zoho están en «Formulario CC» o posterior" },
  { id: "cerrado", nombre: "Cerrados", ayuda: "Marcados como cerrados (compró o reservó)" },
] as const;
export type PasoId = (typeof PASOS)[number]["id"];

export interface Embudo {
  dias: number;
  total: Record<PasoId, number>;
  porCanal: Record<"WhatsApp" | "Instagram", Record<PasoId, number>>;
  /** Clientes del periodo que pidieron una cotización (el bot dejó el aviso). No es un paso del recorrido: es opcional. */
  pidieronCotizacion: number;
}

const vacio = (): Record<PasoId, number> => Object.fromEntries(PASOS.map((p) => [p.id, 0])) as Record<PasoId, number>;

export async function calcularEmbudo(env: Env, dias: number, now = Date.now()): Promise<Embudo> {
  const db = new Db(env.DB);
  const desde = now - dias * DIA;
  const convs = await db.all<{ id: string; channel: string; channel_user_id: string; display_name: string | null; last_message_at: number; metadata: string | null; primero: number; n: number }>(
    `SELECT c.id, c.channel, c.channel_user_id, c.display_name, c.last_message_at, c.metadata, MIN(m.created_at) AS primero, COUNT(*) AS n
       FROM conversations c JOIN messages m ON m.conversation_id = c.id AND m.role = 'user'
      WHERE c.channel IN ('ycloud', 'zernio') GROUP BY c.id HAVING primero > ? ORDER BY primero DESC LIMIT 2000`,
    [desde],
  );
  const lista = convs.filter((c) => !esNumeroColombiano(c.channel_user_id));
  const total = vacio();
  const porCanal = { WhatsApp: vacio(), Instagram: vacio() };
  if (!lista.length) return { dias, total, porCanal, pidieronCotizacion: 0 };
  const ids = lista.map((c) => c.id);
  const leadsPor = new Map<string, Array<{ conversation_id: string | null; name: string | null; contact: string | null; notes: string | null; metadata: string | null; intent: string | null }>>();
  const citas = new Set<string>();
  for (let i = 0; i < ids.length; i += 80) {
    const lote = ids.slice(i, i + 80);
    for (const l of await db.all<{ conversation_id: string | null; name: string | null; contact: string | null; notes: string | null; metadata: string | null; intent: string | null }>(
      `SELECT conversation_id, name, contact, notes, metadata, intent FROM leads WHERE conversation_id IN (${lote.map(() => "?").join(",")})`, lote)) {
      if (!l.conversation_id) continue;
      if ((l.intent ?? "").startsWith("Cita ·")) { citas.add(l.conversation_id); continue; }
      const a = leadsPor.get(l.conversation_id) ?? [];
      a.push(l);
      leadsPor.set(l.conversation_id, a);
    }
  }
  // La cotización solo sale si el cliente la pide: el bot deja un aviso interno con el motivo «Cliente pide cotización».
  const cotizadas = new Set<string>();
  for (const r of await db.all<{ conversation_id: string }>("SELECT DISTINCT conversation_id FROM tickets WHERE summary LIKE '[Cliente pide cotizaci%' AND conversation_id IS NOT NULL").catch(() => [])) cotizadas.add(r.conversation_id);
  const { cargarLlamadas } = await import("./crm-calendario.local");
  const conectadas = new Set((await cargarLlamadas(env, now)).filter((l) => l.estado === "pasada").map((l) => l.convId));
  const analizadas = new Set((await db.all<{ conversation_id: string }>("SELECT DISTINCT conversation_id FROM crm_llamada_resultado").catch(() => [])).map((r) => r.conversation_id));

  for (const c of lista) {
    let meta: Record<string, unknown> = {};
    try { meta = c.metadata ? JSON.parse(c.metadata) : {}; } catch { /* sin metadatos */ }
    const canal = esWhatsApp(c.channel, c.channel_user_id) ? "WhatsApp" : "Instagram";
    const [lead] = armarLeads([{ id: c.id, channel: c.channel, channel_user_id: c.channel_user_id, display_name: c.display_name, last_message_at: c.last_message_at }], leadsPor.get(c.id) ?? []);
    const cal = lead ? evaluarCalificacion(lead.ficha.metadata) : null;
    const preguntas = !!cal && cal.faltan.filter((k) => BASE_PREGUNTAS.includes(k)).length === 0;
    const hechos: Record<PasoId, boolean> = {
      escribe: true,
      conversa: c.n >= 3,
      preguntas,
      califica: preguntas && !!lead && lead.prioridad.nivel !== "frio",
      agenda: citas.has(c.id) || !!lead?.llamada,
      conecta: conectadas.has(c.id) || analizadas.has(c.id),
      formulario: FORMULARIO.includes(String(meta.zoho_estado ?? "")),
      cerrado: meta.crm_etapa === "cerrado",
    };
    for (const p of PASOS) if (hechos[p.id]) { total[p.id]++; porCanal[canal][p.id]++; }
  }
  return { dias, total, porCanal, pidieronCotizacion: lista.filter((c) => cotizadas.has(c.id)).length };
}

export async function renderCrmEmbudo(env: Env, dias: number, now = Date.now()): Promise<string> {
  const periodo = [7, 30, 90].includes(dias) ? dias : 30;
  const e = await calcularEmbudo(env, periodo, now);
  const max = Math.max(1, e.total.escribe);
  const filas = PASOS.map((p, i) => {
    const n = e.total[p.id];
    const ant = i === 0 ? n : e.total[PASOS[i - 1].id];
    const pasa = i === 0 || ant === 0 ? "" : `${Math.round((n / ant) * 100)}% del paso anterior`;
    const pierde = i === 0 ? 0 : ant - n;
    const wa = e.porCanal.WhatsApp[p.id], ig = e.porCanal.Instagram[p.id];
    return `<div style="display:grid;grid-template-columns:220px 1fr 150px;gap:14px;align-items:center;padding:8px 0;border-bottom:1px dashed var(--line)">
      <div><b style="color:var(--cream);font-size:13px">${esc(p.nombre)}</b><div class="text-dim" style="font-size:10.5px">${esc(p.ayuda)}</div></div>
      <div><div style="background:var(--accent);height:20px;border-radius:5px;width:${Math.max(2, Math.round((n / max) * 100))}%;display:flex;align-items:center;padding-left:8px;font-weight:700;font-size:12px;color:var(--bg)">${n}</div>
        <div class="text-dim" style="font-size:10.5px;margin-top:3px">WhatsApp ${wa} · Instagram ${ig}</div></div>
      <div style="font-size:11.5px">${pasa ? `<span class="text-muted">${pasa}</span>` : ""}${pierde > 0 ? `<br><span style="color:var(--bad)">−${pierde} se pierden aquí</span>` : ""}</div></div>`;
  }).join("");
  const tab = (d: number) => `<a class="crm-in" href="/crm/embudo?dias=${d}" style="text-decoration:none;font-size:12px;padding:6px 12px;${d === periodo ? "background:var(--accent);color:var(--bg);font-weight:700" : ""}">Últimos ${d} días</a>`;
  const body = `${ESTILO_CRM}
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">${[7, 30, 90].map(tab).join("")}</div>
    <div class="text-dim" style="font-size:12.5px;margin-bottom:12px;line-height:1.55">De las personas que <b>escribieron por primera vez</b> en el periodo, cuántas llegan a cada paso. Los que escribieron hace pocos días todavía pueden avanzar. Los números colombianos no cuentan.</div>
    <div class="crm-card" style="padding:14px 18px">${filas}</div>
    <div class="crm-card" style="padding:12px 18px;margin-top:12px;font-size:13px">🧾 <b>${e.pidieronCotizacion}</b> ${e.pidieronCotizacion === 1 ? "cliente pidió" : "clientes pidieron"} una cotización en este periodo. <span class="text-dim">No es un paso del recorrido: solo se prepara si el cliente la pide (el bot deja un aviso interno).</span></div>`;
  return crmLayout({ title: "Recorrido del cliente", activa: "embudo", body, env });
}
