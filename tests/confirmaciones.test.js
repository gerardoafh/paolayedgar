import test from 'node:test';
import assert from 'node:assert/strict';
import { validarConfirmacion, guardarConfirmacion } from '../lib/confirmaciones.js';
const data = {
  id: 'f6ff9981-4789-4aa6-899e-4d824f09d432',
  nombres: '  Invitado Uno\n\nInvitada Dos  ',
  relacion: 'Familiares de la novia', telefono: '528119831332'
};
test('normaliza varios invitados y rechaza formularios inválidos', () => {
  assert.deepEqual(validarConfirmacion(data).nombres, ['Invitado Uno', 'Invitada Dos']);
  for (const patch of [{ nombres: '   ' }, { relacion: 'Otra' }, { telefono: '000' }, { id: 'mal' }, { nombres: 'a'.repeat(1501) }]) {
    assert.throws(() => validarConfirmacion({ ...data, ...patch }));
  }
});
test('los nombres se envían como parámetros, sin mezclarse con SQL', async () => {
  const calls = [];
  const sql = async (strings, ...values) => {
    calls.push({ text: strings.join('?'), values });
    return [{ id: data.id }];
  };
  const datos = validarConfirmacion({ ...data, nombres: "Ana'); DROP TABLE confirmaciones_boda;--" });
  assert.equal(await guardarConfirmacion(sql, datos), data.id);
  const insert = calls.find(c => c.text.includes('INSERT INTO'));
  assert(!insert.text.includes('DROP TABLE'));
  assert(insert.values.includes(JSON.stringify(datos.nombres)));
  assert(insert.text.includes('ON CONFLICT (id)'));
});
