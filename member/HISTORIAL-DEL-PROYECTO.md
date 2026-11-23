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
