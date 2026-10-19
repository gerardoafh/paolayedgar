import test from 'node:test';
import assert from 'node:assert/strict';
import { autorizarRecepcion, extraerToken, validarEntrada } from '../lib/recepcion.js';
const token = 'a'.repeat(64);
test('solo autoriza con la clave configurada y valida el dominio del QR', () => {
  assert(autorizarRecepcion('Bearer clave-secreta', 'clave-secreta'));
  assert(!autorizarRecepcion('Bearer otra', 'clave-secreta'));
  assert(!autorizarRecepcion('Bearer ', undefined));
  assert.equal(extraerToken('https://paola-edgar.vercel.app/pase#' + token), token);
  assert.equal(extraerToken('https://otro.example/pase#' + token), null);
});
test('la entrada se registra una sola vez, aun con dos lecturas concurrentes', async () => {
  let utilizado = false;
  const sql = async strings => {
    if (strings.join('').startsWith('UPDATE')) {
      if (utilizado) return [];
      utilizado = true;
      return [{ id: 'pase', nombre: 'Prueba', fecha_entrada: '2026-11-29T19:00:00Z' }];
    }
    return [{ id: 'pase', nombre: 'Prueba', activo: true, fecha_entrada: utilizado ? '2026-11-29T19:00:00Z' : null }];
  };
  const results = await Promise.all([validarEntrada(sql, token, true), validarEntrada(sql, token, true)]);
  assert.deepEqual(results.map(p => p.estado).sort(), ['registrado', 'utilizado']);
});
test('consultar un pase no registra entrada y distingue pases inactivos', async () => {
  assert.equal((await validarEntrada(async () => [{ activo: true, nombre: 'Prueba' }], token)).estado, 'valido');
  assert.equal((await validarEntrada(async () => [{ activo: false, nombre: 'Prueba' }], token)).estado, 'inactivo');
  assert.equal((await validarEntrada(async () => [], token)).estado, 'no_encontrado');
});
