export const relaciones = new Set([
  'Familiares de la novia', 'Familiares del novio',
  'Amigos de la novia', 'Amigos del novio',
  'Familiares de ambos', 'Amigos de ambos'
]);
export const telefonos = new Set(['528119831332', '528135910620']);

export function validarConfirmacion(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Datos inválidos.');
  if (typeof body.nombres !== 'string' || body.nombres.length > 1500) throw new Error('Revisa los nombres de los invitados.');
  const nombres = body.nombres.split(/\r?\n/).map(n => n.trim()).filter(Boolean);
  if (!nombres.length || nombres.length > 30 || nombres.some(n => n.length > 150 || /[\x00-\x1f]/.test(n))) {
    throw new Error('Escribe un nombre por línea, hasta 30 invitados.');
  }
  if (!relaciones.has(body.relacion)) throw new Error('Selecciona tu relación con los novios.');
  if (!telefonos.has(body.telefono)) throw new Error('Selecciona un número de confirmación válido.');
  if (typeof body.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)) {
    throw new Error('Recarga la página e intenta de nuevo.');
  }
  return { id: body.id, nombres, relacion: body.relacion, telefono: body.telefono };
}

export async function guardarConfirmacion(sql, datos) {
  await sql`CREATE TABLE IF NOT EXISTS confirmaciones_boda (
    id UUID PRIMARY KEY,
    nombres JSONB NOT NULL,
    numero_invitados INTEGER NOT NULL,
    relacion TEXT NOT NULL,
    whatsapp_destino TEXT NOT NULL,
    fecha_confirmacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  // El mismo intento se actualiza sin duplicar registros si se repite el envío.
  const rows = await sql`INSERT INTO confirmaciones_boda
    (id, nombres, numero_invitados, relacion, whatsapp_destino)
    VALUES (${datos.id}, ${JSON.stringify(datos.nombres)}::jsonb, ${datos.nombres.length}, ${datos.relacion}, ${datos.telefono})
    ON CONFLICT (id) DO UPDATE SET
      nombres = EXCLUDED.nombres, numero_invitados = EXCLUDED.numero_invitados,
      relacion = EXCLUDED.relacion, whatsapp_destino = EXCLUDED.whatsapp_destino
    RETURNING id`;
  return rows[0].id;
}
