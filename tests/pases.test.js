import test from 'node:test';
import assert from 'node:assert/strict';
import { generarPases, consultarGrupo, consultarPase, extraerTokenGrupo, resumirMesasGrupo, tokenValido } from '../lib/pases.js';

test('un pase de grupo exige el token del primer miembro activo y conserva mesas separadas', async () => {
  const token = 'a'.repeat(64), otro = 'b'.repeat(64);
  const grupo = [{ token, mesa: 3 }, { token: otro, mesa: 8 }, { mesa: 3 }, { mesa: null }];
  assert.equal(extraerTokenGrupo('https://paola-edgar.vercel.app/pase-grupo#' + token), token);
  assert.equal(extraerTokenGrupo('https://otro.example/pase-grupo#' + token), null);
  assert.equal(extraerTokenGrupo('https://paola-edgar.vercel.app/pase#' + token), null);
  assert.equal(await consultarGrupo(async () => grupo, token), grupo);
  assert.equal(await consultarGrupo(async () => grupo, otro), null);
  assert.deepEqual(resumirMesasGrupo(grupo), [{ mesa: 3, cantidad: 2 }, { mesa: 8, cantidad: 1 }, { mesa: null, cantidad: 1 }]);
});

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
