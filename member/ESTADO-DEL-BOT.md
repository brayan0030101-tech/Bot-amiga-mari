# Estado del bot de la nueva asesora de Viventa (Bot-amiga-mari)

> Léelo antes de tocar nada. Aquí **nunca** va el valor de una llave. Repo privado.
> Brayan es el dueño: no es técnico, español sencillo. Pide confirmación antes de desplegar,
> subir a producción o cambiar llaves.

## Origen
Copia del bot de Viventa (`brayan0030101-tech/Viventa-`, 10 de octubre de 2026). Misma base de Forja,
mismo guion de 13 mensajes y mismo tono por ahora; se irá adaptando. El bot de Viventa NO se toca.
El estado detallado de ese bot (reglas, lecciones, automatismos) está en su repo: `member/ESTADO-DEL-BOT.md`.

## Decidido
- Mismo guion de calificación (13 mensajes) y mismo tono que Viventa; luego se adapta.
- Canal: **WhatsApp**. Avisos de leads calificados por **Telegram**.
- Va en la misma cuenta de Cloudflare de Brayan, con **su propia base de datos** (nunca la de Viventa).

## Pendiente (Brayan aún no lo define)
1. Nombre de la asesora y del bot, y cómo se presenta («el equipo comercial de…»).
2. Número de WhatsApp (y proveedor: ¿otra línea en YCloud?) y webhook.
3. Agenda (Cal.com, horario, duración, zona horaria).
4. Quién recibe los avisos de Telegram (ids de chat).
5. Si usa formulario/CRM/Excel como Maricela (Zoho Forms) o no.
6. Nombres de personas del equipo que hoy están fijos en el código (Camila, Maricela): `src/lib/camila.ts`,
   `src/followup/sistemaViventa.ts`, `src/followup/resumenDia.ts`.

## Seguro antes del primer deploy
- `wrangler.toml` quedó SIN el D1, el número de WhatsApp ni el evento de Cal.com de Viventa. El preflight
  (`scripts/forja-preflight.mjs`) bloquea el deploy mientras queden `{{...}}`.
- Crear base D1 y Vectorize propios; poner los secretos del worker nuevo con `wrangler secret put`.
- Reglas del bot (`custom_instructions`) viven en D1: copiar las de Viventa solo cuando se decida el texto final.
