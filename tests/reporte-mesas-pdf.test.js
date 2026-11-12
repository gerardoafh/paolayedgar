import test from 'node:test';
import assert from 'node:assert/strict';
import { crearReporteMesasPdf, resumirAcomodoGuardado } from '../lib/reporte-mesas-pdf.js';
import { PADRES } from '../lib/mesas.js';

test('el PDF usa las mesas guardadas, distingue reservas y excluye retirados y pruebas', () => {
  const pases = [
    { nombre: PADRES[0].nombre, mesa: 6 },
    { nombre: 'Invitado aún sin mesa', mesa: null },
    { nombre: 'Invitado retirado', mesa: 3, activo: false },
    { nombre: 'PRUEBA Ejemplo', mesa: 3 }
  ];
  const { mesas, pendientes } = resumirAcomodoGuardado(pases);
  assert.deepEqual(mesas[0].reservas, [PADRES[1].nombre]);
  assert.deepEqual(mesas[5].nombres, [PADRES[0].nombre]);
  assert.equal(mesas[2].libres, 8);
  assert.deepEqual(pendientes, ['Invitado aún sin mesa']);
  assert.equal(pases[0].mesa, 6);
});

test('genera un PDF válido de varias páginas incluso con muchos pendientes', async () => {
  const pases = Array.from({ length: 210 }, (_, i) => ({
    nombre: 'Invitada de ejemplo con nombre y apellidos '.repeat(3) + i,
    mesa: i < 96 ? 3 + Math.floor(i / 8) : null
  }));
  const buffer = await crearReporteMesasPdf(pases, new Date('2026-11-12T19:00:00Z'));
  const pdf = buffer.toString('latin1');
  assert.match(pdf, /^%PDF-/);
  assert.match(pdf, /%%EOF\s*$/);
  assert(pdf.match(/\/Type \/Page\b/g).length > 3);
});
