import ExcelJS from 'exceljs';
import { etiquetaMesa } from './mesas.js';

const fechaLocal = value => value ? new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City', dateStyle: 'short', timeStyle: 'short'
}).format(new Date(value)) : '';

export async function crearReporteConfirmados(pases, plan) {
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
    { header: 'Llegada (CDMX)', key: 'entrada', width: 25 }
  ];
  // Solo confirmados activos: los retirados y los registros de prueba no se exportan.
  const activos = pases.filter(p => p.activo !== false && !/^PRUEBA(?:\s|$)/i.test(p.nombre));
  for (const p of activos) hoja.addRow({
    nombre: p.nombre, grupo: p.confirmacion_id, relacion: p.relacion,
    mesa: etiquetaMesa(p.mesa), acomodo: p.mesa_manual ? 'Manual' : 'Automático',
    codigo: p.id.slice(0, 8).toUpperCase(), confirmacion: fechaLocal(p.fecha_confirmacion),
    llego: p.fecha_entrada ? 'Sí' : 'No', entrada: fechaLocal(p.fecha_entrada)
  });
  hoja.autoFilter = { from: 'A1', to: 'I' + Math.max(1, hoja.rowCount) };
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
  for (const sheet of [hoja, mesas]) {
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.getRow(1).height = 30;
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF69734C' } };
    sheet.getRow(1).alignment = { vertical: 'middle', wrapText: true };
    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  }
  return libro.xlsx.writeBuffer();
}
