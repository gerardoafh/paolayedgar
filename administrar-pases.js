import { enlaceWhatsApp, enlacePaseGrupo, whatsappPaseGrupo } from './lib/reenvio.js';
import { agruparConfirmados, coincideRelacion, opcionesMovimiento, sugerirMovimientos } from './lib/vista-mesas.js';
import { iniciarPlanoSalon } from './lib/plano-salon.js';
const $ = id => document.getElementById(id);
let clave = '', pases = [], mesas = [], ocupado = false;
const normalizar = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const status = value => $('estado-pases').textContent = value;
const nodo = (tag, texto = '', clase = '') => {
  const el = document.createElement(tag); el.textContent = texto; el.className = clase; return el;
};
let personaMovimiento, movimientoRevisado;
const dialogo = $('dialogo-mesa');
const mensajeMovimiento = texto => $('estado-movimiento').textContent = texto;
const nombreMesa = numero => mesas.find(m => m.numero === numero)?.texto || 'Sin mesa';
const numeroPersonas = n => `${n} ${n === 1 ? 'persona' : 'personas'}`;
const filtroRelacion = pase => coincideRelacion(pase.relacion, $('filtro-relacion').value);
const planoSalon = iniciarPlanoSalon({ raiz: $('plano-salon'), obtenerPases: () => pases, obtenerMesas: () => mesas, coincideFiltro: filtroRelacion, mover: abrirMovimiento });
const link = (text, url, secondary = false) => {
  const a = document.createElement('a'); a.className = 'btn' + (secondary ? ' secundario' : '');
  a.textContent = text; a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
};
function salir() {
  $('filtro-relacion').value = '';
  clave = ''; pases = []; mesas = []; $('clave-pases').value = ''; $('buscar-pases').value = '';
  $('familias-pases').replaceChildren(); $('panel-pases').hidden = true; $('acceso-pases').hidden = false;
  for (const id of ['mapa-mesas', 'totales-acomodo', 'sin-mesa-pases', 'sugerencias-mesas', 'resultado-movimiento']) $(id).replaceChildren();
  if (dialogo.open) dialogo.close();
  personaMovimiento = movimientoRevisado = null;
  $('estado-mesas-pdf').textContent = '';
  planoSalon.limpiar();
}
function limpiarSimulacion() {
  movimientoRevisado = null;
  $('resultado-movimiento').hidden = true; $('resultado-movimiento').replaceChildren();
  $('aplicar-movimiento').hidden = true; mensajeMovimiento('');
}
function opcionesDestino(destino) {
  limpiarSimulacion();
  const select = $('destino-movimiento');
  const grupo = agruparConfirmados(pases).get(personaMovimiento.confirmacionId) || [personaMovimiento];
  const personas = $('grupo-movimiento').checked ? grupo : [personaMovimiento];
  const opciones = opcionesMovimiento(mesas, personas);
  const placeholder = nodo('option', 'Selecciona una mesa'); placeholder.value = '';
  select.replaceChildren(placeholder);
  for (const mesa of opciones) {
    const motivo = !mesa.necesarios ? ' · Sin cambio' : !mesa.posible ? ' · No caben' : '';
    const option = nodo('option', `${mesa.texto} · ${mesa.disponibles} libres${motivo}`);
    option.value = mesa.numero; option.disabled = !mesa.posible;
    select.append(option);
  }
  select.value = opciones.some(m => m.numero === Number(destino) && m.posible) ? String(destino) : '';
  const posibles = opciones.filter(m => m.posible).length;
  $('simular-movimiento').disabled = !posibles;
  if (!posibles) mensajeMovimiento('No hay otra mesa con espacio suficiente para esta selección.');
}
function abrirMovimiento(pase, destino, moverGrupo = true) {
  if (ocupado || !clave) return;
  personaMovimiento = pase;
  const cantidad = agruparConfirmados(pases).get(pase.confirmacionId)?.length || 1;
  $('invitado-movimiento').textContent = `${pase.nombre} · ${nombreMesa(pase.mesa)}`;
  $('etiqueta-grupo-movimiento').hidden = cantidad < 2;
  $('grupo-movimiento').checked = cantidad > 1 && moverGrupo;
  opcionesDestino(destino);
  dialogo.showModal();
}
function botonMovimiento(pase, texto = 'Probar cambio de mesa', destino, grupo = true) {
  const boton = nodo('button', texto, 'btn secundario'); boton.type = 'button';
  boton.setAttribute('aria-label', texto + ': ' + pase.nombre);
  boton.addEventListener('click', () => abrirMovimiento(pase, destino, grupo));
  return boton;
}
async function consultarMovimiento(accion, datos) {
  const response = await fetch('/api/recepcion', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + clave },
    body: JSON.stringify({ accion, ...datos }), signal: AbortSignal.timeout(25000)
  });
  const data = await response.json();
  if (response.status === 401) salir();
  if (!response.ok) throw new Error(data.error || 'No pudimos consultar el movimiento.');
  return data;
}
function bloqueoMovimiento(bloquear) {
  ocupado = bloquear;
  for (const id of ['campos-movimiento', 'aplicar-movimiento', 'cerrar-movimiento']) $(id).disabled = bloquear;
}
async function simularMovimiento(event) {
  event.preventDefault();
  if (ocupado || !personaMovimiento) return;
  const datos = { id: personaMovimiento.id, mesa: Number($('destino-movimiento').value), grupo: $('grupo-movimiento').checked };
  limpiarSimulacion(); bloqueoMovimiento(true); mensajeMovimiento('Calculando cómo quedaría el acomodo…');
  try {
    const { previa } = await consultarMovimiento('previsualizar-mesa', datos);
    if (!previa.movimientos.length) { mensajeMovimiento('Las personas seleccionadas ya están en esa mesa.'); return; }
    const resultado = $('resultado-movimiento');
    resultado.append(nodo('h3', `${numeroPersonas(previa.movimientos.length)} cambiarían de mesa`));
    const lista = nodo('ul');
    for (const m of previa.movimientos) lista.append(nodo('li', `${m.nombre}: ${nombreMesa(m.desde)} → ${nombreMesa(m.hasta)}${m.adicional ? ' (ajuste adicional)' : ''}`));
    resultado.append(lista, nodo('h3', 'Ocupación: antes → después'));
    const ocupacion = nodo('ul');
    for (const m of previa.mesas) ocupacion.append(nodo('li', `${m.texto}: ${m.antes} → ${m.despues} confirmados · ${m.disponibles} libres${m.reservados ? ` · ${m.reservados} reservados` : ''}`));
    resultado.append(ocupacion); resultado.hidden = false;
    movimientoRevisado = { ...datos, huella: previa.huella };
    $('aplicar-movimiento').hidden = false; mensajeMovimiento('Vista previa lista. El acomodo sigue igual hasta que apliques el movimiento.');
  } catch (error) { mensajeMovimiento(error.name === 'TimeoutError' ? 'La vista previa tardó demasiado. Intenta otra vez.' : error.message); }
  finally { bloqueoMovimiento(false); }
}
async function aplicarMovimiento() {
  if (ocupado || !movimientoRevisado) return;
  bloqueoMovimiento(true); mensajeMovimiento('Guardando el movimiento…');
  try {
    await consultarMovimiento('cambiar-mesa', movimientoRevisado);
    dialogo.close(); bloqueoMovimiento(false);
    const actualizada = await cargar();
    status(actualizada ? 'Movimiento guardado. Los pases en línea y recepción ya muestran las mesas actualizadas.' : 'Movimiento guardado. Pulsa Actualizar pases para ver el nuevo acomodo.');
  } catch (error) {
    limpiarSimulacion();
    mensajeMovimiento(error.name === 'TimeoutError' ? 'No pudimos comprobar el cambio. Cierra esta ventana y actualiza la lista antes de volver a intentarlo.' : error.message);
  } finally { bloqueoMovimiento(false); }
}
async function descargarReporte({ id, accion, nombre, mensaje, avisar = status }) {
  if (ocupado || !clave) return;
  const boton = $(id);
  ocupado = true; boton.disabled = true; avisar('Preparando el archivo…');
  try {
    const response = await fetch('/api/recepcion', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + clave },
      body: JSON.stringify({ accion }), signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) { const error = await response.json(); throw new Error(error.error || 'No se pudo generar el reporte.'); }
    const url = URL.createObjectURL(await response.blob());
    const a = document.createElement('a'); a.href = url; a.download = nombre;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    avisar(mensaje);
  } catch (error) { avisar(error.name === 'TimeoutError' ? 'El reporte tardó demasiado. Intenta nuevamente.' : error.message); }
  finally { ocupado = false; boton.disabled = false; }
}
async function copiar(text) {
  try { await navigator.clipboard.writeText(text); status('Enlace copiado. Ya puedes pegarlo en WhatsApp o donde prefieras.'); }
  catch { status('No pudimos copiarlo. Abre el pase y copia su enlace desde la barra del navegador.'); }
}
async function cambiarEstado(pase) {
  const retirar = pase.activo !== false;
  if (!confirm(retirar ? '¿Retirar el pase de ' + pase.nombre + '? Su QR quedará inactivo y se liberará su lugar. Podrás restaurarlo desde Mostrar pases retirados.' : '¿Restaurar el pase de ' + pase.nombre + '?')) return;
  if (ocupado) return;
  ocupado = true;
  try {
    const response = await fetch('/api/recepcion', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + clave },
      body: JSON.stringify({ accion: retirar ? 'retirar' : 'restaurar', id: pase.id }), signal: AbortSignal.timeout(25000)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo actualizar el pase.');
    ocupado = false; await cargar();
    status(retirar ? 'Pase retirado. Su QR está inactivo y ya no ocupa lugar.' : 'Pase restaurado.');
  } catch (error) { status(error.message); }
  finally { ocupado = false; }
}
function renderAcomodo() {
  planoSalon.actualizar();
  const activos = pases.filter(p => p.activo !== false);
  const filtrados = activos.filter(filtroRelacion);
  const relacion = $('filtro-relacion').value;
  $('estado-filtro-relacion').textContent = (relacion ? numeroPersonas(filtrados.length) + ' · ' + relacion + '. ' : '') +
    'Los totales y las descargas incluyen a todos los invitados.';
  const sinMesa = activos.filter(p => !p.mesa);
  const libres = mesas.reduce((n, m) => n + m.disponibles, 0);
  const reservas = mesas.reduce((n, m) => n + (m.reservas?.length || 0), 0);
  const totales = $('totales-acomodo'); totales.replaceChildren();
  for (const [cantidad, etiqueta] of [[activos.length, 'Confirmados'], [activos.length - sinMesa.length, 'Con mesa'], [sinMesa.length, 'Sin mesa'], [libres, 'Lugares libres']]) {
    const item = nodo('div'); item.append(nodo('strong', cantidad), nodo('span', etiqueta)); totales.append(item);
  }
  const abiertas = new Set([...$('mapa-mesas').querySelectorAll('details[open]')].map(m => m.dataset.numero));
  const mapa = $('mapa-mesas'); mapa.replaceChildren();
  const filtro = $('filtro-mesas').value;
  for (const mesa of mesas) {
    const todosMesa = activos.filter(p => p.mesa === mesa.numero);
    const invitados = todosMesa.filter(filtroRelacion);
    const parentescoReserva = mesa.numero === 1 ? 'Familiares de la novia' : mesa.numero === 2 ? 'Familiares del novio' : '';
    const reservados = coincideRelacion(parentescoReserva, relacion) ? mesa.reservas || [] : [];
    if (relacion && !invitados.length && !reservados.length) continue;
    if (filtro === 'disponibles' && !mesa.disponibles || filtro === 'ocupadas' && !invitados.length && !reservados.length) continue;
    const tarjeta = nodo('details', '', 'mesa-card'); tarjeta.dataset.numero = mesa.numero; tarjeta.open = abiertas.has(String(mesa.numero));
    const resumen = nodo('summary');
    resumen.append(nodo('strong', mesa.numero <= 2 ? `Imperial ${mesa.numero}` : `Mesa ${mesa.numero}`), nodo('span', `${todosMesa.length}/${mesa.capacidad} confirmados · ${mesa.disponibles} libres` + (relacion ? ` · ${invitados.length} con este filtro` : ''), 'detalle-cupo'));
    const medidor = nodo('progress'); medidor.max = mesa.capacidad; medidor.value = mesa.capacidad - mesa.disponibles; medidor.setAttribute('aria-label', `Lugares ocupados o reservados en ${mesa.texto}`);
    tarjeta.append(resumen, medidor);
    if (mesa.categoria) tarjeta.append(nodo('p', mesa.categoria, 'categoria-mesa'));
    const lista = nodo('ul', '', 'invitados-mesa');
    for (const p of invitados) {
      const item = nodo('li'); item.append(nodo('strong', p.nombre), nodo('span', p.relacion + (p.mesaManual ? ' · Acomodo manual' : '')), botonMovimiento(p, 'Probar movimiento'));
      lista.append(item);
    }
    for (const nombre of reservados) lista.append(nodo('li', `${nombre} · Lugar reservado`));
    tarjeta.append(lista); if (!lista.children.length) tarjeta.append(nodo('p', 'Mesa disponible.'));
    mapa.append(tarjeta);
  }
  if (!mapa.children.length) mapa.append(nodo('p', 'No hay mesas con ese filtro.'));
  const sinMesaFiltrados = filtrados.filter(p => !p.mesa);
  const pendientes = $('sin-mesa-pases'); pendientes.replaceChildren(); pendientes.hidden = !sinMesaFiltrados.length;
  if (sinMesaFiltrados.length) {
    pendientes.append(nodo('h3', 'Confirmados pendientes de mesa'));
    const lista = nodo('ul', '', 'invitados-mesa');
    for (const p of sinMesaFiltrados) { const item = nodo('li', p.nombre); item.append(botonMovimiento(p, 'Buscar mesa')); lista.append(item); }
    pendientes.append(lista);
  }
  const sugerencias = $('sugerencias-mesas'); sugerencias.replaceChildren();
  if (reservas) sugerencias.append(nodo('p', `${reservas} ${reservas === 1 ? 'lugar reservado' : 'lugares reservados'} para los papás, aparte de los confirmados.`, 'nota-reservas'));
  const propuestas = sugerirMovimientos(pases, mesas).filter(p => filtroRelacion(p.titular));
  if (!propuestas.length) sugerencias.append(nodo('p', 'No hay propuestas prioritarias. Abre una mesa o busca un pase para probar otros movimientos.'));
  for (const p of propuestas.slice(0, 6)) {
    const item = nodo('article', '', 'propuesta-mesa');
    item.append(nodo('h3', p.motivo), nodo('p', `${p.titular.nombre} · ${numeroPersonas(p.cantidad)}`));
    if (p.destino) item.append(nodo('p', `Destino sugerido: ${p.destino.texto} · ${p.destino.disponibles} libres`), botonMovimiento(p.titular, 'Revisar propuesta', p.destino.numero));
    else item.append(nodo('p', 'No hay cupo para el grupo completo. Puedes probar un cambio individual.'), botonMovimiento(p.titular, 'Buscar mesa', undefined, false));
    sugerencias.append(item);
  }
  if (propuestas.length > 6) sugerencias.append(nodo('p', 'Se muestran las primeras 6 propuestas. Puedes consultar más opciones desde cada mesa o pase.'));
}
function render() {
  const q = normalizar($('buscar-pases').value.trim());
  const grupos = new Map();
  for (const pase of pases) {
    if (!grupos.has(pase.confirmacionId)) grupos.set(pase.confirmacionId, []);
    grupos.get(pase.confirmacionId).push(pase);
  }
  const familias = [...grupos.values()].filter(grupo => grupo.some(p => filtroRelacion(p) && normalizar([p.nombre, p.mesaTexto, p.codigo, p.relacion].join(' ')).includes(q)));
  $('familias-pases').replaceChildren();
  const visibles = familias.reduce((n, g) => n + g.length, 0);
  $('resumen-pases').textContent = `${visibles} ${visibles === 1 ? 'pase' : 'pases'} en ${familias.length} ${familias.length === 1 ? 'confirmación' : 'confirmaciones'}.`;
  if (!familias.length) {
    const p = document.createElement('p'); p.textContent = pases.length ? 'No encontramos invitados con esa búsqueda.' : 'Todavía no hay pases de invitados registrados.';
    $('familias-pases').append(p); return;
  }
  for (const grupo of familias) {
    const section = document.createElement('article'); section.className = 'familia-pases';
    const activos = grupo.filter(p => p.activo !== false);
    const principal = activos[0] || grupo[0];
    const h = document.createElement('h2'); h.textContent = principal.nombre + (activos.length > 1 ? ' y acompañantes' : '');
    const relacion = document.createElement('p'); relacion.className = 'relacion'; relacion.textContent = grupo[0].relacion;
    section.append(h, relacion);
    if (activos.length) {
      const url = enlacePaseGrupo(principal.url);
      const accionesGrupo = nodo('div', '', 'acciones-pase');
      accionesGrupo.append(link('Ver / descargar pase del grupo', url, true), link('Compartir pase del grupo por WhatsApp', whatsappPaseGrupo(url)));
      section.append(accionesGrupo);
    }
    for (const pase of grupo) {
      const persona = document.createElement('div'); persona.className = 'persona-pase';
      const nombre = document.createElement('h3'); nombre.textContent = pase.nombre;
      const detail = document.createElement('p'); detail.textContent = pase.mesaTexto + ' · Pase ' + pase.codigo;
      const estado = document.createElement('p');
      estado.textContent = pase.activo === false ? 'Pase retirado · QR inactivo · no ocupa lugar.' : pase.fechaEntrada ? 'Entrada ya registrada · reenviar no reactiva el pase.' : 'Pase activo · todavía no registra entrada.';
      if (pase.fechaEntrada) estado.className = 'estado-usado';
      const acciones = document.createElement('div'); acciones.className = 'acciones-pase';
      const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'btn secundario'; copy.textContent = 'Copiar enlace';
      copy.addEventListener('click', () => copiar(pase.url));
      if (pase.activo !== false) acciones.append(link('Ver / descargar pase', pase.url, true), link('Enviar por WhatsApp', enlaceWhatsApp([pase])), copy);
      const retirar = document.createElement('button'); retirar.type = 'button'; retirar.className = 'btn secundario'; retirar.textContent = pase.activo === false ? 'Restaurar pase' : 'Retirar pase';
      retirar.addEventListener('click', () => cambiarEstado(pase)); acciones.append(retirar);
      persona.append(nombre, detail, estado, acciones); section.append(persona);
      if (pase.activo !== false) acciones.append(botonMovimiento(pase));
    }
    $('familias-pases').append(section);
  }
}
async function cargar() {
  if (ocupado || !clave) return;
  ocupado = true; $('actualizar-pases').disabled = true; status('Buscando los pases registrados…');
  try {
    const response = await fetch('/api/recepcion', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + clave },
      body: JSON.stringify({ accion: 'pases', incluirRetirados: $('mostrar-retirados').checked }), signal: AbortSignal.timeout(25000)
    });
    const data = await response.json();
    if (response.status === 401) salir();
    if (!response.ok) throw new Error(data.error || 'No pudimos consultar los pases.');
    pases = data.pases.filter(p => typeof p.url === 'string' && /^https:\/\/paola-edgar\.vercel\.app\/pase#[a-f0-9]{64}$/.test(p.url));
    mesas = data.mesas || [];
    $('panel-pases').hidden = false; $('acceso-pases').hidden = true; $('clave-pases').value = ''; renderAcomodo(); render(); status(''); return true;
  } catch (error) { status(error.name === 'TimeoutError' ? 'La consulta tardó demasiado. Intenta nuevamente.' : error.message); }
  finally { ocupado = false; $('actualizar-pases').disabled = false; }
}
$('acceso-pases').addEventListener('submit', async event => {
  event.preventDefault(); clave = $('clave-pases').value.trim(); event.submitter.disabled = true;
  await cargar(); event.submitter.disabled = false;
});
$('actualizar-pases').addEventListener('click', cargar);
$('descargar-excel').addEventListener('click', () => descargarReporte({
  id: 'descargar-excel', accion: 'reporte', nombre: 'confirmados-paola-edgar.xlsx',
  mensaje: 'Excel descargado: confirmados, reservas, invitados por mesa y movimientos.'
}));
$('descargar-mesas-pdf').addEventListener('click', () => descargarReporte({
  id: 'descargar-mesas-pdf', accion: 'reporte-mesas-pdf', nombre: 'acomodo-mesas-paola-edgar.pdf',
  mensaje: 'PDF descargado. Ábrelo para imprimir el acomodo.',
  avisar: texto => $('estado-mesas-pdf').textContent = texto
}));
$('buscar-pases').addEventListener('input', render);
$('filtro-mesas').addEventListener('change', renderAcomodo);
$('filtro-relacion').addEventListener('change', () => { renderAcomodo(); render(); });
$('grupo-movimiento').addEventListener('change', () => opcionesDestino($('destino-movimiento').value));
$('destino-movimiento').addEventListener('change', limpiarSimulacion);
$('form-movimiento').addEventListener('submit', simularMovimiento);
$('aplicar-movimiento').addEventListener('click', aplicarMovimiento);
$('cerrar-movimiento').addEventListener('click', () => dialogo.close());
dialogo.addEventListener('cancel', event => { if (ocupado) event.preventDefault(); });
dialogo.addEventListener('close', () => { limpiarSimulacion(); personaMovimiento = null; });
$('mostrar-retirados').addEventListener('change', cargar);
$('salir-pases').addEventListener('click', () => { salir(); status('Sesión cerrada.'); });
