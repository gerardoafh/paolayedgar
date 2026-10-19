export const normalizarNombre = nombre => nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
export const PADRES = [
  { nombre: 'Irma Hernández Guadarrama', mesa: 1 },
  { nombre: 'Gerardo Flores Santos', mesa: 1 },
  { nombre: 'Juana María del Toro Lechuga', mesa: 2 },
  { nombre: 'Francisco Aguillón Armendáriz', mesa: 2 }
];
export const CONFIG_MESAS = Array.from({ length: 21 }, (_, i) => ({
  numero: i + 1, capacidad: i < 2 ? 16 : i < 13 ? 8 : 10,
  tipo: i < 2 ? 'Imperial' : 'Estándar',
  categoria: i === 0 ? 'Familia directa de la novia' : i === 1 ? 'Familia directa del novio' : null
}));
const categoriaGrupo = relacion => relacion === 'Hermanos de la novia' ? 'Familia directa de la novia'
  : relacion === 'Hermanos del novio' ? 'Familia directa del novio' : relacion;

export function planificarMesas(pases) {
  const mesas = CONFIG_MESAS.map(m => ({ ...m, invitados: [], ocupados: 0, reservados: m.numero < 3 ? 2 : 0 }));
  const asignaciones = [], pendientes = [], grupos = new Map();
  const prueba = nombre => /^prueba\b/.test(normalizarNombre(nombre));
  for (const padre of PADRES) mesas[padre.mesa - 1].invitados.push({ nombre: padre.nombre, reservado: true, parentesco: 'Padre / madre' });
  for (const pase of pases) {
    if (prueba(pase.nombre)) { asignaciones.push({ id: pase.id, mesa: null }); continue; }
    const padre = PADRES.find(p => normalizarNombre(p.nombre) === normalizarNombre(pase.nombre));
    if (padre) {
      const item = mesas[padre.mesa - 1].invitados.find(p => normalizarNombre(p.nombre) === normalizarNombre(pase.nombre));
      if (item.reservado) { item.reservado = false; item.llego = Boolean(pase.fecha_entrada); item.id = pase.id; mesas[padre.mesa - 1].ocupados++; mesas[padre.mesa - 1].reservados--; }
      else { pendientes.push({ nombre: pase.nombre, motivo: 'Nombre de padre o madre confirmado más de una vez; revisar registro.' }); }
      asignaciones.push({ id: pase.id, mesa: padre.mesa }); continue;
    }
    const key = pase.confirmacion_id;
    if (!grupos.has(key)) grupos.set(key, { id: key, categoria: categoriaGrupo(pase.relacion), pases: [], fecha: pase.fecha_confirmacion });
    grupos.get(key).pases.push(pase);
  }
  const lista = [...grupos.values()].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || a.id.localeCompare(b.id));
  const colocar = (grupo, mesa) => {
    mesa.categoria ||= grupo.categoria;
    for (const pase of grupo.pases) {
      const parentesco = pase.integrantes?.[pase.posicion]?.parentesco || '';
      mesa.invitados.push({ id: pase.id, nombre: pase.nombre, familia: grupo.id, parentesco, llego: Boolean(pase.fecha_entrada), reservado: false });
      mesa.ocupados++; asignaciones.push({ id: pase.id, mesa: mesa.numero });
    }
  };
  const cabe = (mesa, grupo) => mesa.capacidad - mesa.ocupados - mesa.reservados >= grupo.pases.length;
  const nuevos = [];
  // Mantiene las mesas de los grupos ya asignados antes de sentar a los nuevos.
  for (const grupo of lista) {
    const anterior = grupo.pases[0].mesa;
    const mesa = mesas.find(m => m.numero === anterior);
    if (mesa && grupo.pases.every(p => p.mesa === anterior) && (!mesa.categoria || mesa.categoria === grupo.categoria) && cabe(mesa, grupo)) colocar(grupo, mesa);
    else nuevos.push(grupo);
  }
  for (const grupo of nuevos) {
    let opciones = mesas.filter(m => m.categoria === grupo.categoria && cabe(m, grupo));
    opciones.sort((a, b) => (a.numero < 3 ? -1 : b.numero < 3 ? 1 : (a.capacidad - a.ocupados - a.reservados) - (b.capacidad - b.ocupados - b.reservados)) || a.numero - b.numero);
    let mesa = opciones[0];
    if (!mesa) mesa = mesas.filter(m => !m.categoria && cabe(m, grupo)).sort((a, b) => a.capacidad - b.capacidad || a.numero - b.numero)[0];
    if (mesa) colocar(grupo, mesa);
    else for (const pase of grupo.pases) {
      asignaciones.push({ id: pase.id, mesa: null });
      pendientes.push({ nombre: pase.nombre, relacion: grupo.categoria, motivo: 'No hay una mesa con espacio para sentar junto a todo el grupo. Requiere acomodo manual.' });
    }
  }
  for (const mesa of mesas) mesa.disponibles = mesa.capacidad - mesa.ocupados - mesa.reservados;
  return { mesas, asignaciones, pendientes, capacidad: 200 };
}

export async function prepararMesas(sql) {
  await sql`ALTER TABLE pases_boda ADD COLUMN IF NOT EXISTS mesa SMALLINT`;
  await sql`ALTER TABLE confirmaciones_boda ADD COLUMN IF NOT EXISTS integrantes JSONB NOT NULL DEFAULT '[]'::jsonb`;
  await sql`CREATE TABLE IF NOT EXISTS control_mesas_boda (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0)`;
  await sql`INSERT INTO control_mesas_boda (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;
}

export async function actualizarMesas(sql) {
  await prepararMesas(sql);
  for (let intento = 0; intento < 6; intento++) {
    const [version] = await sql`SELECT revision FROM control_mesas_boda WHERE id = 1`;
    const pases = await sql`SELECT p.id, p.nombre, p.posicion, p.confirmacion_id, p.mesa,
      c.relacion, c.fecha_confirmacion, c.integrantes,
      to_jsonb(p)->>'fecha_entrada' AS fecha_entrada
      FROM pases_boda p JOIN confirmaciones_boda c ON c.id = p.confirmacion_id
      WHERE p.activo = TRUE ORDER BY c.fecha_confirmacion, c.id, p.posicion`;
    const plan = planificarMesas(pases);
    // El cambio de revisión y las asignaciones se aplican juntos. Si otro proceso ganó,
    // vuelve a leer los lugares para no sobrepasar la capacidad por confirmaciones simultáneas.
    const result = await sql`WITH permiso AS (
      UPDATE control_mesas_boda SET revision = revision + 1 WHERE id = 1 AND revision = ${version.revision} RETURNING revision
    ), cambios AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(plan.asignaciones)}::jsonb) AS a(id UUID, mesa SMALLINT)
    ), aplicados AS (
      UPDATE pases_boda p SET mesa = cambios.mesa FROM cambios
      WHERE p.id = cambios.id AND EXISTS (SELECT 1 FROM permiso) RETURNING p.id
    ) SELECT revision FROM permiso`;
    if (result.length) return plan;
  }
  throw new Error('El acomodo se está actualizando. Intenta de nuevo.');
}

export const etiquetaMesa = numero => numero ? numero <= 2 ? `Imperial ${numero} · Familia de ${numero === 1 ? 'la novia' : 'el novio'}` : `Mesa ${numero}` : 'Mesa por asignar';
