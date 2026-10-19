import test from 'node:test';
import assert from 'node:assert/strict';
import { planificarMesas, CONFIG_MESAS, PADRES } from '../lib/mesas.js';
import { validarConfirmacion } from '../lib/confirmaciones.js';
function grupo(id, cantidad, relacion, mesa = null) {
  return Array.from({ length: cantidad }, (_, i) => ({ id: `${id}-${i}`, confirmacion_id: id, nombre: `Invitado ${id} ${i}`, posicion: i, relacion, mesa, fecha_confirmacion: '2026-10-19', integrantes: [] }));
}
test('configura 2 imperiales de 16, 11 mesas de 8 y 8 de 10: 200 lugares', () => {
  assert.equal(CONFIG_MESAS.length, 21);
  assert.equal(CONFIG_MESAS.filter(m => m.capacidad === 16).length, 2);
  assert.equal(CONFIG_MESAS.filter(m => m.capacidad === 8).length, 11);
  assert.equal(CONFIG_MESAS.filter(m => m.capacidad === 10).length, 8);
  assert.equal(CONFIG_MESAS.reduce((s, m) => s + m.capacidad, 0), 200);
});
test('reserva a cada pareja de papás en su imperial y reconoce acentos', () => {
  const plan = planificarMesas(PADRES.map((p, i) => ({ id: `${i}`, nombre: p.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, ''), confirmacion_id: 'padres', relacion: 'Familiares de ambos' })));
  assert.deepEqual(plan.asignaciones.map(p => p.mesa), [1, 1, 2, 2]);
  assert.equal(plan.mesas[0].ocupados, 2);
  assert.equal(plan.mesas[1].reservados, 0);
});
test('mantiene hermanos, parejas e hijos juntos por lado y desborda sin exceder capacidad', () => {
  const plan = planificarMesas([...grupo('a', 8, 'Hermanos de la novia'), ...grupo('b', 8, 'Hermanos de la novia'), ...grupo('c', 5, 'Hermanos del novio')]);
  const mesaA = plan.asignaciones.find(p => p.id === 'a-0').mesa;
  const mesaB = plan.asignaciones.find(p => p.id === 'b-0').mesa;
  assert.equal(mesaA, 1);
  assert(mesaB > 2);
  assert.equal(plan.asignaciones.find(p => p.id === 'c-0').mesa, 2);
  for (const g of ['a', 'b', 'c']) assert.equal(new Set(plan.asignaciones.filter(p => p.id.startsWith(g + '-')).map(p => p.mesa)).size, 1);
  assert(plan.mesas.every(m => m.ocupados + m.reservados <= m.capacidad));
});
test('no mezcla lados, conserva mesas previas y no asigna grupos que no caben', () => {
  const plan = planificarMesas([...grupo('a', 6, 'Familiares de la novia', 14), ...grupo('b', 3, 'Familiares del novio'), ...grupo('grande', 11, 'Amigos de la novia')]);
  assert(plan.asignaciones.filter(p => p.id.startsWith('a-')).every(p => p.mesa === 14));
  assert.notEqual(plan.asignaciones.find(p => p.id === 'b-0').mesa, 14);
  assert.equal(plan.pendientes.length, 11);
});
test('con sobrecupo jamás crea mesas extra ni supera capacidades', () => {
  const entradas = Array.from({ length: 40 }, (_, i) => grupo(`familia${i}`, 8, 'Familiares de la novia')).flat();
  const plan = planificarMesas(entradas);
  assert.equal(plan.mesas.length, 21);
  assert(plan.mesas.every(m => m.ocupados + m.reservados <= m.capacidad));
  assert(plan.pendientes.length > 0);
});
test('las pruebas no consumen lugares y hermanos exigen parentescos explícitos', () => {
  const plan = planificarMesas([{ id: 'test', nombre: 'PRUEBA TECNICA', confirmacion_id: 't', relacion: 'Amigos de ambos' }]);
  assert.equal(plan.asignaciones[0].mesa, null);
  const base = { id: 'f6ff9981-4789-4aa6-899e-4d824f09d432', nombres: 'Hermano Uno\nPareja Uno\nHijo Uno', relacion: 'Hermanos de la novia', telefono: '528119831332' };
  assert.throws(() => validarConfirmacion(base));
  const valid = validarConfirmacion({ ...base, integrantes: [{ nombre: 'Hermano Uno', parentesco: 'Hermano/a' }, { nombre: 'Pareja Uno', parentesco: 'Pareja' }, { nombre: 'Hijo Uno', parentesco: 'Hijo/a' }] });
  assert.equal(valid.integrantes.length, 3);
});
