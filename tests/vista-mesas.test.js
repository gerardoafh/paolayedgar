import test from 'node:test';
import assert from 'node:assert/strict';
import { coincideRelacion, opcionesMovimiento, sugerirMovimientos } from '../lib/vista-mesas.js';
test('filtra por lado y parentesco sin excluir hermanos de la familia', () => {
  assert(coincideRelacion('Hermanos de la novia', 'Familiares de la novia'));
  assert(!coincideRelacion('Hermanos del novio', 'Familiares de la novia'));
  assert(!coincideRelacion('Amigos del novio', 'Familiares del novio'));
  assert(coincideRelacion('Amigos del novio', 'Amigos del novio'));
  assert(!coincideRelacion('Amigos de ambos', 'Amigos del novio'));
  assert(coincideRelacion('Familiares de ambos', ''));
});

const relacion = 'Amigos de la novia';
const persona = (confirmacionId, mesa, extra = {}) => ({ confirmacionId, relacion, mesa, ...extra });

test('para reunir a un grupo solo cuenta a quienes todavía no están en el destino', () => {
  const opciones = opcionesMovimiento([{ numero: 4, disponibles: 1 }, { numero: 5, disponibles: 1 }], [persona('grupo', 4), persona('grupo', null)]);
  assert.deepEqual(opciones.map(m => [m.necesarios, m.posible]), [[1, true], [2, false]]);
});

test('prioriza pendientes y solo propone liberar mesas con destino afín y suficiente', () => {
  const mesas = [{ numero: 1, disponibles: 14, categoria: 'Familia directa de la novia' }, { numero: 3, disponibles: 3, categoria: relacion }, { numero: 4, disponibles: 7, categoria: relacion }, { numero: 5, disponibles: 8 }];
  const propuestas = sugerirMovimientos([
    persona('base', 3), persona('mover', 4), persona('pendiente', null),
    persona('pendiente', null, { activo: false }), persona('fijo', 5, { mesaManual: true })
  ], mesas);
  assert.deepEqual(propuestas.map(p => [p.titular.confirmacionId, p.destino.numero, p.cantidad]), [['pendiente', 3, 1], ['mover', 3, 1]]);
});
