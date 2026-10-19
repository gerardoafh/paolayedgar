import { neon } from '@neondatabase/serverless';
import { validarConfirmacion, guardarConfirmacion } from '../lib/confirmaciones.js';
import { generarPases } from '../lib/pases.js';
import { actualizarMesas, etiquetaMesa } from '../lib/mesas.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (origin) {
    try {
      if (new URL(origin).host !== host) return res.status(403).json({ error: 'Origen no permitido.' });
    } catch { return res.status(403).json({ error: 'Origen no permitido.' }); }
  }
  if (!req.headers['content-type']?.startsWith('application/json')) return res.status(415).json({ error: 'Formato no permitido.' });
  let datos;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    datos = validarConfirmacion(body);
  } catch (error) { return res.status(400).json({ error: error.message }); }
  const connection = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connection) return res.status(503).json({ error: 'No pudimos guardar tu confirmación. Intenta de nuevo en unos minutos.' });
  try {
    const sql = neon(connection);
    const id = await guardarConfirmacion(sql, datos);
    try {
      const pases = await generarPases(sql, datos);
      try {
        const plan = await actualizarMesas(sql);
        const own = await sql`SELECT id, mesa FROM pases_boda WHERE confirmacion_id = ${id} AND activo = TRUE ORDER BY posicion`;
        return res.status(200).json({ ok: true, id, pases: pases.map((p, i) => ({ ...p, mesa: own[i]?.mesa || null, mesaTexto: etiquetaMesa(own[i]?.mesa) })), mesasPendientes: own.some(p => !p.mesa) });
      } catch {
        console.error('Confirmación y pases guardados; acomodo de mesa pendiente.');
        return res.status(200).json({ ok: true, id, pases, mesasPendientes: true });
      }
    } catch {
      console.error('Confirmación guardada; no se pudieron generar los pases.');
      return res.status(200).json({ ok: true, id, pases: [], pasesPendientes: true });
    }
  } catch {
    console.error('No se pudo guardar una confirmación en Postgres.');
    return res.status(503).json({ error: 'No pudimos guardar tu confirmación. Tus datos siguen aquí; intenta de nuevo.' });
  }
}
