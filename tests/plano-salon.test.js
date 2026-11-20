import test from 'node:test';
import assert from 'node:assert/strict';
import { posicionesSalon } from '../lib/plano-salon.js';
import { CONFIG_MESAS } from '../lib/mesas.js';

test('el plano conserva una posición por cada mesa vigente y deja la pista libre', () => {
  assert.deepEqual(posicionesSalon.map(p => p.numero),CONFIG_MESAS.map(m => m.numero));
  assert.equal(CONFIG_MESAS.filter(m => m.capacidad === 16).length,2);
  for(const p of posicionesSalon) {
    assert(p.x>5 && p.x<95 && p.y>5 && p.y<97);
    assert(!(p.x>43 && p.x<72 && p.y>43));
  }
});
