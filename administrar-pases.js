import { enlaceWhatsApp } from './lib/reenvio.js';
const $ = id => document.getElementById(id);
let clave = '', pases = [], ocupado = false;
const normalizar = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const status = value => $('estado-pases').textContent = value;
const link = (text, url, secondary = false) => {
  const a = document.createElement('a'); a.className = 'btn' + (secondary ? ' secundario' : '');
  a.textContent = text; a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
};
function salir() {
  clave = ''; pases = []; $('clave-pases').value = ''; $('buscar-pases').value = '';
  $('familias-pases').replaceChildren(); $('panel-pases').hidden = true; $('acceso-pases').hidden = false;
}
async function copiar(text) {
  try { await navigator.clipboard.writeText(text); status('Enlace copiado. Ya puedes pegarlo en WhatsApp o donde prefieras.'); }
  catch { status('No pudimos copiarlo. Abre el pase y copia su enlace desde la barra del navegador.'); }
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
    if (grupo.length > 1) section.append(link('Enviar todos los pases por WhatsApp', enlaceWhatsApp(grupo)));
    for (const pase of grupo) {
      const persona = document.createElement('div'); persona.className = 'persona-pase';
      const nombre = document.createElement('h3'); nombre.textContent = pase.nombre;
      const detail = document.createElement('p'); detail.textContent = pase.mesaTexto + ' · Pase ' + pase.codigo;
      const estado = document.createElement('p');
      estado.textContent = pase.fechaEntrada ? 'Entrada ya registrada · reenviar no reactiva el pase.' : 'Pase activo · todavía no registra entrada.';
      if (pase.fechaEntrada) estado.className = 'estado-usado';
      const acciones = document.createElement('div'); acciones.className = 'acciones-pase';
      const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'btn secundario'; copy.textContent = 'Copiar enlace';
      copy.addEventListener('click', () => copiar(pase.url));
      acciones.append(link('Ver / descargar pase', pase.url, true), link('Enviar por WhatsApp', enlaceWhatsApp([pase])), copy);
      persona.append(nombre, detail, estado, acciones); section.append(persona);
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
      body: JSON.stringify({ accion: 'pases' }), signal: AbortSignal.timeout(25000)
    });
    const data = await response.json();
    if (response.status === 401) salir();
    if (!response.ok) throw new Error(data.error || 'No pudimos consultar los pases.');
    pases = data.pases.filter(p => typeof p.url === 'string' && /^https:\/\/paola-edgar\.vercel\.app\/pase#[a-f0-9]{64}$/.test(p.url));
    $('panel-pases').hidden = false; $('acceso-pases').hidden = true; $('clave-pases').value = ''; render(); status('');
  } catch (error) { status(error.name === 'TimeoutError' ? 'La consulta tardó demasiado. Intenta nuevamente.' : error.message); }
  finally { ocupado = false; $('actualizar-pases').disabled = false; }
}
$('acceso-pases').addEventListener('submit', async event => {
  event.preventDefault(); clave = $('clave-pases').value.trim(); event.submitter.disabled = true;
  await cargar(); event.submitter.disabled = false;
});
$('actualizar-pases').addEventListener('click', cargar);
$('buscar-pases').addEventListener('input', render);
$('salir-pases').addEventListener('click', () => { salir(); status('Sesión cerrada.'); });
