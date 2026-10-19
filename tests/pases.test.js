import test from 'node:test';
import assert from 'node:assert/strict';
import { generarPases, consultarPase, tokenValido } from '../lib/pases.js';

test('rechaza tokens predecibles o con contenido SQL', async () => {
  assert(!tokenValido('abc'));
  assert(!tokenValido("'; DROP TABLE pases_boda;--"));
  assert(tokenValido('a'.repeat(64)));
  let called = false;
  assert.equal(await consultarPase(() => { called = true; }, 'abc'), null);
  assert(!called);
});
test('genera un pase por nombre, usa tokens distintos y desactiva los sobrantes', async () => {
  const llamadas = [];
  const sql = (strings, ...values) => {
    const query = { text: strings.join('?'), values };
    llamadas.push(query);
    return query;
  };
  sql.transaction = async queries => queries.map((q, i) => i < 2 ? [{ id: q.values[0], nombre: q.values[3], token: q.values[4], posicion: i }] : []);
  const pases = await generarPases(sql, { id: 'rsvp-id', nombres: ['Invitada Uno', 'Invitado Dos'] });
  assert.equal(pases.length, 2);
  assert.deepEqual(pases.map(p => p.nombre), ['Invitada Uno', 'Invitado Dos']);
  assert.notEqual(pases[0].url, pases[1].url);
  assert(pases.every(p => /^\/pase#[a-f0-9]{64}$/.test(p.url)));
  assert(llamadas[1].text.includes('ON CONFLICT'));
  assert(llamadas.at(-1).text.includes('activo = FALSE'));
  assert.equal(llamadas.at(-1).values[1], 2);
});
