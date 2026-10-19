import { neon } from '@neondatabase/serverless';
import QRCode from 'qrcode';
import { consultarPase, tokenValido } from '../lib/pases.js';
import { prepararMesas, etiquetaMesa } from '../lib/mesas.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Pase inválido.' }); }
  if (!tokenValido(body?.token)) return res.status(400).json({ error: 'El enlace del pase no es válido.' });
  const connection = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connection) return res.status(503).json({ error: 'No pudimos consultar el pase. Intenta de nuevo.' });
  try {
    const sql = neon(connection);
    await prepararMesas(sql);
    const pase = await consultarPase(sql, body.token);
    if (!pase) return res.status(404).json({ error: 'No encontramos este pase. Revisa tu enlace o contacta a los novios.' });
    if (!pase.activo) return res.status(410).json({ error: 'Este pase ya no está activo. Contacta a los novios.' });
    // Dominio de producción fijo: no se confía en Host para construir el QR.
    const url = 'https://paola-edgar.vercel.app/pase#' + body.token;
    const qr = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M', margin: 3, width: 420,
      color: { dark: '#343b2c', light: '#fffdf7' }
    });
    return res.status(200).json({
      nombre: pase.nombre, codigo: pase.id.slice(0, 8).toUpperCase(),
      estado: 'Confirmado', qr, mesa: pase.mesa, mesaTexto: etiquetaMesa(pase.mesa)
    });
  } catch {
    console.error('No se pudo consultar un pase digital.');
    return res.status(503).json({ error: 'No pudimos consultar el pase. Intenta de nuevo en un momento.' });
  }
}
