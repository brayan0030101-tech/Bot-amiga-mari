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
- Mismo guion de calificación (13 mensajes) y mismo tono; luego se adapta.
- Canal: **WhatsApp**. Avisos de leads calificados por **Telegram** (`EQUIPO_TELEGRAM_CHAT_ID`, varios ids separados por coma).
- Misma cuenta de Cloudflare de Brayan, con **su propia base de datos** y su propio índice Vectorize.

## Pendiente (Brayan aún no lo define)
1. Nombre de la asesora y del bot, nombre del negocio y cómo se presenta (`BOT_NAME`, `BUSINESS_NAME`, `member/config.local.ts`).
2. Número de WhatsApp y proveedor, y su webhook.
3. Agenda (Cal.com, horario, duración) y **zona horaria**.
4. Ids de Telegram de quienes reciben los avisos.
5. Si usa formulario/CRM/Excel (hoy el código trae un resumen diario, CSV y formulario pensados para otro CRM; se activan solo con ajustes en D1).
6. Reglas del bot (`custom_instructions`, viven en D1, no en git): escribirlas para esta asesora.

## Cosas del código que aún suponen horario de España (revisar con la zona horaria real)
`src/followup/sistemaAtencion.ts` y `src/followup/resumenDia.ts` usan `Europe/Madrid` fijo (ventanas 9–21 h, resumen 8:00,
Excel 6:00/14:00) y el texto «hora de España». `src/media/availability.ts` también.

## Antes del primer deploy
- `wrangler.toml` tiene `{{D1_DATABASE_ID}}` y `{{BOT_NAME}}`: el preflight bloquea el deploy hasta resolverlos.
- Crear D1 y Vectorize propios (`wrangler d1 create horizontes_bot_amiga_mari_db`); secretos con `wrangler secret put`.
