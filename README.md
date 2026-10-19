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

## Pases digitales

Al confirmar se genera un pase por cada nombre (uno por línea). Los enlaces aparecen en el formulario y abren `/pase#token`. Cada pase se descarga como PNG e incluye QR para consultar su estado. El QR no marca entradas usadas ni evita reutilización; no hay control de acceso por escaneo.

La tabla `pases_boda` guarda los pases. Al modificar una confirmación se actualizan los nombres de sus posiciones y se desactivan los pases sobrantes. La invitación no integra Apple Wallet ni Google Wallet. Los enlaces son personales: quien tenga el enlace puede ver el nombre y descargar el pase.

## Recepción

`/recepcion` permite consultar QR con cámara, leer imágenes o pegar enlaces. Requiere el secreto de servidor `RECEPCION_CLAVE` en Vercel. La clave se mantiene solo en memoria del navegador hasta cerrar sesión. No compartirla con invitados.

Consultar un pase no registra su uso. Registrar entrada actualiza `pases_boda.fecha_entrada` de forma atómica e impide duplicados. Después aparece un botón para avisar por WhatsApp al 81 3591 0620; el personal debe pulsar Enviar en WhatsApp. No se envían avisos automáticos ni se cobran servicios de mensajería.

El lector de cámara necesita HTTPS y permiso del dispositivo. La lectura de imágenes se hace en el navegador.
