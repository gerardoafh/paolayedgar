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
  const asignaciones = [], pendientes = [], grupos = new Map(), fijos = [], padresVistos = new Set();
  const prueba = nombre => /^prueba\b/.test(normalizarNombre(nombre));
  for (const padre of PADRES) mesas[padre.mesa - 1].invitados.push({ nombre: padre.nombre, reservado: true, parentesco: 'Padre / madre' });
  for (const pase of pases) {
    if (prueba(pase.nombre)) { asignaciones.push({ id: pase.id, mesa: null }); continue; }
    const padre = PADRES.find(p => normalizarNombre(p.nombre) === normalizarNombre(pase.nombre));
    if (padre) {
      if (padresVistos.has(padre.nombre)) {
        pendientes.push({ nombre: pase.nombre, motivo: 'Nombre de padre o madre confirmado más de una vez; revisar registro.' });
        asignaciones.push({ id: pase.id, mesa: null }); continue;
      }
      padresVistos.add(padre.nombre);
      if (pase.mesa_manual && pase.mesa_manual !== padre.mesa) {
        mesas[padre.mesa - 1].invitados = mesas[padre.mesa - 1].invitados.filter(p => p.nombre !== padre.nombre);
        mesas[padre.mesa - 1].reservados--;
        fijos.push(pase); continue;
      }
      const item = mesas[padre.mesa - 1].invitados.find(p => normalizarNombre(p.nombre) === normalizarNombre(pase.nombre));
      if (item.reservado) { item.reservado = false; item.llego = Boolean(pase.fecha_entrada); item.id = pase.id; mesas[padre.mesa - 1].ocupados++; mesas[padre.mesa - 1].reservados--; }
      else { pendientes.push({ nombre: pase.nombre, motivo: 'Nombre de padre o madre confirmado más de una vez; revisar registro.' }); }
      asignaciones.push({ id: pase.id, mesa: padre.mesa }); continue;
    }
    if (pase.mesa_manual) { fijos.push(pase); continue; }
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
  // Los cambios del personal tienen prioridad y permanecen al confirmar nuevos invitados.
  for (const pase of fijos) {
    const mesa = mesas.find(m => m.numero === pase.mesa_manual);
    if (!mesa || !cabe(mesa, { pases: [pase] })) throw new Error('La mesa elegida no tiene lugares disponibles.');
    const categoria = categoriaGrupo(pase.relacion);
    mesa.manual = true;
    if (mesa.categoria && mesa.categoria !== categoria) mesa.categoria = 'Acomodo manual';
    colocar({ id: pase.confirmacion_id, categoria, pases: [pase] }, mesa);
  }
  const nuevos = [];
  // Mantiene las mesas de los grupos ya asignados antes de sentar a los nuevos.
  for (const grupo of lista) {
    const anterior = grupo.pases[0].mesa;
    const mesa = mesas.find(m => m.numero === anterior);
    if (mesa && grupo.pases.every(p => p.mesa === anterior) && (mesa.manual || !mesa.categoria || mesa.categoria === grupo.categoria) && cabe(mesa, grupo)) colocar(grupo, mesa);
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
  await sql`ALTER TABLE pases_boda ADD COLUMN IF NOT EXISTS mesa_manual SMALLINT`;
  await sql`ALTER TABLE confirmaciones_boda ADD COLUMN IF NOT EXISTS integrantes JSONB NOT NULL DEFAULT '[]'::jsonb`;
  await sql`CREATE TABLE IF NOT EXISTS control_mesas_boda (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0)`;
  await sql`INSERT INTO control_mesas_boda (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;
}

export function aplicarCambioMesa(pases, cambio) {
  const error = mensaje => Object.assign(new Error(mensaje), { status: 409 });
  if (!cambio || !Number.isInteger(cambio.mesa) || !CONFIG_MESAS.some(m => m.numero === cambio.mesa)) throw error('Selecciona una mesa válida.');
  const persona = pases.find(p => p.id === cambio.id);
  if (!persona) throw error('El pase ya no está activo. Actualiza la lista.');
  const seleccionados = pases.filter(p => cambio.grupo ? p.confirmacion_id === persona.confirmacion_id : p.id === persona.id);
  if (seleccionados.some(p => /^prueba\b/.test(normalizarNombre(p.nombre)))) throw error('Los pases de prueba no ocupan mesas.');
  const plan = planificarMesas(pases);
  const mesa = plan.mesas.find(m => m.numero === cambio.mesa);
  const asignados = new Map(plan.asignaciones.map(p => [p.id, p.mesa]));
  const adicionales = seleccionados.filter(p => asignados.get(p.id) !== cambio.mesa).length;
  if (adicionales > mesa.disponibles) throw error(`La mesa tiene ${mesa.disponibles} lugares libres y este cambio necesita ${adicionales}. Elige otra mesa o mueve solo a esta persona.`);
  const ids = new Set(seleccionados.map(p => p.id));
  return pases.map(p => ids.has(p.id) ? { ...p, mesa: cambio.mesa, mesa_manual: cambio.mesa } : p);
}

export async function actualizarMesas(sql, cambio = null) {
  await prepararMesas(sql);
  for (let intento = 0; intento < 6; intento++) {
    const [version] = await sql`SELECT revision FROM control_mesas_boda WHERE id = 1`;
    let pases = await sql`SELECT p.id, p.nombre, p.posicion, p.confirmacion_id, p.mesa, p.mesa_manual,
      c.relacion, c.fecha_confirmacion, c.integrantes,
      to_jsonb(p)->>'fecha_entrada' AS fecha_entrada
      FROM pases_boda p JOIN confirmaciones_boda c ON c.id = p.confirmacion_id
      WHERE p.activo = TRUE ORDER BY c.fecha_confirmacion, c.id, p.posicion`;
    if (cambio) pases = aplicarCambioMesa(pases, cambio);
    const plan = planificarMesas(pases);
    const manuales = new Map(pases.map(p => [p.id, p.mesa_manual || null]));
    // El cambio de revisión y las asignaciones se aplican juntos. Si otro proceso ganó,
    // vuelve a leer los lugares para no sobrepasar la capacidad por confirmaciones simultáneas.
    const result = await sql`WITH permiso AS (
      UPDATE control_mesas_boda SET revision = revision + 1 WHERE id = 1 AND revision = ${version.revision} RETURNING revision
    ), cambios AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(plan.asignaciones.map(p => ({ ...p, mesa_manual: manuales.get(p.id) })))}::jsonb) AS a(id UUID, mesa SMALLINT, mesa_manual SMALLINT)
    ), aplicados AS (
      UPDATE pases_boda p SET mesa = cambios.mesa, mesa_manual = cambios.mesa_manual FROM cambios
      WHERE p.id = cambios.id AND EXISTS (SELECT 1 FROM permiso) RETURNING p.id
    ) SELECT revision FROM permiso`;
    if (result.length) return plan;
  }
  throw new Error('El acomodo se está actualizando. Intenta de nuevo.');
}

export const etiquetaMesa = numero => numero ? numero <= 2 ? `Imperial ${numero} · Familia de ${numero === 1 ? 'la novia' : 'el novio'}` : `Mesa ${numero}` : 'Mesa por asignar';
