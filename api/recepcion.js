import { neon } from '@neondatabase/serverless';
import { autorizarRecepcion, extraerToken, prepararRecepcion, validarEntrada, resumenEntradas, listarLlegadas, listarPasesParaReenvio, cambiarEstadoPase } from '../lib/recepcion.js';
import { actualizarMesas, etiquetaMesa } from '../lib/mesas.js';

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
  if (!['resumen', 'llegadas', 'mesas', 'pases', 'retirar', 'restaurar', 'consultar', 'registrar'].includes(body?.accion)) return res.status(400).json({ error: 'Acción inválida.' });
  if (['retirar', 'restaurar'].includes(body.accion) && (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id))) return res.status(400).json({ error: 'Identificador inválido.' });
  const connection = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connection) return res.status(503).json({ error: 'No se pudo conectar. Intenta nuevamente.' });
  try {
    const sql = neon(connection);
    await prepararRecepcion(sql);
    if (['retirar', 'restaurar'].includes(body.accion)) {
      const rows = await cambiarEstadoPase(sql, body.id, body.accion === 'restaurar');
      if (!rows.length) return res.status(404).json({ error: 'No encontramos el pase.' });
      await actualizarMesas(sql);
      return res.json({ ok: true, pase: rows[0] });
    }
    const plan = await actualizarMesas(sql);
    if (body.accion === 'pases') {
      const pases = await listarPasesParaReenvio(sql, body.incluirRetirados === true);
      return res.json({ ok: true, pases: pases.map(pase => ({
        id: pase.id, nombre: pase.nombre, confirmacionId: pase.confirmacion_id, activo: pase.activo,
        relacion: pase.relacion, codigo: pase.id.slice(0, 8).toUpperCase(),
        mesaTexto: etiquetaMesa(pase.mesa), fechaEntrada: pase.fecha_entrada,
        url: 'https://paola-edgar.vercel.app/pase#' + pase.token
      })) });
    }
    const mesas = { mesas: plan.mesas, pendientes: plan.pendientes, capacidad: plan.capacidad };
    if (['resumen', 'llegadas', 'mesas'].includes(body.accion)) {
      const [resumen, llegadas] = await Promise.all([resumenEntradas(sql), listarLlegadas(sql)]);
      return res.json({ ok: true, resumen, llegadas, distribucion: mesas });
    }
    const token = extraerToken(body.qr);
    if (!token) return res.status(400).json({ error: 'Este QR no corresponde a un pase de esta boda.' });
    const pase = await validarEntrada(sql, token, body.accion === 'registrar');
    return res.json({ ok: true, pase: { ...pase, mesaTexto: etiquetaMesa(pase.mesa) }, resumen: await resumenEntradas(sql), distribucion: mesas,
      ...(body.accion === 'registrar' ? { llegadas: await listarLlegadas(sql) } : {}) });
  } catch {
    console.error('Error en el control de recepción.');
    return res.status(503).json({ error: 'No pudimos verificar la entrada. Revisa la conexión y vuelve a intentar.' });
  }
}
