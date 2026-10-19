# Paola y Edgar · Nuestra boda

Invitación con sobre animado, galería y confirmaciones guardadas en Postgres (Neon).

## Vercel

Rama de producción: `codex/invitacion`. Framework: Other. Sin comando de compilación. Vercel instala las dependencias de Node y despliega `api/confirmaciones.js`.

La integración Neon configura `DATABASE_URL` en el servidor. No exponerla en el navegador ni añadirla a Git.

## Consultar registros

En Vercel, abrir Storage → paola-edgar-confirmaciones → Data Editor → confirmaciones_boda. Esta vista requiere iniciar sesión en tu cuenta; los invitados no pueden consultar los registros.

Se guardan nombres, número de invitados, relación con los novios, WhatsApp elegido y fecha. Después del registro se ofrece continuar por WhatsApp al 81 1983 1332 o al 81 3591 0620. Guardar la confirmación y enviar WhatsApp son acciones diferentes.

## Pruebas

`npm test`
