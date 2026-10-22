import { enlaceWhatsApp } from './lib/reenvio.js';
const $ = id => document.getElementById(id);
let clave = '', pases = [], mesas = [], ocupado = false;
const normalizar = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const status = value => $('estado-pases').textContent = value;
const link = (text, url, secondary = false) => {
  const a = document.createElement('a'); a.className = 'btn' + (secondary ? ' secundario' : '');
  a.textContent = text; a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
};
function salir() {
  clave = ''; pases = []; mesas = []; $('clave-pases').value = ''; $('buscar-pases').value = '';
  $('familias-pases').replaceChildren(); $('panel-pases').hidden = true; $('acceso-pases').hidden = false;
}
async function cambiarMesa(pase, mesa, grupo, boton) {
  if (ocupado) return;
  if (!confirm(`¿Mover ${grupo ? 'a todo el grupo de ' : 'a '}${pase.nombre} a ${mesas.find(m => m.numero === mesa)?.texto}?`)) return;
  ocupado = true; boton.disabled = true; status('Guardando cambio de mesa…');
  try {
    const response = await fetch('/api/recepcion', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + clave },
      body: JSON.stringify({ accion: 'cambiar-mesa', id: pase.id, mesa, grupo }), signal: AbortSignal.timeout(25000)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo cambiar la mesa.');
    ocupado = false; await cargar(); status('Mesa actualizada. El pase y recepción ya muestran el nuevo acomodo. Si tenían una imagen descargada, reenvía el pase actualizado.');
  } catch (error) { status(error.name === 'TimeoutError' ? 'No pudimos comprobar el cambio. Actualiza la lista antes de volver a intentarlo.' : error.message); }
  finally { ocupado = false; boton.disabled = false; }
}
async function descargarExcel() {
  if (ocupado || !clave) return;
  ocupado = true; $('descargar-excel').disabled = true; status('Preparando reporte de confirmados…');
  try {
    const response = await fetch('/api/recepcion', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + clave },
      body: JSON.stringify({ accion: 'reporte' }), signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) { const error = await response.json(); throw new Error(error.error || 'No se pudo generar el reporte.'); }
    const url = URL.createObjectURL(await response.blob());
    const a = document.createElement('a'); a.href = url; a.download = 'confirmados-paola-edgar.xlsx';
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    status('Reporte Excel descargado: confirmados activos y distribución de mesas.');
  } catch (error) { status(error.name === 'TimeoutError' ? 'El reporte tardó demasiado. Intenta nuevamente.' : error.message); }
  finally { ocupado = false; $('descargar-excel').disabled = false; }
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
function render() {
  const q = normalizar($('buscar-pases').value.trim());
  const grupos = new Map();
  for (const pase of pases) {
    if (!grupos.has(pase.confirmacionId)) grupos.set(pase.confirmacionId, []);
    grupos.get(pase.confirmacionId).push(pase);
  }
  const familias = [...grupos.values()].filter(grupo => grupo.some(p => normalizar([p.nombre, p.mesaTexto, p.codigo, p.relacion].join(' ')).includes(q)));
  $('familias-pases').replaceChildren();
  const visibles = familias.reduce((n, g) => n + g.length, 0);
  $('resumen-pases').textContent = `${visibles} ${visibles === 1 ? 'pase' : 'pases'} en ${familias.length} ${familias.length === 1 ? 'confirmación' : 'confirmaciones'}.`;
  if (!familias.length) {
    const p = document.createElement('p'); p.textContent = pases.length ? 'No encontramos invitados con esa búsqueda.' : 'Todavía no hay pases de invitados registrados.';
    $('familias-pases').append(p); return;
  }
  for (const grupo of familias) {
    const section = document.createElement('article'); section.className = 'familia-pases';
    const h = document.createElement('h2'); h.textContent = grupo[0].nombre + (grupo.length > 1 ? ' y acompañantes' : '');
    const relacion = document.createElement('p'); relacion.className = 'relacion'; relacion.textContent = grupo[0].relacion;
    section.append(h, relacion);
    const activos = grupo.filter(p => p.activo !== false);
    if (activos.length > 1) section.append(link('Enviar todos los pases por WhatsApp', enlaceWhatsApp(activos)));
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
      if (pase.activo !== false) {
        const form = document.createElement('form'); form.className = 'cambio-mesa';
        const label = document.createElement('label'); label.textContent = 'Cambiar mesa de ' + pase.nombre;
        const select = document.createElement('select'); select.id = 'mesa-' + pase.id; label.htmlFor = select.id;
        select.required = true;
        const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Selecciona una mesa'; select.append(placeholder);
        for (const mesa of mesas) {
          const option = document.createElement('option'); option.value = mesa.numero;
          option.textContent = mesa.texto + ' · ' + mesa.disponibles + ' libres / ' + mesa.capacidad + ' lugares';
          option.selected = mesa.numero === pase.mesa; select.append(option);
        }
        const grupo = document.createElement('input'); grupo.type = 'checkbox'; grupo.checked = true;
        const familia = document.createElement('label'); familia.className = 'filtro-retirados'; familia.append(grupo, document.createTextNode('Mover también a todos sus acompañantes activos'));
        const guardar = document.createElement('button'); guardar.type = 'submit'; guardar.className = 'btn secundario'; guardar.textContent = 'Guardar mesa';
        form.append(label, select, familia, guardar);
        form.addEventListener('submit', event => { event.preventDefault(); cambiarMesa(pase, Number(select.value), grupo.checked, guardar); });
        persona.append(form);
      }
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
    $('panel-pases').hidden = false; $('acceso-pases').hidden = true; $('clave-pases').value = ''; render(); status('');
  } catch (error) { status(error.name === 'TimeoutError' ? 'La consulta tardó demasiado. Intenta nuevamente.' : error.message); }
  finally { ocupado = false; $('actualizar-pases').disabled = false; }
}
$('acceso-pases').addEventListener('submit', async event => {
  event.preventDefault(); clave = $('clave-pases').value.trim(); event.submitter.disabled = true;
  await cargar(); event.submitter.disabled = false;
});
$('actualizar-pases').addEventListener('click', cargar);
$('descargar-excel').addEventListener('click', descargarExcel);
$('buscar-pases').addEventListener('input', render);
$('mostrar-retirados').addEventListener('change', cargar);
$('salir-pases').addEventListener('click', () => { salir(); status('Sesión cerrada.'); });
