import { randomBytes, randomUUID } from 'node:crypto';

export const tokenValido = token => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);

export async function generarPases(sql, datos) {
  await sql`CREATE TABLE IF NOT EXISTS pases_boda (
    id UUID PRIMARY KEY,
    confirmacion_id UUID NOT NULL REFERENCES confirmaciones_boda(id),
    posicion INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_emision TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(confirmacion_id, posicion)
  )`;
  const queries = datos.nombres.map((nombre, posicion) => sql`
    INSERT INTO pases_boda (id, confirmacion_id, posicion, nombre, token)
    VALUES (${randomUUID()}, ${datos.id}, ${posicion}, ${nombre}, ${randomBytes(32).toString('hex')})
    ON CONFLICT (confirmacion_id, posicion)
    DO UPDATE SET nombre = EXCLUDED.nombre, activo = TRUE
    RETURNING id, nombre, token, posicion
  `);
  queries.push(sql`UPDATE pases_boda SET activo = FALSE
    WHERE confirmacion_id = ${datos.id} AND posicion >= ${datos.nombres.length}`);
  const results = await sql.transaction(queries);
  return results.slice(0, -1).flat().map(pase => ({
    nombre: pase.nombre,
    codigo: pase.id.slice(0, 8).toUpperCase(),
    url: '/pase#' + pase.token
  }));
}

export async function consultarPase(sql, token) {
  if (!tokenValido(token)) return null;
  const rows = await sql`SELECT id, nombre, activo FROM pases_boda WHERE token = ${token} LIMIT 1`;
  return rows[0] || null;
}
