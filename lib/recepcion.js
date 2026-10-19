import { createHash, timingSafeEqual } from 'node:crypto';
import { tokenValido } from './pases.js';

export function autorizarRecepcion(header, clave) {
  if (!clave || typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const hash = text => createHash('sha256').update(text).digest();
  return timingSafeEqual(hash(header.slice(7)), hash(clave));
}

export function extraerToken(value) {
  if (tokenValido(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    if (url.origin !== 'https://paola-edgar.vercel.app' || !['/pase', '/pase.html'].includes(url.pathname)) return null;
    const token = url.hash.slice(1);
    return tokenValido(token) ? token : null;
  } catch { return null; }
}

export async function prepararRecepcion(sql) {
  await sql`ALTER TABLE pases_boda ADD COLUMN IF NOT EXISTS fecha_entrada TIMESTAMPTZ`;
}

export async function validarEntrada(sql, token, registrar = false) {
  if (!tokenValido(token)) return { estado: 'invalido' };
  if (registrar) {
    // Una actualización condicional impide usar el mismo pase en dos teléfonos a la vez.
    const inserted = await sql`UPDATE pases_boda SET fecha_entrada = NOW()
      WHERE token = ${token} AND activo = TRUE AND fecha_entrada IS NULL
      RETURNING id, nombre, fecha_entrada, mesa`;
    if (inserted.length) return { estado: 'registrado', ...inserted[0] };
  }
  const rows = await sql`SELECT id, nombre, activo, fecha_entrada, mesa FROM pases_boda WHERE token = ${token} LIMIT 1`;
  const pase = rows[0];
  if (!pase) return { estado: 'no_encontrado' };
  if (!pase.activo) return { estado: 'inactivo', nombre: pase.nombre };
  if (pase.fecha_entrada) return { estado: 'utilizado', id: pase.id, nombre: pase.nombre, fecha_entrada: pase.fecha_entrada, mesa: pase.mesa };
  return { estado: 'valido', id: pase.id, nombre: pase.nombre, mesa: pase.mesa };
}

export async function resumenEntradas(sql) {
  const rows = await sql`SELECT COUNT(*) FILTER (WHERE activo = TRUE)::int AS confirmados,
    COUNT(*) FILTER (WHERE fecha_entrada IS NOT NULL)::int AS recibidos
    FROM pases_boda WHERE nombre !~* '^PRUEBA([[:space:]]|$)'`;
  return rows[0];
}

export async function listarLlegadas(sql) {
  return sql`SELECT id, nombre, fecha_entrada, mesa FROM pases_boda
    WHERE fecha_entrada IS NOT NULL AND nombre !~* '^PRUEBA([[:space:]]|$)'
    ORDER BY fecha_entrada DESC, id DESC LIMIT 1000`;
}

export async function listarPasesParaReenvio(sql) {
  return sql`SELECT p.id, p.nombre, p.token, p.mesa, p.fecha_entrada, p.posicion,
    p.confirmacion_id, c.relacion, c.fecha_confirmacion
    FROM pases_boda p JOIN confirmaciones_boda c ON c.id = p.confirmacion_id
    WHERE p.activo = TRUE AND p.nombre !~* '^PRUEBA([[:space:]]|$)'
    ORDER BY c.fecha_confirmacion DESC, c.id, p.posicion LIMIT 1000`;
}
