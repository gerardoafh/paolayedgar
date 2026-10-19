import QrScanner from './vendor/qr-scanner.min.js';
const $ = id => document.getElementById(id);
let clave = '', qrActual = '', ocupado = false, scanner;
let llegadas = [], refrescando = false;
const normalizar = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function mostrarLlegadas() {
  const filtro = normalizar($('buscar-llegadas').value.trim());
  const lista = llegadas.filter(pase => normalizar(pase.nombre).includes(filtro));
  $('total-llegadas').textContent = $('cuenta-recibidos').textContent;
  $('lista-llegadas').replaceChildren();
  for (const pase of lista) {
    const row = document.createElement('tr');
    const values = [pase.nombre, new Date(pase.fecha_entrada).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), pase.id.slice(0, 8).toUpperCase()];
    for (const value of values) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
    $('lista-llegadas').append(row);
  }
  $('estado-llegadas').textContent = !llegadas.length ? 'Todavía no se han registrado entradas.'
    : !lista.length ? 'No hay llegadas que coincidan con ese nombre.'
    : `${lista.length} ${lista.length === 1 ? 'persona en la lista' : 'personas en la lista'}.` + (llegadas.length === 1000 ? ' Se muestran las 1000 llegadas más recientes.' : '');
}
async function actualizarLlegadas() {
  if (!clave || refrescando) return;
  refrescando = true; $('actualizar-llegadas').disabled = true;
  try { await api('llegadas'); }
  catch (error) { $('estado-llegadas').textContent = 'No se pudo actualizar la lista: ' + error.message; }
  finally { refrescando = false; $('actualizar-llegadas').disabled = false; }
}
const status = text => $('estado-recepcion').textContent = text;
const resumen = data => {
  if (data) { $('cuenta-confirmados').textContent = data.confirmados; $('cuenta-recibidos').textContent = data.recibidos; }
};
async function api(accion, qr) {
  const response = await fetch('/api/recepcion', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + clave },
    body: JSON.stringify({ accion, qr }), signal: AbortSignal.timeout(25000)
  });
  const data = await response.json();
  if (response.status === 401) salir();
  if (!response.ok) throw new Error(data.error || 'No se pudo verificar el pase.');
  resumen(data.resumen);
  if (data.llegadas) { llegadas = data.llegadas; mostrarLlegadas(); }
  return data;
}
function detener() {
  scanner?.stop(); $('marco-camara').hidden = true;
  $('camara-detener').hidden = true; $('camara-iniciar').hidden = false;
}
function salir() {
  detener(); clave = ''; qrActual = ''; $('clave-recepcion').value = '';
  $('panel-recepcion').hidden = true; $('acceso-recepcion').hidden = false;
  $('resultado-entrada').hidden = true;
  llegadas = []; $('lista-llegadas').replaceChildren(); $('buscar-llegadas').value = '';
}
function resultado(pase) {
  const textos = {
    valido: ['Pase válido', 'Asistencia confirmada. Puedes registrar la entrada.'],
    registrado: ['Entrada registrada', 'Bienvenido/a. Este pase ya quedó utilizado.'],
    utilizado: ['Este pase ya se utilizó', 'No registres otra entrada con este pase.'],
    inactivo: ['Pase inactivo', 'La confirmación cambió. Solicita al invitado su pase actualizado.'],
    no_encontrado: ['Pase no encontrado', 'Este pase no está registrado. Contacta a los novios.']
  };
  const [title, detail] = textos[pase.estado] || ['Pase inválido', 'No pudimos validar este pase.'];
  $('resultado-entrada').hidden = false;
  $('resultado-entrada').dataset.estado = pase.estado;
  $('etiqueta-entrada').textContent = title;
  $('nombre-entrada').textContent = pase.nombre || 'Revisa el pase';
  $('detalle-entrada').textContent = detail + (pase.fecha_entrada ? ' Entrada: ' + new Date(pase.fecha_entrada).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) + '.' : '');
  $('registrar-entrada').hidden = pase.estado !== 'valido';
  const llegada = ['registrado', 'utilizado'].includes(pase.estado) && pase.fecha_entrada;
  $('avisar-llegada').hidden = !llegada;
  $('ayuda-aviso').hidden = !llegada;
  if (llegada) {
    const hora = new Date(pase.fecha_entrada).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
    const message = 'Recepción · Boda de Paola y Edgar\n\nYa llegó: ' + pase.nombre + '\nEntrada registrada: ' + hora + '\nPase: ' + pase.id.slice(0, 8).toUpperCase() + '\n1 persona.';
    $('avisar-llegada').href = 'https://wa.me/528135910620?text=' + encodeURIComponent(message);
  }
  $('resultado-entrada').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
async function consultar(qr) {
  if (ocupado || !clave) return;
  ocupado = true; qrActual = ''; detener(); status('Verificando pase…');
  $('resultado-entrada').hidden = true;
  try { const data = await api('consultar', qr); qrActual = qr; resultado(data.pase); status(''); }
  catch (error) { status(error.name === 'TimeoutError' ? 'La conexión tardó demasiado. Vuelve a consultar antes de admitir al invitado.' : error.message); }
  finally { ocupado = false; }
}
$('acceso-recepcion').addEventListener('submit', async event => {
  event.preventDefault(); clave = $('clave-recepcion').value.trim(); status('Comprobando acceso…');
  const button = event.submitter; button.disabled = true;
  try { await api('resumen'); $('clave-recepcion').value = ''; $('panel-recepcion').hidden = false; $('acceso-recepcion').hidden = true; status(''); }
  catch (error) { clave = ''; status(error.message); }
  finally { button.disabled = false; }
});
$('camara-iniciar').addEventListener('click', async () => {
  status(''); $('resultado-entrada').hidden = true;
  if (!scanner) scanner = new QrScanner($('video-qr'), result => consultar(result.data), {
    preferredCamera: 'environment', highlightScanRegion: true, highlightCodeOutline: true,
    returnDetailedScanResult: true, maxScansPerSecond: 5
  });
  $('marco-camara').hidden = false;
  try { await scanner.start(); $('camara-iniciar').hidden = true; $('camara-detener').hidden = false; }
  catch { detener(); status('No pudimos abrir la cámara. Permite su uso en el navegador, o lee el QR desde una imagen.'); }
});
$('camara-detener').addEventListener('click', detener);
$('imagen-qr').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  detener(); status('Leyendo imagen…');
  try { const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true }); await consultar(result.data); }
  catch { status('No se encontró un QR legible en esta imagen. Prueba con una foto más clara.'); }
  event.target.value = '';
});
$('consulta-manual').addEventListener('submit', event => { event.preventDefault(); consultar($('enlace-qr').value.trim()); });
$('registrar-entrada').addEventListener('click', async event => {
  if (ocupado || !qrActual) return;
  ocupado = true; event.target.disabled = true; status('Registrando entrada…');
  try { const data = await api('registrar', qrActual); resultado(data.pase); status(''); }
  catch (error) { $('registrar-entrada').hidden = true; status('No se pudo comprobar el registro. Consulta de nuevo el pase: ' + error.message); }
  finally { ocupado = false; event.target.disabled = false; }
});
$('siguiente-pase').addEventListener('click', () => { qrActual = ''; $('resultado-entrada').hidden = true; $('enlace-qr').value = ''; status(''); $('camara-iniciar').click(); });
$('cerrar-recepcion').addEventListener('click', () => { salir(); status('Sesión cerrada.'); });
document.addEventListener('visibilitychange', () => { if (document.hidden) detener(); });
window.addEventListener('pagehide', () => scanner?.destroy());
$('buscar-llegadas').addEventListener('input', mostrarLlegadas);
$('actualizar-llegadas').addEventListener('click', actualizarLlegadas);
$('panel-llegadas').addEventListener('toggle', () => { if ($('panel-llegadas').open) actualizarLlegadas(); });
setInterval(() => { if (!document.hidden && $('panel-llegadas').open && !$('panel-recepcion').hidden) actualizarLlegadas(); }, 20000);
