// member/crm-pruebas.local.ts — pantalla «Probar el bot»: conversaciones de prueba contra las instrucciones ACTUALES del bot.
// La lógica (escenarios, comprobaciones y la corrida) vive en src/followup/pruebasBot.ts; aquí solo se pinta.
// Cada corrida usa la IA (≈ 20 llamadas, ≈ 0,55 USD) y no escribe nada a clientes ni a ningún CRM.
import type { Env } from "../src/env";
import { ESCENARIOS, correrPruebas, ultimaCorrida } from "../src/followup/pruebasBot";
import { crmLayout } from "./crm-shell.local";
import { esc, ESTILO_CRM, fechaHora } from "./crm.local";

export { correrPruebas };

export async function renderPruebas(env: Env, opts: { aviso?: string } = {}): Promise<string> {
  const ult = await ultimaCorrida(env);
  const res = ult?.resultados ?? [];
  const bien = res.filter((r) => r.ok).length;
  const tarjetas = res
    .map(
      (r) => `<div class="crm-card" style="padding:12px 16px;margin-bottom:8px;border-left:4px solid ${r.ok ? "var(--ok)" : "var(--bad)"}">
      <div style="font-weight:700;color:var(--cream)">${r.ok ? "✅" : "❌"} ${esc(r.titulo)}</div>
      ${r.error ? `<div style="color:var(--bad);font-size:12px">Error: ${esc(r.error)}</div>` : ""}
      <div class="text-muted" style="font-size:12px;margin:6px 0;white-space:pre-wrap">${esc(r.respuesta)}</div>
      <div style="font-size:11.5px">${r.checks.map((c) => `<div style="color:${c.ok ? "var(--ok)" : "var(--bad)"}">${c.ok ? "✔" : "✘"} ${esc(c.que)}</div>`).join("")}</div></div>`,
    )
    .join("");
  const body = `${ESTILO_CRM}
    ${opts.aviso ? `<div class="crm-card" style="padding:10px 14px;margin-bottom:12px;color:var(--ok);font-size:12.5px">${esc(opts.aviso)}</div>` : ""}
    <div class="text-dim" style="font-size:12.5px;margin-bottom:12px;line-height:1.55">Pone a prueba las instrucciones <b>actuales</b> del bot con ${ESCENARIOS.length} conversaciones típicas (cuota baja, Datacrédito, pide cotización, pregunta si es un bot, vive en Colombia…) y comprueba que la respuesta cumpla lo acordado. No escribe a ningún cliente ni a ningún CRM. Es una guía para detectar regresiones; no sustituye leer las respuestas.</div>
    <form method="POST" action="/crm/pruebas/correr" style="margin-bottom:16px" onsubmit="return confirm('Esto usa la IA unas ${ESCENARIOS.length} veces (≈ 0,55 USD). ¿Correr las pruebas?')"><button class="bigbtn" style="background:var(--accent);color:var(--bg);padding:9px 18px;border:0;font-weight:700;font-size:13px">▶ Correr las pruebas (≈ 0,55 USD)</button></form>
    ${ult ? `<div style="margin-bottom:10px;font-size:13px"><b>Última corrida:</b> ${esc(fechaHora(ult.creado))} · ${ult.estado === "en curso" ? "⏳ en curso (recarga en un par de minutos)" : `${bien} de ${res.length} bien`}</div>${tarjetas}` : `<div class="text-dim" style="font-size:13px">Todavía no se ha corrido ninguna prueba.</div>`}`;
  return crmLayout({ title: "Probar el bot", activa: "pruebas", body, env });
}
