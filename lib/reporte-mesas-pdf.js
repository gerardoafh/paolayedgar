import PDFDocument from 'pdfkit';
import { CONFIG_MESAS, PADRES, etiquetaMesa, normalizarNombre } from './mesas.js';

export function resumirAcomodoGuardado(pases) {
  const mesas = CONFIG_MESAS.map(m => ({ ...m, nombres: [], reservas: [] }));
  const porNumero = new Map(mesas.map(m => [m.numero, m]));
  const pendientes = [], asignados = new Set();
  for (const pase of pases) {
    if (pase.activo === false || /^prueba\b/.test(normalizarNombre(pase.nombre))) continue;
    const mesa = porNumero.get(pase.mesa);
    if (mesa) {
      mesa.nombres.push(pase.nombre);
      asignados.add(normalizarNombre(pase.nombre));
    } else pendientes.push(pase.nombre);
  }
  for (const padre of PADRES) if (!asignados.has(normalizarNombre(padre.nombre))) {
    porNumero.get(padre.mesa).reservas.push(padre.nombre);
  }
  for (const mesa of mesas) mesa.libres = mesa.capacidad - mesa.nombres.length - mesa.reservas.length;
  return { mesas, pendientes };
}

export function crearReporteMesasPdf(pases, fecha = new Date()) {
  const { mesas, pendientes } = resumirAcomodoGuardado(pases);
  const doc = new PDFDocument({ size: 'LETTER', margin: 0, bufferPages: true,
    info: { Title: 'Paola y Edgar - Acomodo de mesas' } });
  const partes = [];
  const archivo = new Promise((resolve, reject) => {
    doc.on('data', parte => partes.push(parte));
    doc.once('end', () => resolve(Buffer.concat(partes)));
    doc.once('error', reject);
  });
  const margen = 38, ancho = 536, separacion = 12, columna = (ancho - separacion) / 2;
  const oliva = '#414c32', tinta = '#292b24', borde = '#cbd1c1';
  const fechaLocal = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City' }).format(fecha).replace(/[\u00a0\u202f]/g, ' ');
  const conMesa = mesas.reduce((n, m) => n + m.nombres.length, 0);
  const reservas = mesas.reduce((n, m) => n + m.reservas.length, 0);
  const libres = mesas.reduce((n, m) => n + Math.max(0, m.libres), 0);
  const capacidad = mesas.reduce((n, m) => n + m.capacidad, 0);
  const escribir = (texto, x, y, w, tam, color = tinta, bold = false) => {
    const opciones = { width: w, lineGap: 2 };
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(tam).fillColor(color);
    const alto = doc.heightOfString(texto, opciones);
    doc.text(texto, x, y, opciones);
    return alto;
  };
  const cabecera = inicial => {
    escribir('PAOLA Y EDGAR  /  ORGANIZACIÓN DE LA BODA', margen, 35, ancho, 9, oliva, true);
    escribir('Acomodo de mesas', margen, 53, ancho, inicial ? 27 : 19, oliva, true);
    escribir('Distribución guardada · ' + fechaLocal, margen, inicial ? 90 : 80, ancho, 10);
    return inicial ? 116 : 103;
  };
  let y = cabecera(true);
  const datos = [[conMesa + pendientes.length, 'Confirmados'], [conMesa, 'Con mesa'], [pendientes.length, 'Sin mesa'], [reservas, 'Reservados'], [libres, 'Lugares libres']];
  datos.forEach(([cantidad, etiqueta], i) => {
    const w = ancho / datos.length, x = margen + i*w;
    doc.rect(x, y, w-3, 48).fill('#f0f2eb');
    escribir(String(cantidad), x+9, y+6, w-20, 17, oliva, true);
    escribir(etiqueta, x+9, y+28, w-20, 9);
  });
  y += 56;
  y += escribir(`${mesas.length} mesas · ${capacidad} lugares de capacidad total`, margen, y, ancho, 10) + 11;

  const medir = texto => doc.font('Helvetica').fontSize(10).heightOfString(texto, { width: columna - 22, lineGap: 2 });
  const tarjetas = [];
  function agregarTarjetas(titulo, subtitulo, renglones) {
    let filas = [], alto = 0;
    for (const texto of renglones) {
      const h = medir(texto) + 2;
      if (alto + h > 252 && filas.length) {
        tarjetas.push({ titulo: titulo + (tarjetas.at(-1)?.base === titulo ? ' (cont.)' : ''), subtitulo, filas, alto: alto+64, base: titulo });
        filas = []; alto = 0;
      }
      filas.push(texto); alto += h;
    }
    tarjetas.push({ titulo: titulo + (tarjetas.at(-1)?.base === titulo ? ' (cont.)' : ''), subtitulo, filas, alto: alto+64, base: titulo });
  }
  for (const m of mesas) {
    const cupo = m.libres < 0 ? `Excede el cupo por ${-m.libres}` : `${m.libres} libres`;
    const filas = [...m.nombres, ...m.reservas.map(n => `Reserva: ${n}`)];
    agregarTarjetas(etiquetaMesa(m.numero), `${m.nombres.length}/${m.capacidad} confirmados · ${m.reservas.length} reservas · ${cupo}`, filas.length ? filas : ['Sin invitados asignados.']);
  }
  if (pendientes.length) agregarTarjetas('Confirmados sin mesa', `${pendientes.length} personas pendientes de asignar`, pendientes);

  for (let i = 0; i < tarjetas.length; i += 2) {
    const par = tarjetas.slice(i, i+2);
    const alto = Math.max(...par.map(t => t.alto));
    if (y+alto > 739) { doc.addPage(); y = cabecera(false); }
    par.forEach((t,j) => {
      const x = margen + j*(columna+separacion);
      doc.rect(x,y,columna,t.alto).lineWidth(0.65).stroke(borde);
      let r = y+10;
      r += escribir(t.titulo, x+11, r, columna-22, 12, oliva, true)+3;
      r += escribir(t.subtitulo, x+11, r, columna-22, 9)+8;
      for (const fila of t.filas) r += escribir(fila,x+11,r,columna-22,10)+2;
    });
    y += alto+separacion;
  }
  const paginas = doc.bufferedPageRange().count;
  for (let i = 0; i < paginas; i++) {
    doc.switchToPage(i);
    doc.moveTo(margen,750).lineTo(margen+ancho,750).lineWidth(0.65).stroke(borde);
    escribir('Paola y Edgar · Uso de organización', margen, 758, 390, 8, oliva);
    escribir(`Página ${i+1} de ${paginas}`, 502, 758, 80, 8, oliva);
  }
  doc.end();
  return archivo;
}
