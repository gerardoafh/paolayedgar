import ExcelJS from 'exceljs';
import { etiquetaMesa, normalizarNombre, detalleMovimiento } from './mesas.js';

const fechaLocal = value => value ? new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City', dateStyle: 'short', timeStyle: 'short'
}).format(new Date(value)) : '';

export async function crearReporteConfirmados(pases, plan, historial = []) {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Paola y Edgar'; libro.created = new Date();
  const hoja = libro.addWorksheet('Confirmados');
  hoja.columns = [
    { header: 'Nombre completo', key: 'nombre', width: 36 },
    { header: 'Grupo de confirmación', key: 'grupo', width: 25 },
    { header: 'Relación con los novios', key: 'relacion', width: 28 },
    { header: 'Mesa', key: 'mesa', width: 42 },
    { header: 'Acomodo', key: 'acomodo', width: 18 },
    { header: 'Código del pase', key: 'codigo', width: 20 },
    { header: 'Confirmación (CDMX)', key: 'confirmacion', width: 25 },
    { header: 'Llegó', key: 'llego', width: 12 },
    { header: 'Llegada (CDMX)', key: 'entrada', width: 25 },
    { header: 'Persona principal', key: 'principal', width: 36 },
    { header: 'Rol en el grupo', key: 'rol', width: 18 }
  ];
  // Solo confirmados activos: los retirados y los registros de prueba no se exportan.
  const activos = pases.filter(p => p.activo !== false && !/^prueba\b/.test(normalizarNombre(p.nombre)));
  const grupos = new Map(), porId = new Map(activos.map(p => [p.id, p]));
  for (const p of activos) {
    if (!grupos.has(p.confirmacion_id)) grupos.set(p.confirmacion_id, []);
    grupos.get(p.confirmacion_id).push(p);
  }
  const rol = new Map();
  for (const integrantes of grupos.values()) {
    integrantes.sort((a,b) => a.posicion - b.posicion);
    for (const [i,p] of integrantes.entries()) rol.set(p.id, { principal: integrantes[0].nombre, rol: i ? 'Acompañante' : 'Principal' });
  }
  const ordenados = [...grupos.values()].flat();
  for (const p of ordenados) hoja.addRow({
    nombre: p.nombre, grupo: p.confirmacion_id, relacion: p.relacion,
    mesa: etiquetaMesa(p.mesa), acomodo: p.mesa_manual ? 'Manual' : 'Automático',
    codigo: p.id.slice(0, 8).toUpperCase(), confirmacion: fechaLocal(p.fecha_confirmacion),
    llego: p.fecha_entrada ? 'Sí' : 'No', entrada: fechaLocal(p.fecha_entrada), ...rol.get(p.id)
  });
  hoja.autoFilter = { from: 'A1', to: 'K' + hoja.rowCount };
  const mesas = libro.addWorksheet('Mesas');
  mesas.columns = [
    { header: 'Mesa', key: 'mesa', width: 42 }, { header: 'Capacidad', key: 'capacidad', width: 15 },
    { header: 'Confirmados', key: 'ocupados', width: 18 }, { header: 'Reservados para papás', key: 'reservados', width: 26 },
    { header: 'Disponibles', key: 'disponibles', width: 18 }
  ];
  for (const m of plan.mesas) mesas.addRow({ ...m, mesa: etiquetaMesa(m.numero) });
  const totals = plan.mesas.reduce((t, m) => ({ capacidad: t.capacidad + m.capacidad, ocupados: t.ocupados + m.ocupados, reservados: t.reservados + m.reservados, disponibles: t.disponibles + m.disponibles }), { capacidad: 0, ocupados: 0, reservados: 0, disponibles: 0 });
  mesas.addRow({ mesa: 'TOTAL', ...totals }).font = { bold: true };
  mesas.addRow({ mesa: 'Confirmados sin mesa', ocupados: activos.filter(p => !p.mesa).length });
  mesas.addRow({ mesa: 'Total de personas confirmadas', ocupados: activos.length });
  const detalle = libro.addWorksheet('Invitados por mesa');
  detalle.columns = [
    { header: 'Mesa', key: 'mesa', width: 41 }, { header: 'Nombre', key: 'nombre', width: 38 },
    { header: 'Estado', key: 'estado', width: 25 }, { header: 'Persona principal', key: 'principal', width: 38 },
    { header: 'Rol en el grupo', key: 'rol', width: 20 }, { header: 'Relación con los novios', key: 'relacion', width: 28 }
  ];
  for (const m of plan.mesas) {
    const mesa = etiquetaMesa(m.numero);
    const reservas = m.invitados.filter(p => p.reservado);
    for (const p of reservas) detalle.addRow({ mesa, nombre: p.nombre, estado: 'Reserva familiar', rol: 'Padre / madre' });
    const asignados = ordenados.filter(p => p.mesa === m.numero);
    for (const p of asignados) detalle.addRow({ mesa, nombre: p.nombre, estado: 'Confirmado', ...rol.get(p.id), relacion: p.relacion });
    if (!asignados.length && !reservas.length) detalle.addRow({ mesa, estado: 'Mesa sin invitados' });
  }
  for (const p of ordenados.filter(p => !p.mesa)) detalle.addRow({
    mesa: etiquetaMesa(null), nombre: p.nombre, estado: 'Pendiente de mesa', ...rol.get(p.id), relacion: p.relacion
  });
  detalle.autoFilter = { from: 'A1', to: 'F' + detalle.rowCount };
  const movimientos = libro.addWorksheet('Movimientos');
  movimientos.columns = [
    { header: 'Persona principal', key: 'principal', width: 38 }, { header: 'Invitado', key: 'nombre', width: 38 },
    { header: 'Rol en el grupo', key: 'rol', width: 19 }, { header: 'Mesa anterior', key: 'desde', width: 41 },
    { header: 'Mesa resultante', key: 'hasta', width: 41 }, { header: 'Estado', key: 'estado', width: 30 },
    { header: 'Fecha del cambio (CDMX)', key: 'fecha', width: 25 }, { header: 'Movimiento', key: 'revision', width: 16 }
  ];
  const registrados = new Set();
  for (const evento of historial) for (const p of evento.personas) {
    if (p.estado !== 'Sin cambio') registrados.add(p.id);
    movimientos.addRow({ ...p, desde: etiquetaMesa(p.desde), hasta: etiquetaMesa(p.hasta), fecha: fechaLocal(evento.fecha), revision: evento.revision });
  }
  // Antes de la bitácora solo se conservaba la mesa asignada manualmente.
  const previos = activos.filter(p => p.mesa_manual && !registrados.has(p.id));
  for (const p of detalleMovimiento(ordenados, previos.map(p => ({ id: p.id, hasta: p.mesa })))) {
    const esPrevio = p.estado !== 'Sin cambio';
    movimientos.addRow({ ...p, desde: esPrevio ? 'No registrada' : '', hasta: etiquetaMesa(porId.get(p.id).mesa),
      estado: esPrevio ? 'Manual sin historial previo' : 'Acompañante de referencia' });
  }
  if (movimientos.rowCount === 1) movimientos.addRow({ estado: 'Sin movimientos registrados' });
  movimientos.autoFilter = { from: 'A1', to: 'H' + movimientos.rowCount };
  for (const sheet of [hoja, mesas, detalle, movimientos]) {
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.getRow(1).height = 30;
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF69734C' } };
    sheet.getRow(1).alignment = { vertical: 'middle', wrapText: true };
    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  }
  return libro.xlsx.writeBuffer();
}
