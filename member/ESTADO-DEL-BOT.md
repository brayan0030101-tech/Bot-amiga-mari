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
2. Número de WhatsApp y proveedor, y su webhook.
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
