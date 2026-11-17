import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { crearReporteConfirmados } from '../lib/reporte-confirmados.js';
import { planificarMesas } from '../lib/mesas.js';
import { PADRES, detalleMovimiento } from '../lib/mesas.js';

test('el Excel incluye solo confirmados activos, mesas, llegadas y ningún token del QR', async () => {
  const persona = { id: 'f6ff9981-4789-4aa6-899e-4d824f09d432', confirmacion_id: 'familia', nombre: '=Nombre literal', relacion: 'Amigos de la novia', mesa: 3, mesa_manual: 3, activo: true, fecha_confirmacion: '2026-10-22T18:00:00Z', fecha_entrada: '2026-11-30T01:00:00Z', token: 'secreto-no-exportar' };
  const plan = planificarMesas([persona]);
  const buffer = await crearReporteConfirmados([persona, { ...persona, activo: false, nombre: 'Retirado' }, { ...persona, nombre: 'PRUEBA QA' }], plan);
  const libro = new ExcelJS.Workbook(); await libro.xlsx.load(buffer);
  const sheet = libro.getWorksheet('Confirmados');
  assert.equal(sheet.rowCount, 2);
  assert.equal(sheet.getCell('A2').value, '=Nombre literal');
  assert.equal(sheet.getCell('D2').value, 'Mesa 3');
  assert.equal(sheet.getCell('E2').value, 'Manual');
  assert.equal(sheet.getCell('H2').value, 'Sí');
  assert(!JSON.stringify(sheet.model).includes(persona.token));
  assert.equal(libro.getWorksheet('Mesas').getCell('B23').value, 200);
});

test('exporta los papás reservados, y los movimientos se presentan primero con el principal', async () => {
  const invitados = [
    { id: 'a', nombre: 'Principal de ejemplo', confirmacion_id: 'g', posicion: 0, mesa: 3, relacion: 'Amigos de la novia' },
    { id: 'b', nombre: 'Acompañante de ejemplo', confirmacion_id: 'g', posicion: 1, mesa: 4, mesa_manual: 4, relacion: 'Amigos de la novia' }
  ];
  const [a,b] = invitados;
  const libro = new ExcelJS.Workbook();
  const historial = [{ revision: 9, fecha: '2026-11-17T19:00:00Z', personas: detalleMovimiento([a,{ ...b, mesa: 3 }], [{ id: b.id, hasta: 4 }]) }];
  await libro.xlsx.load(await crearReporteConfirmados([b,a], planificarMesas(invitados), historial));
  const detalle = libro.getWorksheet('Invitados por mesa');
  assert.deepEqual([2,3,4,5].map(i => detalle.getCell('B'+i).value), PADRES.map(p => p.nombre));
  assert.equal(libro.getWorksheet('Confirmados').getCell('A2').value, a.nombre);
  const movimientos = libro.getWorksheet('Movimientos');
  assert.equal(movimientos.rowCount, 3);
  assert.equal(movimientos.getCell('B2').value, a.nombre);
  assert.equal(movimientos.getCell('F2').value, 'Sin cambio');
  assert.equal(movimientos.getCell('B3').value, b.nombre);
  assert.equal(movimientos.getCell('D3').value, 'Mesa 3');
  assert.equal(movimientos.getCell('E3').value, 'Mesa 4');
});

test('un reporte vacío abre correctamente y mantiene los encabezados', async () => {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await crearReporteConfirmados([], planificarMesas([])));
  assert.equal(libro.getWorksheet('Confirmados').rowCount, 1);
  assert.equal(libro.getWorksheet('Mesas').rowCount, 25);
});
