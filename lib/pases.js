import { randomBytes, randomUUID } from 'node:crypto';

export const tokenValido = token => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
export const dominioPases = 'https://paola-edgar.vercel.app';

export function extraerTokenGrupo(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    return url.origin === dominioPases && ['/pase-grupo', '/pase-grupo.html'].includes(url.pathname) &&
      tokenValido(url.hash.slice(1)) ? url.hash.slice(1) : null;
  } catch { return null; }
}

export async function consultarGrupo(sql, token) {
  if (!tokenValido(token)) return null;
  const invitados = await sql`SELECT p.id, p.nombre, p.token, p.mesa,
    to_jsonb(p)->>'fecha_entrada' AS fecha_entrada
    FROM pases_boda titular JOIN pases_boda p ON p.confirmacion_id = titular.confirmacion_id
    WHERE titular.token = ${token} AND titular.activo AND p.activo
      AND p.nombre !~* '^PRUEBA([[:space:]]|$)'
    ORDER BY p.posicion`;
  return invitados[0]?.token === token ? invitados : null;
}

export function resumirMesasGrupo(invitados) {
  const mesas = new Map();
  for (const p of invitados) {
    const mesa = p.mesa ?? null;
    mesas.set(mesa, (mesas.get(mesa) || 0) + 1);
  }
  return [...mesas].map(([mesa, cantidad]) => ({ mesa, cantidad }));
}

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
  const rows = await sql`SELECT id, nombre, activo, mesa FROM pases_boda WHERE token = ${token} LIMIT 1`;
  return rows[0] || null;
}
