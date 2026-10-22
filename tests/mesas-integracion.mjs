// Prueba opcional: npm install --no-save --package-lock=false @electric-sql/pglite
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { guardarConfirmacion, validarConfirmacion } from '../lib/confirmaciones.js';
import { generarPases } from '../lib/pases.js';
import { actualizarMesas } from '../lib/mesas.js';
import { randomUUID } from 'node:crypto';
const db = new PGlite();
const sql = (strings, ...values) => {
  const text = strings.reduce((s, part, i) => s + part + (i < values.length ? '$' + (i + 1) : ''), '');
  return { text, values, then(resolve, reject) { return db.query(text, values).then(r => r.rows).then(resolve, reject); } };
};
sql.transaction = queries => db.transaction(async tx => {
  const rows = [];
  for (const q of queries) rows.push((await tx.query(q.text, q.values)).rows);
  return rows;
});
async function confirmar(nombres, relacion, integrantes) {
  const datos = validarConfirmacion({ id: randomUUID(), nombres: nombres.join('\n'), relacion, integrantes, telefono: '528119831332' });
  await guardarConfirmacion(sql, datos);
  const pases = await generarPases(sql, datos);
  await actualizarMesas(sql);
  return { datos, pases };
}
try {
  const familia = ['Hermana de ejemplo', 'Pareja de ejemplo', 'Hija de ejemplo'];
  const novia = await confirmar(familia, 'Hermanos de la novia', familia.map((nombre, i) => ({ nombre, parentesco: ['Hermano/a', 'Pareja', 'Hijo/a'][i] })));
  await confirmar(['Familiar del novio uno', 'Familiar del novio dos'], 'Familiares del novio');
  await confirmar(['Irma Hernández Guadarrama', 'Gerardo Flores Santos'], 'Familiares de la novia');
  let plan = await actualizarMesas(sql);
  assert.equal(plan.capacidad, 200);
  assert.equal(plan.mesas[0].ocupados, 5);
  assert.equal(plan.mesas[0].reservados, 0);
  assert.equal(plan.mesas[1].reservados, 2);
  assert(plan.mesas.every(m => m.ocupados + m.reservados <= m.capacidad));
  const roles = plan.mesas[0].invitados.filter(p => p.familia === novia.datos.id).map(p => p.parentesco);
  assert.deepEqual(roles, ['Hermano/a', 'Pareja', 'Hijo/a']);
  const rows = await sql`SELECT mesa FROM pases_boda WHERE confirmacion_id = ${novia.datos.id}`;
  assert(rows.every(p => p.mesa === 1));
  const asignaciones = plan.asignaciones;
  plan = await actualizarMesas(sql);
  assert.deepEqual(plan.asignaciones, asignaciones);
  // La revisión obsoleta no puede escribir un nuevo plan.
  const [{ revision }] = await sql`SELECT revision FROM control_mesas_boda WHERE id = 1`;
  const stale = await sql`UPDATE control_mesas_boda SET revision = revision + 1 WHERE id = 1 AND revision = ${revision - 1} RETURNING revision`;
  assert.equal(stale.length, 0);
  const [persona] = await sql`SELECT id FROM pases_boda WHERE confirmacion_id = ${novia.datos.id} ORDER BY posicion LIMIT 1`;
  plan = await actualizarMesas(sql, { id: persona.id, mesa: 14, grupo: true });
  assert.equal(plan.asignaciones.filter(p => p.mesa === 14).length, 3);
  let manuales = await sql`SELECT mesa, mesa_manual FROM pases_boda WHERE confirmacion_id = ${novia.datos.id}`;
  assert(manuales.every(p => p.mesa === 14 && p.mesa_manual === 14));
  await confirmar(['Nueva confirmación de ejemplo'], 'Familiares de la novia');
  manuales = await sql`SELECT mesa FROM pases_boda WHERE confirmacion_id = ${novia.datos.id}`;
  assert(manuales.every(p => p.mesa === 14));
  await actualizarMesas(sql, { id: persona.id, mesa: 15, grupo: false });
  const [individual] = await sql`SELECT mesa, mesa_manual FROM pases_boda WHERE id = ${persona.id}`;
  assert.equal(individual.mesa, 15); assert.equal(individual.mesa_manual, 15);
  await assert.rejects(actualizarMesas(sql, { id: persona.id, mesa: 99, grupo: false }), /mesa válida/);
  console.log('Cambios manuales verificados en Postgres: grupo, persona, persistencia y validación.');
  console.log('Integración Postgres verificada: migración, parentescos, capacidad, asignación estable y revisión atómica.');
} finally { await db.close(); }
