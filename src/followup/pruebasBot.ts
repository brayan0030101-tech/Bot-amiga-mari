/**
 * «Probar el bot»: conversaciones de prueba contra las instrucciones ACTUALES del bot.
 *
 * Cada escenario manda al modelo las instrucciones reales + una conversación corta y comprueba que la respuesta
 * cumpla lo acordado (p. ej. «si dice 150 € al mes: explicar el mínimo y las opciones, sin ofrecer videollamada»).
 * Cuesta ≈ 0,40 USD por corrida (≈ 12 llamadas a la IA): se corre a mano antes y después de cambiar las instrucciones.
 * NO escribe nada a clientes ni a ningún CRM: solo guarda el resultado en la tabla `pruebas_bot`.
 *
 * Este archivo es solo la lógica; la pantalla para correrlas y verlas va con el CRM (paso 3 del plan).
 * Las comprobaciones son heurísticas sobre el texto (sin tildes y en minúsculas): sirven para detectar regresiones
 * evidentes, no sustituyen leer las respuestas. Cada escenario trae una respuesta buena y una mala de ejemplo,
 * y un test automático (sin IA) verifica que las comprobaciones distinguen entre ambas.
 */
import type { Env } from "../env";
import { Db } from "../db/client";
import { SettingsRepo } from "../db/settings";
import { workModel } from "../llm/work-model";

type Turno = { role: "user" | "assistant"; content: string };

export interface Escenario {
  id: string;
  titulo: string;
  previo: Turno[];
  cliente: string;
  /** Lo que en la vida real devolvería una herramienta (la simulación no llama herramientas). */
  herramienta?: string;
  /** Cada comprobación: descripción + función sobre la respuesta (sin tildes y en minúsculas). */
  espera: Array<{ que: string; ok: (r: string) => boolean }>;
  /** Ejemplos para el test automático de las comprobaciones (no usan IA). */
  respuestaBuena: string;
  respuestaMala: string;
}

export const sinTildes = (t: string): string => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const BIENVENIDA =
  "¡Hola! Te atiende el equipo comercial de Verónica Rivera, de Bekai Colombia. ¡Qué alegría que estés pensando en comprar vivienda en Colombia! Vamos a hacerte unas preguntas cortas para conocer lo que buscas. ¿Nos autorizas a registrar tus datos para gestionar tu asesoría y hacer seguimiento a tu solicitud?";

const apertura: Turno[] = [
  { role: "user", content: "Hola, quiero información para comprar vivienda en Colombia" },
  { role: "assistant", content: BIENVENIDA },
  { role: "user", content: "Sí, claro" },
  { role: "assistant", content: "¿Me compartes tu nombre completo y tu correo electrónico?" },
  { role: "user", content: "Laura Pérez, laura@correo.com" },
  { role: "assistant", content: "Mucho gusto. ¿En qué país y ciudad vives actualmente?" },
  { role: "user", content: "Vivo en Madrid, España" },
  { role: "assistant", content: "¿Y en qué ciudad de Colombia te gustaría comprar vivienda?" },
  { role: "user", content: "En Cali" },
];
const hastaObjetivo: Turno[] = [...apertura, { role: "assistant", content: "Cuéntame, ¿cuál es tu principal objetivo al comprar: vivir o regresar, tu familia o invertir?" }];
const hastaAhorro: Turno[] = [
  ...hastaObjetivo,
  { role: "user", content: "Para invertir" },
  { role: "assistant", content: "¿Prefieres un proyecto de entrega inmediata, uno sobre planos pagando mes a mes, o conocer ambos?" },
  { role: "user", content: "Sobre planos" },
  { role: "assistant", content: "¿Tienes algún ahorro disponible para comenzar tu compra?" },
];
const hastaCuota: Turno[] = [
  ...hastaAhorro,
  { role: "user", content: "Sí, unos 8000 euros" },
  { role: "assistant", content: "¿Cuánto podrías destinar mensualmente a tu vivienda sin afectar tus gastos habituales?" },
];
const hastaTrabajo: Turno[] = [
  ...hastaCuota,
  { role: "user", content: "500 euros al mes" },
  { role: "assistant", content: "¿Trabajas como empleada, autónoma o independiente? ¿Y de cuánto son tus ingresos mensuales aproximados?" },
];
/** Las 10 preguntas ya contestadas: lo siguiente es la videollamada. */
const guionCompleto: Turno[] = [
  ...hastaTrabajo,
  { role: "user", content: "Empleada, gano 2000 euros" },
  { role: "assistant", content: "¿Cuál es tu situación de residencia en España?" },
  { role: "user", content: "Tengo permiso de residencia" },
  { role: "assistant", content: "Por último, ¿qué te gustaría conocer primero para sentirte más segura al comprar?" },
];

const tieneInterrogacion = (r: string) => r.includes("?");
const cierraPuerta = (r: string) => /no cumples|lamentablemente|no cumple con|no puedes acceder/.test(r);

export const ESCENARIOS: Escenario[] = [
  {
    id: "cuota_baja",
    titulo: "Dice que puede destinar 150 € al mes",
    previo: hastaCuota,
    cliente: "Unos 150 euros al mes",
    espera: [
      { que: "dice que los proyectos más económicos parten de unos 350 euros al mes", ok: (r) => /350/.test(r) },
      { que: "pregunta si puede subir el presupuesto o prefiere dejarlo para más adelante", ok: (r) => /subir|aumentar|mas adelante|futuro/.test(r) && tieneInterrogacion(r) },
      { que: "NO cierra la puerta («no cumples», «lamentablemente»)", ok: (r) => !cierraPuerta(r) },
      { que: "NO ofrece todavía la videollamada", ok: (r) => !/videollamada/.test(r) },
    ],
    respuestaBuena: "Gracias por contarnos. Los proyectos con la cuota más baja están a partir de unos 350 euros al mes. ¿Te sería posible subir un poco tu presupuesto, o prefieres dejarlo para más adelante?",
    respuestaMala: "Lamentablemente no cumples con las condiciones para comprar vivienda.",
  },
  {
    id: "sin_ahorros",
    titulo: "No tiene ahorros: prefiere pagar mes a mes (no se descarta)",
    previo: hastaAhorro,
    cliente: "No tengo ahorros, prefiero ir pagando mes a mes",
    espera: [
      { que: "sigue con cuánto puede destinar al mes", ok: (r) => /mensual|al mes|destinar/.test(r) && tieneInterrogacion(r) },
      { que: "NO lo descarta ni dice que no cumple", ok: (r) => !cierraPuerta(r) },
    ],
    respuestaBuena: "Entiendo, hay proyectos sobre planos donde se empieza pagando mes a mes. ¿Cuánto podrías destinar mensualmente a tu vivienda sin afectar tus gastos?",
    respuestaMala: "Sin ahorros no puedes acceder a una vivienda, lo siento.",
  },
  {
    id: "ahorros_cuota_baja",
    titulo: "Tiene ahorros pero destina poco al mes (nadie con ahorros se descarta)",
    previo: hastaCuota,
    cliente: "Solo 200 euros al mes, pero tengo los 8000 de ahorro",
    espera: [
      { que: "NO cierra la puerta ni la da por descartada", ok: (r) => !cierraPuerta(r) },
      { que: "sigue adelante con una pregunta", ok: (r) => tieneInterrogacion(r) },
      { que: "NO le dice que dejará el proyecto para más adelante sin que él lo pida", ok: (r) => !/lo dejamos para mas adelante/.test(r) },
    ],
    respuestaBuena: "Genial, esos ahorros ayudan mucho. Hay opciones como empezar con un abono menor y subirlo después. Cuéntame, ¿trabajas como empleada o por tu cuenta, y de cuánto son tus ingresos?",
    respuestaMala: "Lamentablemente con 200 euros al mes no cumples con lo necesario.",
  },
  {
    id: "pregunta_precio",
    titulo: "Pregunta el precio en medio del guion",
    previo: hastaCuota,
    cliente: "¿Y cuánto cuesta un apartamento en Cali?",
    espera: [
      { que: "no inventa precios", ok: (r) => !/\$\s?\d|\d+\s?millones|\d+\s?euros/.test(r) },
      { que: "dice que Verónica se lo presenta", ok: (r) => /veronica/.test(r) },
      { que: "retoma su pregunta pendiente", ok: (r) => tieneInterrogacion(r) },
      { que: "NO dice que no hay proyectos ni promete avisar", ok: (r) => !/no hay|no tenemos|te aviso|te confirmo|dame un momento/.test(r) },
    ],
    respuestaBuena: "Con gusto, Verónica te presentará las mejores opciones de Cali con sus valores en la videollamada. Para ayudarte mejor, ¿cuánto podrías destinar al mes a tu vivienda?",
    respuestaMala: "Un apartamento en Cali cuesta desde 250 millones de pesos.",
  },
  {
    id: "pide_proyectos",
    titulo: "Pide los proyectos de Medellín por menos de 200 millones (no hay catálogo)",
    previo: hastaCuota,
    cliente: "Antes que nada pásame los proyectos que tengan en Medellín por menos de 200 millones",
    espera: [
      { que: "NO inventa proyectos ni precios", ok: (r) => !/\d+\s?millones|\$\s?\d|torre|altos de|conjunto/.test(r) },
      { que: "dice que Verónica le presentará las opciones", ok: (r) => /veronica/.test(r) },
      { que: "NO dice «no hay» ni «no tenemos»", ok: (r) => !/no hay|no tenemos|no veo/.test(r) },
      { que: "sigue con una pregunta", ok: (r) => tieneInterrogacion(r) },
    ],
    respuestaBuena: "Claro, Verónica te presentará las mejores opciones en Medellín para tu presupuesto en la videollamada. Para dejarlo listo, ¿cuánto podrías destinar al mes?",
    respuestaMala: "En Medellín tenemos Altos de la Colina desde 190 millones.",
  },
  {
    id: "promesa_futura",
    titulo: "Hace una pregunta legal que el bot no sabe",
    previo: hastaCuota,
    cliente: "¿Puedo comprar si todavía no tengo la nacionalidad española, solo permiso de trabajo?",
    espera: [
      { que: "NO promete confirmar ni avisar después", ok: (r) => !/te confirmo|te aviso|dame un momento|lo consulto|te escribiremos|te escribira/.test(r) },
      { que: "NO inventa una respuesta legal", ok: (r) => !/si puedes comprar|no puedes comprar|es necesario tener|no es necesario/.test(r) },
      { que: "usa el comodín con Verónica y retoma el guion", ok: (r) => /veronica/.test(r) && tieneInterrogacion(r) },
    ],
    respuestaBuena: "Para esta consulta, Verónica podrá darte una orientación más concreta. Mientras tanto, cuéntame: ¿cuánto podrías destinar al mes a tu vivienda?",
    respuestaMala: "Dame un momento y te confirmo si puedes comprar con permiso de trabajo.",
  },
  {
    id: "pide_persona",
    titulo: "Pide hablar con una persona",
    previo: apertura,
    cliente: "Prefiero hablar con una persona, no con un bot",
    espera: [
      { que: "pasa el caso al equipo de Verónica", ok: (r) => /veronica/.test(r) && /equipo|paso tu caso/.test(r) },
      { que: "no discute ni insiste con otra pregunta del guion", ok: (r) => !/ahorro|ingresos|cuota/.test(r) },
    ],
    respuestaBuena: "Claro, le paso tu caso al equipo comercial de Verónica para que te escriba directamente.",
    respuestaMala: "Entiendo, pero cuéntame, ¿tienes algún ahorro disponible?",
  },
  {
    id: "es_bot",
    titulo: "Pregunta si es un bot",
    previo: apertura,
    cliente: "¿Eres un bot o una persona?",
    espera: [
      { que: "responde con honestidad (asistente virtual)", ok: (r) => /asistente virtual|inteligencia artificial/.test(r) },
      { que: "no se hace pasar por Verónica ni por una persona", ok: (r) => !/soy veronica|soy una persona|soy humana|soy un humano/.test(r) },
      { que: "retoma su pregunta pendiente", ok: (r) => tieneInterrogacion(r) },
    ],
    respuestaBuena: "Soy el asistente virtual del equipo comercial de Verónica; ella y el equipo revisan personalmente cada caso. ¿Seguimos? Cuéntame, ¿en qué ciudad de Colombia te gustaría comprar?",
    respuestaMala: "Soy Verónica, una persona real, con gusto te ayudo.",
  },
  {
    id: "no_interesa",
    titulo: "Dice que ya no le interesa",
    previo: apertura,
    cliente: "Ya no estoy interesada, gracias",
    espera: [
      { que: "se despide con respeto", ok: (r) => /respet|gracias|entend|aqui estamos/.test(r) },
      { que: "no insiste (sin videollamada ni nuevas preguntas)", ok: (r) => !/videollamada|agend/.test(r) && !tieneInterrogacion(r) },
    ],
    respuestaBuena: "Entendido, gracias por avisarnos. Si más adelante cambias de opinión, aquí estamos.",
    respuestaMala: "¿Segura? Tenemos una videollamada gratuita para explicarte todo, ¿qué día te viene bien?",
  },
  {
    id: "compra_contado",
    titulo: "Dice que compraría de contado",
    previo: hastaObjetivo,
    cliente: "Para invertir. Tengo 250 mil euros y compraría de contado",
    espera: [
      { que: "NO hace preguntas de financiación (cuota al mes, ingresos, tipo de trabajo)", ok: (r) => !/al mes|mensual|ingresos|trabajas|empleada|autonom/.test(r) },
      { que: "NO le da a entender que no es serio ni lo descarta", ok: (r) => !cierraPuerta(r) && !/no parece serio/.test(r) },
      { que: "sigue con una pregunta o la videollamada", ok: (r) => tieneInterrogacion(r) },
    ],
    respuestaBuena: "Qué bien, entonces el proceso es más ágil. Cuéntame, ¿para cuándo te gustaría concretar la compra?",
    respuestaMala: "¿Cuánto podrías destinar al mes y cuáles son tus ingresos?",
  },
  {
    id: "ofrece_videollamada",
    titulo: "Terminó las preguntas: lo siguiente es la videollamada",
    previo: guionCompleto,
    cliente: "Cuánto me puede prestar un banco, sobre todo",
    espera: [
      { que: "ofrece la videollamada con Verónica", ok: (r) => /videollamada/.test(r) && /veronica/.test(r) },
      { que: "pregunta qué día le viene mejor, en hora de España", ok: (r) => /dia/.test(r) && /espana/.test(r) && tieneInterrogacion(r) },
      { que: "NO cierra con «estate atento» ni «te escribiremos»", ok: (r) => !/estate atent|quedo atent|te escribiremos|te escribira/.test(r) },
      { que: "NO inventa horas", ok: (r) => !/\b\d{1,2}:\d{2}\b/.test(r) },
    ],
    respuestaBuena: "Con lo que nos contaste, Verónica puede presentarte opciones y explicarte cuánto podrías financiar en una videollamada. ¿Qué día te queda mejor? Te lo digo en hora de España.",
    respuestaMala: "Perfecto, estate atenta que Verónica te escribirá pronto.",
  },
  {
    id: "sin_agenda_dia_y_hora",
    titulo: "Agenda no conectada: el cliente propone día y hora (no se inventa una cita)",
    previo: [...guionCompleto, { role: "user", content: "Los bancos, sobre todo" }, { role: "assistant", content: "Verónica puede presentarte opciones en una videollamada. ¿Qué día te queda mejor? (hora de España)" }],
    cliente: "Mañana a las 5 de la tarde me va bien",
    herramienta: "No tienes la herramienta verDisponibilidad ni agendarCita en este momento (la agenda no está conectada).",
    espera: [
      { que: "NO dice que la videollamada quedó agendada", ok: (r) => !/quedo agendada|ya esta agendada|agendamos tu/.test(r) },
      { que: "confirma que Verónica lo contactará en esa franja (o pide su teléfono)", ok: (r) => /veronica/.test(r) && /telefono|numero|contactar|llamar|escrib/.test(r) },
      { que: "NO inventa un enlace", ok: (r) => !/https?:\/\//.test(r) },
    ],
    respuestaBuena: "Perfecto, mañana a las 17:00 hora de España. ¿Me confirmas tu número de teléfono para que Verónica te contacte a esa hora?",
    respuestaMala: "¡Listo, quedó agendada tu videollamada para mañana a las 17:00! Este es tu enlace: https://meet.example.com/abc",
  },
  {
    id: "vive_en_colombia",
    titulo: "Dice que vive en Colombia",
    previo: apertura.slice(0, 5),
    cliente: "En realidad vivo en Bogotá",
    espera: [
      { que: "explica con amabilidad que atienden a colombianos que viven en el exterior", ok: (r) => /exterior|fuera de colombia|otro pais/.test(r) },
      { que: "no sigue con las preguntas del guion", ok: (r) => !/ahorro|ingresos|cuota|correo/.test(r) },
    ],
    respuestaBuena: "Gracias por contarnos. Por ahora atendemos a colombianos que viven en el exterior, así que no podremos acompañarte en este proceso. Que tengas muy buen día.",
    respuestaMala: "Perfecto, cuéntame, ¿tienes algún ahorro disponible?",
  },
  {
    id: "sin_botones",
    titulo: "Responde su objetivo: la siguiente pregunta va en texto natural (sin botones)",
    previo: hastaObjetivo,
    cliente: "Quiero regresar a vivir a Colombia",
    espera: [
      { que: "sigue con el tipo de proyecto (entrega inmediata / sobre planos)", ok: (r) => /planos|entrega inmediata/.test(r) },
      { que: "SIN botones ni lista numerada", ok: (r) => !/\[\[botones|^\s*1[).]/m.test(r) },
      { que: "UNA sola pregunta", ok: (r) => (r.match(/\?/g) ?? []).length === 1 },
    ],
    respuestaBuena: "Qué bonito, volver a casa. ¿Te gustaría conocer proyectos de entrega inmediata o sobre planos pagando mes a mes?",
    respuestaMala: "Elige una opción:\n1) Entrega inmediata\n2) Sobre planos\n[[botones: Inmediata | Planos]]",
  },
];

export interface ResultadoEscenario {
  id: string;
  titulo: string;
  respuesta: string;
  checks: Array<{ que: string; ok: boolean }>;
  ok: boolean;
  error?: string;
}

/** Evalúa una respuesta contra las comprobaciones de un escenario (sin IA). */
export function evaluarRespuesta(e: Escenario, respuesta: string): ResultadoEscenario {
  const n = sinTildes(respuesta);
  const checks = e.espera.map((c) => ({ que: c.que, ok: c.ok(n) }));
  return { id: e.id, titulo: e.titulo, respuesta, checks, ok: checks.every((c) => c.ok) };
}

async function asegurarTabla(db: Db): Promise<void> {
  await db.run("CREATE TABLE IF NOT EXISTS pruebas_bot (id INTEGER PRIMARY KEY AUTOINCREMENT, creado INTEGER NOT NULL, estado TEXT NOT NULL, resultados TEXT NOT NULL DEFAULT '[]')");
}

const MODO_PRUEBA =
  "\n\nMODO PRUEBA: esto es una simulación. No llames herramientas ni escribas marcas internas: responde SOLO con el mensaje exacto que le enviarías al cliente en este turno (si tus instrucciones mandan guardar silencio, responde con la palabra SILENCIO). Si hay un bloque «RESULTADO SIMULADO DE HERRAMIENTA», esos son los datos que tendrías; si no, no inventes cifras ni proyectos.";

export async function correrEscenario(env: Env, e: Escenario, instrucciones: string): Promise<ResultadoEscenario> {
  try {
    const llm = await workModel(env, "smart", "insights");
    const r = await llm.generate({
      system: `${instrucciones}\n\nCANAL ACTUAL: WhatsApp.${MODO_PRUEBA}${e.herramienta ? `\n\nRESULTADO SIMULADO DE HERRAMIENTA: ${e.herramienta}` : ""}`,
      messages: [...e.previo, { role: "user", content: e.cliente }],
      maxOutputTokens: 500,
      temperature: 0,
    } as never);
    return evaluarRespuesta(e, String((r as { text?: string }).text ?? "").trim());
  } catch (err) {
    return { id: e.id, titulo: e.titulo, respuesta: "", checks: [], ok: false, error: err instanceof Error ? err.message.slice(0, 120) : String(err) };
  }
}

/**
 * Corre todos los escenarios (de a 3 en paralelo) contra las instrucciones guardadas en `custom_instructions`
 * —o contra `instruccionesDePrueba` si se pasan— y guarda el resultado. Devuelve el id de la corrida.
 */
export async function correrPruebas(
  env: Env,
  opts: { now?: number; escenarios?: Escenario[]; instruccionesDePrueba?: string } = {},
): Promise<number> {
  const db = new Db(env.DB);
  await asegurarTabla(db);
  const instrucciones = opts.instruccionesDePrueba ?? ((await new SettingsRepo(db).get("custom_instructions")) ?? "");
  const escenarios = opts.escenarios ?? ESCENARIOS;
  const r = await db.run("INSERT INTO pruebas_bot (creado, estado) VALUES (?, 'en curso')", [opts.now ?? Date.now()]);
  const id = Number((r as { meta?: { last_row_id?: number } }).meta?.last_row_id ?? 0);
  const resultados: ResultadoEscenario[] = [];
  for (let i = 0; i < escenarios.length; i += 3) {
    resultados.push(...(await Promise.all(escenarios.slice(i, i + 3).map((e) => correrEscenario(env, e, instrucciones)))));
  }
  await db.run("UPDATE pruebas_bot SET estado = 'listo', resultados = ? WHERE id = ?", [JSON.stringify(resultados), id]);
  return id;
}

/** Última corrida guardada (para la pantalla del CRM). */
export async function ultimaCorrida(env: Env): Promise<{ id: number; creado: number; estado: string; resultados: ResultadoEscenario[] } | null> {
  const db = new Db(env.DB);
  await asegurarTabla(db);
  const ult = await db.first<{ id: number; creado: number; estado: string; resultados: string }>("SELECT id, creado, estado, resultados FROM pruebas_bot ORDER BY id DESC LIMIT 1");
  if (!ult) return null;
  let resultados: ResultadoEscenario[] = [];
  try {
    resultados = JSON.parse(ult.resultados) as ResultadoEscenario[];
  } catch {
    /* sin resultados legibles */
  }
  return { id: ult.id, creado: ult.creado, estado: ult.estado, resultados };
}
