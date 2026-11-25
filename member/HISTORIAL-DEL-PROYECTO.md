# Historial del proyecto — bot de Verónica Rivera (Bekai Colombia)

> Bitácora de todo lo que se hace, en orden. Para saber **cómo está hoy** el bot, lee `ESTADO-DEL-BOT.md`.
> Aquí no van llaves, ids de Telegram ni datos de clientes. Una entrada por cada cambio.

## 10 de octubre de 2026 — nace como bot independiente
- Se parte del código del bot de otra asesora de la misma empresa (sistema base Forja 1.0.77, mismo guion y tono) y se quitan todos sus nombres, números y recursos (`refactor: bot independiente…`, `chore: aislar…`, `wrangler.toml sin referencias…`).
- Las horas del bot salen de `BOT_TIMEZONE`; zona decidida: **Europe/Madrid** (también `CALCOM_TIMEZONE` y `member/config.local.ts`).

## 12 de octubre de 2026 — identidad y base de datos propia
- Identidad: asesora **Verónica Rivera**, marca **Bekai Colombia**, `BOT_NAME = Verónica`.
- Creados en Cloudflare la base D1 `horizontes_bot_amiga_mari_db` y el índice Vectorize `horizontes_bot_amiga_mari_kb`; esquema aplicado.

## 14 de octubre de 2026 — WhatsApp por Zernio
- Worker `forja-amiga-mari` desplegado con sus llaves (IA, contraseña del panel, índice, Zernio).
- Webhook de Zernio registrado (`/webhooks/zernio`, evento `message.received`) y probado.
- Número de WhatsApp de Verónica conectado por Zernio en **coexistencia** (el número sigue también en la app WhatsApp Business del teléfono).
- Incidente: al conectar, el bot contestó a dos chats personales de Verónica. **Pausa general** del bot por pedido de Verónica hasta que arranque su campaña.

## 15 de octubre de 2026 — la pausa general frena todo
- Con la pausa puesta salió igual un mensaje automático («pedir teléfono») a 4 chats: el sistema de atención no miraba la pausa.
- Arreglo desplegado: con la pausa general no sale nada al cliente (automatismos, recordatorio de citas, aviso de mensaje repetido, aviso de archivo) y los mensajes recibidos no se acumulan para contestarse al reactivar. Prueba actualizada (`test/agent.media.test.ts`).

## 23 de noviembre de 2026 — paso 0 del plan «mismo enfoque que el bot de la otra asesora»
- Revisión completa de los dos repositorios (tabla «Ya está / Falta / Se deja fuera» entregada a Brayan) y plan aprobado.
- Decisiones de Brayan: Verónica usa **el mismo Zoho** de la empresa que la otra asesora (con sus propios permisos y su función `enviar_formulario_bot`); se **mantiene la regla de no responder ni escribir nunca a números de Colombia** (+57 y usuarios «CO.…»); se deja fuera la oferta de seguros ERGO|DKV.
- La rama de trabajo de octubre (Zernio y arreglo de la pausa) se lleva a `main`, que estaba atrasada respecto de lo desplegado.
- Creado este historial.
- Pendiente de Brayan: pasar el repositorio a **privado** (GitHub → Settings → Danger Zone → Change visibility). No hay herramienta en la sesión para hacerlo.

## 23 de noviembre de 2026 — paso 1: fiabilidad del núcleo (código y pruebas, SIN desplegar)
Traído del bot de referencia y adaptado a Zernio (WhatsApp de Verónica). Nada nuevo escribe a clientes por sí solo; el bot sigue en pausa general.
- **Regla de Colombia** (`src/lib/colombia.ts`): lo que llega de +57 / «CO.…» por WhatsApp se ignora y nunca se le envía nada (respuestas, plantillas, recordatorios), en Zernio y en YCloud. Si una persona escribe desde el panel a un número así, el panel avisa que NO salió.
- **No perder mensajes**: si un mensaje no llega al agente se reintenta una vez; si vuelve a fallar se quita la marca de duplicado y se responde 500 para que Zernio lo reenvíe (`ingestOne`, `olvidarMensaje`). Riesgo a vigilar: Zernio apaga el webhook tras 10 fallos seguidos.
- **Fallos de envío por Zernio**: quedan en la tabla `envios_fallidos` y avisan al equipo (máx. 1 cada 30 min). Toque de botón sin texto llega como su título (quita «btn:»). Enlaces sin letras pegadas (`src/lib/enlaces.ts`).
- **Turno del agente**: un solo turno a la vez por conversación; el error real de la IA se guarda (antes «No output generated»); si el último paso solo dice «Listo, guardado» se manda la pregunta del paso anterior; confirmación con enlace garantizada al reservar videollamada (`src/lib/confirmacionLlamada.ts`, con el nombre del bot, sin otra asesora) y el Blindaje no la frena; envío con 3 intentos y, si falla, se borra la respuesta guardada; el reintento por fallo de IA funciona aunque el agente sea nuevo; el verificador anti-invento lee hasta 80.000 caracteres de instrucciones; el modelo sabe si la conversación de Zernio es WhatsApp o Instagram.
- **Agenda (Cal.com)**: días bloqueados con el ajuste `agenda_dias_bloqueados` (fechas AAAA-MM-DD separadas por coma); enlace de Meet de la reserva; nota con la hora acordada y la hora local del cliente; aviso si Cal.com guardó otra hora; `sincronizarCitas` antes de los recordatorios: cita cancelada → sin recordatorio; reprogramada → recordatorios en la fecha nueva.
- **Horario del cliente** (`src/lib/horarioCliente.ts`): los mensajes que inicia el bot (seguimientos, recordatorio de 24 h, pedir datos, reenganche, encuestas) solo de 9 a 21 h en la hora LOCAL del cliente (ficha → prefijo del teléfono de WhatsApp → España). El de 1 h antes de la llamada no se frena.
- **Botones apagables**: ajuste `bot_botones = apagado` quita todos los botones sin convertirlos en lista.
- Pruebas: 1.561 pasan (antes 1.525), sin errores de tipos. Pruebas nuevas: colombia, enlaces, botones, confirmacionLlamada, horarioCliente, sincronizarCitas, días bloqueados de Cal.com, Zernio (Colombia, botón, envío bloqueado).
- NO traído en este paso (va en pasos siguientes o queda fuera): auditor y sus hallazgos, guardián de instrucciones (paso 2), lo propio de YCloud (error 131000, saldo, sincronizar la app), «si tras el recordatorio pide reprogramar no mandar el de 1 h» (va con el sistema de atención nuevo, paso 5).

## 23 de noviembre de 2026 — paso 2: reglas del bot (borrador SIN guardar, SIN desplegar)
- **Reglas de Verónica reescritas desde cero** (`member/reglas-del-bot.txt`, ≈ 24.000 caracteres; las del bot de referencia tenían ≈ 62.000 por parches acumulados). Están pensadas para las herramientas que existen HOY: `captureLead`, `handoffHuman`, `pauseBot` y, cuando se conecte Cal.com, `verDisponibilidad`/`agendarCita`/`cancelarCita`. Si no hay agenda, el bot pide día y hora y deja un aviso para que Verónica llame (no inventa citas).
- Cambios de fondo respecto al bot de referencia: sin catálogo ni cotización automática (el bot no habla de proyectos concretos ni precios; los deja para la videollamada); sin botones; sin preguntas de Datacrédito (se guardan si el cliente las menciona); sin flujo de Instagram, de plantillas ni de estudio de viabilidad (dependen de herramientas de pasos posteriores); y una regla nueva: guardar datos SOLO con `captureLead` (la plataforma trae `calificarComprador`/`registrarVisita`, que crean fichas duplicadas).
- Se mantiene lo que más importa: honestidad si preguntan si es un bot, una pregunta por mensaje, nunca cerrar la puerta, nadie con ahorros se descarta, reagendar siempre lo hace el bot, notas en primera persona, no prometer respuestas futuras.
- **Guardián de las reglas** (`src/followup/guardianInstrucciones.ts`): guarda copia cada vez que cambian (últimas 40), avisa al equipo si falta una regla imprescindible (14 marcadores) o si el texto se encoge más de 10 %, y permite restaurar. Corre dentro del ciclo interno, también con el bot en pausa.
- **Conversaciones de prueba** (`src/followup/pruebasBot.ts`): 14 escenarios (cuota baja, sin ahorros, precio, proyectos, pregunta legal, pide persona, es un bot, ya no le interesa, contado, ofrecer videollamada, agenda sin conectar, vive en Colombia, sin botones…). Cada uno trae una respuesta buena y una mala de ejemplo y un test automático comprueba que las comprobaciones las distinguen. La pantalla para correrlas va con el CRM (paso 3).
- **Ficha**: `captureLead` guarda ahora situación de residencia, qué quiere conocer primero, reportado en Datacrédito, si puede quitar el reporte, estudio de viabilidad, ingresos y datos de quien compra con el cliente; la ficha del aviso al equipo los muestra.
- Choques con la plantilla base de la plataforma, resueltos por escrito en el borrador: la plantilla dice «Eres Verónica, el asistente de Bekai Colombia» y manda «déjame confirmarlo»; el borrador lo anula y explica que el bot habla como el equipo. Las reglas de escalación de la plantilla (p. ej. «legal → handoffHuman») siguen mandando por encima: una consulta legal puede crear un ticket aunque falten datos.
- Pruebas: 1.605 pasan (antes de este paso: 1.561), sin errores de tipos, cero menciones de otros negocios.
- **NO verificado**: el borrador no se ha probado con el modelo real (no hay llave de IA en esta sesión). Las 14 conversaciones de prueba hay que correrlas contra la IA antes de guardarlo (≈ 0,40 USD).
- **Pendiente de aprobar por Brayan** (la lista de decisiones está en el mensaje del 23 nov): tono y emojis, nombre del bot, umbrales de ingresos/cuota, qué hacer sin catálogo, Datacrédito, país de los clientes. Después: correr las pruebas → guardar en la base (`custom_instructions`) → (con permiso) desplegar el guardián.

## 25 de noviembre de 2026 — decisiones de Brayan sobre el borrador de las reglas (aún SIN guardar, SIN desplegar)
Decisiones: (1) sin emojis; (2) **habla Verónica** (primera persona, «Soy Verónica, de Bekai Colombia»); (3) los mismos umbrales de la otra asesora (350 € de cuota baja, 1.300 € de ingresos bajos, 2.000 € de cliente caliente); (4) la cotización **solo se envía cuando el cliente la pide**; (5) **sí se pregunta por Datacrédito** porque los clientes reportados que no pueden ponerse al día no califican; (6) solo se atiende a **colombianos que viven en el exterior**; (7) moneda: como estaba propuesto.
Cambios en el borrador (`member/reglas-del-bot.txt`, ≈ 26.000 caracteres):
- Voz de Verónica en primera persona y singular en todo el texto. Se conserva la honestidad: si el cliente pregunta de verdad si habla con una persona o un bot, responde «Soy el asistente virtual de Verónica…», y nunca dice ni insinúa que es una persona.
- Datacrédito entra en el guion (pregunta 9, justo tras trabajo e ingresos): «No está seguro/a» no cuenta como reportado; si está reportado se pregunta si puede ponerse al día; si no puede, no se ofrece videollamada y se despide con la puerta abierta («cuando puedas ponerte al día, escríbeme»). Esta regla manda sobre «nadie con ahorros se descarta» y se añade a los datos obligatorios.
- Cotización: nunca se ofrece por iniciativa propia; si el cliente la pide, el bot anota «Pidió cotización», abre un aviso interno (`handoffHuman`, motivo «Cliente pide cotización») y le dice que se la prepara y se la envía por el mismo chat. **Hoy no hay cotizador automático: la cotización la tiene que preparar y enviar una persona** (queda ligado a la pregunta pendiente de si Verónica usa el mismo sistema de cotizaciones de la empresa).
- Colombianos en el exterior: si dice que vive en Colombia o que no es colombiano, se le explica con amabilidad y no se sigue; se anota en la ficha.
- Guardián: 17 reglas imprescindibles (se añadieron cotización, reportados y colombianos, y se renombró la de agendar primero).
- Conversaciones de prueba: 20 escenarios (se añadieron primer mensaje sin emojis, pregunta de Datacrédito, reportado sin plan, reportado con plan, pide cotización, no colombiano); el costo de una corrida pasa a ≈ 0,55 USD.
- Pruebas: 1.618 pasan, sin errores de tipos, cero menciones de otros negocios.
- NO verificado: el borrador sigue sin probarse con el modelo real (no hay llave de IA en la sesión).

## 25 de noviembre de 2026 — las 20 conversaciones de prueba contra la IA real: 20 de 20 (borrador aún SIN guardar)
- Se corrieron las 20 conversaciones de `src/followup/pruebasBot.ts` contra el borrador, con el modelo `claude-sonnet-5-5` (llave temporal de Brayan, que debe borrarse al terminar; no quedó escrita en ningún archivo ni en el historial de git). Resultado final: **20 de 20**, una sola pasada por escenario.
- Dos defectos encontrados y arreglados en las PRUEBAS (no en las reglas): (1) el tope de 500 tokens de salida se lo comía el razonamiento del modelo y las respuestas salían cortadas o vacías (ahora 4.000); (2) la prueba de «cuota baja» partía de una clienta con ahorros, a la que las reglas correctamente no descartan (ahora parte de una clienta sin ahorros).
- Costo real: ≈ 720.000 tokens de entrada y 18.500 de salida en las 3 corridas completas (≈ 1,6 USD con la tarifa de 2 y 10 USD por millón; la tarifa no se verificó en la cuenta) + una prueba suelta.
- LÍMITES de esta prueba: (a) solo recibe el texto de las reglas, NO la plantilla base de la plataforma (que dice «Eres Verónica, el asistente…», trae sus reglas de escalación y el verificador anti-invento) ni las herramientas reales; (b) simula la herramienta cuando hace falta; (c) una sola pasada, el modelo no es determinista; (d) las comprobaciones son heurísticas sobre el texto. Lo que falta para estar seguro es probar con el bot completo desplegado y un caso real aprobado.

## 25 de noviembre de 2026 — reglas del bot GUARDADAS en la base de Verónica (bot sigue en pausa)
- Con el visto bueno de Brayan, el texto `member/reglas-del-bot.txt` (antes «borrador»; solo se cambió en el encabezado «borrador para aprobar» por «aprobada por el dueño») se guardó en la base de Verónica, clave `custom_instructions`. Antes de guardar se comprobó que esa clave no existía (no se pisó nada). Después se comprobó que lo guardado es idéntico al archivo (26.193 caracteres, misma huella sha256). Ese archivo del repositorio es la copia de respaldo.
- `bot_paused` sigue en `1`: el bot NO contesta a nadie. Nada se desplegó.
- OJO: lo desplegado en Cloudflare sigue siendo el código del 15 de octubre (sin los pasos 1 y 2: guardián, horario del cliente, regla de Colombia en Zernio, reintentos…). No conviene reactivar el bot hasta desplegar y probar con un caso real aprobado (paso 7).
- Pendiente de decidir: una frase en la bienvenida que avise que quien escribe es un asistente (hoy no hay: el bot solo lo dice si el cliente pregunta).
- Seguridad: la llave de IA temporal que Brayan pegó en el chat debe borrarse en console.anthropic.com.


## 25 de noviembre de 2026 — paso 3: el CRM de Verónica (código y pruebas, SIN desplegar)
**Qué se trajo** (adaptado; sin Zoho, sin cotizaciones automáticas, sin seguros): acceso propio con usuarios y sesiones; Leads con situación y ficha; Plan del día; Auditoría; Por agendar; Esperando un humano; Calendario de llamadas; Agendar llamada manual; Informes (con Excel); Recorrido del cliente; Recomendaciones (IA, solo con botón); Gastos del bot (sin gastos precargados); Instrucciones del bot (versiones y restaurar); Probar el bot. Viven en `member/crm-*.local.ts`, montadas en `/crm`.
- **Marca propia**: sin el logo ni los colores de la otra empresa; texto «Bekai Colombia», acento propio. Solo existe la vista aparte (`/crm`, con su acceso); no se trajo el modo «dentro del panel».
- **Acceso**: usuarios y contraseñas propios (PBKDF2), sesión firmada, bloqueo a los 5 intentos. **Falla cerrado**: sin el secreto `CRM_SESSION_SECRET` todo responde 503. Instrucciones, Probar el bot y Usuarios son solo del administrador. Al desplegar hará falta (con permiso de Brayan): poner ese secreto y crear la primera invitación de administrador directamente en la base (no hay forma de crear al primero desde dentro).
- **Canal**: aquí WhatsApp y Instagram entran los dos por Zernio. Nuevo `src/lib/canal.ts`: un id de 10 a 15 dígitos es un teléfono (WhatsApp); uno más largo es de Instagram. Arregla que un cliente de WhatsApp saliera como «Perfil de Instagram».
- **Calificación** (`src/followup/resumenDia.ts`): caliente/tibio/frío con las reglas de la empresa y la de Datacrédito decidida el 25 nov (reportado que no puede ponerse al día = frío; ahorros, ingresos altos y compra de contado se mantienen).
- **Auditor** (`src/followup/auditor.ts`): detecta clientes sin respuesta, buenos perfiles sin cita (no marca a los fríos por razón explícita ni a quien ya se despidió), avisos sin contestar, mensajes que no llegaron, fallos de IA. **No está conectado al ciclo automático.** Seguridad: con la pausa general no hace nada y su reintento automático (que haría contestar al bot) está APAGADO por defecto (`auditor_reintentos = activo` para encenderlo). El auditor con IA (`auditorIA.ts`, costo alto) tampoco está conectado.
- **Recorrido**: la cotización no es un paso del embudo (es opcional); se cuenta aparte como «pidieron cotización».
- **Datos de terceros**: las pruebas que vinieron de la otra asesora traían nombres, correos y teléfonos REALES de sus clientes, y yo había usado teléfonos reales de la base de Verónica en mis pruebas y en este estado. Todo se reemplazó por datos inventados y se quitaron los números de terceros de este documento. OJO: los commits anteriores del repositorio conservan esos datos hasta que el repositorio pase a privado (o se reescriba el historial).
- **Pruebas**: 1.754 pasan (antes del paso: 1.605). Pruebas nuevas de acceso/seguridad de todas las rutas, canal, Instrucciones y Probar el bot. Se revisaron capturas de pantalla de Leads, ficha, recorrido y demás (sin errores de JavaScript).
- **Hallazgo importante, NO resuelto en este paso**: hoy el bot de Verónica solo contesta el **primer mensaje de cada conversación** y luego se calla. La regla «cliente antiguo» (`mute_clientes_antiguos`, en `src/agent.ts`) decide que una conversación es antigua si ya existe en la base del bot, así que desde el segundo mensaje todo cliente queda silenciado. Se vio en las pruebas del 14 oct (un solo mensaje del bot por chat). Hay que resolverlo antes de reactivar el bot (paso 7): distinguir los chats personales previos (mirando el historial de Zernio al llegar el primer mensaje, o si una persona ya escribió en el hilo) de los clientes nuevos de la campaña.
- NO verificado: el CRM no se ha visto en producción ni con datos reales; los envíos de plantillas, Zoho y Cal.com reales no se han probado.
