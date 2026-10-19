import { neon } from '@neondatabase/serverless';
import { autorizarRecepcion, extraerToken, prepararRecepcion, validarEntrada, resumenEntradas } from '../lib/recepcion.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Método no permitido.' }); }
  if (!process.env.RECEPCION_CLAVE) return res.status(503).json({ error: 'El acceso de recepción todavía no está configurado.' });
  if (!autorizarRecepcion(req.headers.authorization, process.env.RECEPCION_CLAVE)) {
    return res.status(401).json({ error: 'La clave de recepción no es correcta.' });
  }
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Solicitud inválida.' }); }
  if (!['resumen', 'consultar', 'registrar'].includes(body?.accion)) return res.status(400).json({ error: 'Acción inválida.' });
  const connection = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connection) return res.status(503).json({ error: 'No se pudo conectar. Intenta nuevamente.' });
  try {
    const sql = neon(connection);
    await prepararRecepcion(sql);
    if (body.accion === 'resumen') return res.json({ ok: true, resumen: await resumenEntradas(sql) });
    const token = extraerToken(body.qr);
    if (!token) return res.status(400).json({ error: 'Este QR no corresponde a un pase de esta boda.' });
    const pase = await validarEntrada(sql, token, body.accion === 'registrar');
    return res.json({ ok: true, pase, resumen: await resumenEntradas(sql) });
  } catch {
    console.error('Error en el control de recepción.');
    return res.status(503).json({ error: 'No pudimos verificar la entrada. Revisa la conexión y vuelve a intentar.' });
  }
}
