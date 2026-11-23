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
