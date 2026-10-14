# Estado del bot de la nueva asesora (Bot-amiga-mari)

> Léelo antes de tocar nada. Aquí **nunca** va el valor de una llave. Repo privado.
> Brayan es el dueño: no es técnico, español sencillo. Pide confirmación antes de desplegar,
> subir a producción o cambiar llaves.

## Independencia
Este bot es **totalmente independiente** de cualquier otro negocio: otra asesora, otro número,
otra base de datos, otra agenda, otras llaves. De la base anterior solo se reutilizan el código de
Forja, el comportamiento y la naturalidad del bot (guion de 13 mensajes y tono). En el código y los
datos no debe aparecer ningún nombre, número ni recurso de otro negocio.

## Decidido
- Asesora: **Verónica Rivera**. Marca: **Bekai Colombia**. El bot habla como «el equipo comercial de Verónica Rivera» (`BOT_NAME = Verónica`; cambiar si ella prefiere otro nombre para el bot).
- Verónica trabaja también como asesora de otra empresa: este bot no la menciona ni comparte nada con ella salvo que ella lo pida.
- Mismo guion de calificación (13 mensajes) y mismo tono; luego se adapta.
- Canal: **WhatsApp**. Avisos de leads calificados por **Telegram** (`EQUIPO_TELEGRAM_CHAT_ID`, varios ids separados por coma).
- Misma cuenta de Cloudflare de Brayan, con **su propia base de datos** y su propio índice Vectorize.

## Pendiente (Brayan aún no lo define)
1. Confirmar si el bot lleva un nombre propio distinto de «Verónica».
2. ~~Número de WhatsApp~~ — conectado por Zernio (ver abajo).
3. Agenda (Cal.com, horario, duración).
4. Ids de Telegram de quienes reciben los avisos.
5. Si usa formulario/CRM/Excel (hoy el código trae un resumen diario, CSV y formulario pensados para otro CRM; se activan solo con ajustes en D1).
6. Reglas del bot (`custom_instructions`, viven en D1, no en git): escribirlas para esta asesora.


## Zona horaria
Todas las horas del bot (ventanas de mensajes 9–21 h, resumen 8:00, Excel 6:00/14:00, recordatorios) salen de `BOT_TIMEZONE` en `wrangler.toml`. Decidido: **Europe/Madrid** (la misma que usa el bot de referencia), en `BOT_TIMEZONE`, `CALCOM_TIMEZONE` y `member/config.local.ts`.

## Antes del primer deploy
- Creados en Cloudflare (12 oct): D1 `horizontes_bot_amiga_mari_db` (WEUR) y Vectorize `horizontes_bot_amiga_mari_kb` (1024, cosine). El ID de D1 ya está en `wrangler.toml`.
- Esquema aplicado a D1 (12 oct, con `cf d1 raw`: 29 tablas).
- Falta: poner los secretos del worker con `wrangler secret put` y desplegar (pedir permiso a Brayan).

## Zernio (WhatsApp) — 14 oct
- Cuenta de Zernio **nueva y propia** de este bot (perfil `Default`, id `6acff7de6da9cce8f379aa51`).
- Worker `forja-amiga-mari` ya desplegado en `https://forja-amiga-mari.brayan0030101.workers.dev`.
- Secretos puestos en el worker: `ZERNIO_API_KEY` y `ZERNIO_WEBHOOK_SECRET` (este último regenerado el 14 oct; el valor solo vive en Cloudflare y en Zernio).
- Webhook registrado en Zernio (id `6acffd26e378e11b5ee395db`): `/webhooks/zernio`, evento `message.received`. Evento de prueba entregado y aceptado (0 fallos).
- **WhatsApp conectado (14 oct, 22:12 UTC):** número **+34 666 47 81 06**, nombre visible «Beka», en **coexistencia** (el número sigue también en la app WhatsApp Business). Zernio accountId `6acffe40deb2a0a2be6ca500`, WABA `431006643434598`, phoneNumberId `471975339332476`, límite TIER_250.
- **Pendiente en Meta:** Zernio marca «Can't start conversations — error con el método de pago». Falta añadir un método de pago a la cuenta de WhatsApp Business en Meta (WhatsApp Manager). Sin eso el bot sí responde a quien escriba, pero no puede abrir conversaciones con plantilla (reenganche fuera de 24 h). Nombre y verificación de empresa: «no revisado / no verificado».
- Después de conectar: escribir al número desde otro teléfono y revisar que el bot conteste; configurar la plantilla de reenganche (fuera de 24 h) en **Plantillas** del panel.

## Bot en pausa general (desde 14 oct, 22:38 UTC) — hasta nuevo aviso
- Pedido de Verónica: mientras no arranque la campaña, al número le escriben sobre todo contactos personales. Antes de la pausa el bot contestó a dos chats personales (+34 642 78 16 56 y +39 335 48 49 32).
- Pausa hecha con el interruptor general del panel (`settings.bot_paused = 1`, `bot_paused_until` vacío). No se tocó Zernio, el webhook, WhatsApp ni los secretos: los mensajes siguen entrando y quedan guardados en el panel, pero el bot no contesta ni hace seguimientos.
- **Para reactivar:** panel → Agente → «Reactivar bot» (o poner `bot_paused = 0`).
- Huecos conocidos de la pausa general (código, sin arreglar aún): con el bot pausado, (1) si alguien manda el mismo texto repetido, el anti-spam igual envía su aviso; (2) si mandan un PDF/archivo, igual se envía «Recibí tu archivo…»; (3) los mensajes recibidos durante la pausa se acumulan en el buffer y al reactivar el primer mensaje nuevo de cada chat haría que el bot conteste todo lo acumulado. Arreglo propuesto: comprobar la pausa general antes del anti-spam y del archivo, y no acumular buffer en pausa. Requiere desplegar.
