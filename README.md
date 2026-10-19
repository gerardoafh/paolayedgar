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

## Música

La invitación incorpora el video oficial de Maná «Bendita Tu Luz» mediante el reproductor de YouTube. Al abrir el sobre se intenta iniciar la música a volumen moderado; si el navegador bloquea el inicio, el invitado puede tocar Reproducir música. El botón flotante permite pausar o continuar.

## Acomodo automático de mesas

Capacidad total: 200 personas en 21 mesas. Imperial 1: 16 lugares para familia directa de la novia. Imperial 2: 16 para familia directa del novio. Mesas 3–13: 8 lugares cada una. Mesas 14–21: 10 lugares cada una.

Se reservan dos lugares de papás en cada imperial, reconocidos por sus nombres completos. La confirmación incluye Hermanos de la novia / Hermanos del novio y campos separados para titular, pareja e hijos. Cada confirmación es un grupo que se mantiene junto. Los hermanos se priorizan en su imperial y, si no caben juntos, reciben otra mesa exclusiva de su categoría. Los demás grupos se acomodan por familiares o amigos y lado. Se conservan asignaciones previas cuando sigue habiendo espacio. Si no cabe una familia completa, aparece pendiente; nunca se crean mesas extra ni se sobrepasa la capacidad.

La asignación usa una revisión atómica en Postgres para evitar sobrecupo entre confirmaciones simultáneas. La mesa aparece en el pase, en la consulta del QR y en el panel de recepción, que permite buscar nombres y ver ocupación, reservas y pendientes. Los registros cuyo nombre empieza con PRUEBA no consumen lugares ni aparecen en los totales de recepción.

Una imagen de pase ya descargada no se actualiza sola. El enlace del pase y su QR consultan la mesa actual; el invitado puede volver a descargar la imagen.

## Recuperar y reenviar pases

`/administrar-pases` usa la misma clave privada de recepción. Permite buscar por nombre, categoría, código o mesa, abrir el pase original para descargarlo, copiar el enlace y preparar un mensaje de WhatsApp individual o con todos los pases de una confirmación. WhatsApp permite seleccionar al contacto; no se envían mensajes automáticamente. El reenvío no crea nuevas confirmaciones, no cambia el QR y no reinicia una entrada usada. La lista incluye pases activos y omite registros de prueba.
