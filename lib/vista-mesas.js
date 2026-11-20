export function agruparConfirmados(pases) {
  const grupos = new Map();
  for (const pase of pases) {
    if (pase.activo === false) continue;
    if (!grupos.has(pase.confirmacionId)) grupos.set(pase.confirmacionId, []);
    grupos.get(pase.confirmacionId).push(pase);
  }
  return grupos;
}

export function opcionesMovimiento(mesas, personas) {
  return mesas.map(mesa => {
    const necesarios = personas.filter(pase => pase.mesa !== mesa.numero).length;
    return { ...mesa, necesarios, posible: necesarios > 0 && necesarios <= mesa.disponibles };
  });
}

export function sugerirMovimientos(pases, mesas) {
  const grupos = agruparConfirmados(pases);
  const porMesa = new Map();
  for (const grupo of grupos.values()) for (const pase of grupo) {
    if (!porMesa.has(pase.mesa)) porMesa.set(pase.mesa, []);
    porMesa.get(pase.mesa).push(pase);
  }
  const sugerencias = [];
  for (const personas of grupos.values()) {
    const [titular] = personas;
    const pendientes = personas.some(p => !p.mesa);
    if (personas.some(p => p.mesaManual) && !pendientes) continue;
    const separadas = new Set(personas.map(p => p.mesa)).size > 1;
    const origen = titular.mesa;
    const puedeLiberar = !pendientes && !separadas && origen > 2 && porMesa.get(origen)?.length === personas.length;
    if (!pendientes && !separadas && !puedeLiberar) continue;
    const relacion = titular.relacion;
    const categoria = relacion === 'Hermanos de la novia' ? 'Familia directa de la novia' : relacion === 'Hermanos del novio' ? 'Familia directa del novio' : relacion;
    const opciones = opcionesMovimiento(mesas, personas).filter(m => m.posible && (
      pendientes || separadas
        ? (m.numero > 2 || m.categoria === categoria || personas.some(p => p.mesa === m.numero))
        : m.numero > 2 && m.numero < origen && m.categoria === categoria && porMesa.has(m.numero)
    ));
    const prioridad = m => m.necesarios * 10 + (m.categoria === categoria ? 0 : !m.categoria ? 1 : 2);
    opciones.sort((a, b) => prioridad(a) - prioridad(b) || a.disponibles - a.necesarios - (b.disponibles - b.necesarios) || a.numero - b.numero);
    const destino = opciones[0];
    if (destino || pendientes) sugerencias.push({
      titular, destino, cantidad: personas.length, prioridad: pendientes ? 0 : separadas ? 1 : 2,
      motivo: pendientes ? 'Sentar a quienes aún no tienen mesa' : separadas ? 'Reunir a este grupo' : `Liberar la mesa ${origen} y juntar grupos afines`
    });
  }
  return sugerencias.sort((a, b) => a.prioridad - b.prioridad);
}
export function coincideRelacion(relacion, filtro = '') {
  if (!filtro) return true;
  if (filtro === 'Familiares de la novia') return ['Familiares de la novia', 'Hermanos de la novia'].includes(relacion);
  if (filtro === 'Familiares del novio') return ['Familiares del novio', 'Hermanos del novio'].includes(relacion);
  return relacion === filtro;
}
