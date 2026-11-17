const $ = id => document.getElementById(id);
const cargarImagen = src => new Promise((resolve, reject) => {
  const imagen = new Image();
  imagen.onload = () => resolve(imagen);
  imagen.onerror = () => reject(new Error('No pudimos cargar la imagen del pase. Recarga la página.'));
  imagen.src = src;
});
const etiquetaMesa = mesa => mesa == null ? 'Por asignar' : mesa <= 2 ? 'Imperial ' + mesa : 'Mesa ' + mesa;
const cantidad = n => n + (n === 1 ? ' persona' : ' personas');

async function dibujar(pase) {
  const [foto, qr] = await Promise.all([cargarImagen('/assets/foto-1.webp'), cargarImagen(pase.qr)]);
  const canvas = document.createElement('canvas');
  canvas.width = 900; canvas.height = 1410;
  const c = canvas.getContext('2d');
  const crema = '#fff9ec', oliva = '#414c32', dorado = '#816437', rosa = '#e8cdc7';
  const centrado = (t, x, y, font, color = oliva, ancho = 800) => {
    c.textAlign = 'center'; c.font = font; c.fillStyle = color; c.fillText(t, x, y, ancho);
  };
  c.fillStyle = oliva; c.fillRect(0,0,900,1410);
  c.fillStyle = crema; c.fillRect(0,0,900,269);
  centrado('N U E S T R A   B O D A',450,58,'20px Georgia');
  centrado('Paola y Edgar',450,143,'76px Georgia');
  centrado('29  ·  NOVIEMBRE  ·  2026',450,203,'23px Georgia',dorado);
  c.fillStyle = rosa; c.fillRect(407,226,86,3);
  const hFoto=600, escala=Math.max(900/foto.width,hFoto/foto.height);
  const wOrigen=900/escala,hOrigen=hFoto/escala;
  c.save();
  c.filter = 'saturate(0.78)';
  c.drawImage(foto,(foto.width-wOrigen)/2,(foto.height-hOrigen)/2,wOrigen,hOrigen,0,255,900,hFoto);
  c.restore();
  const sombra = c.createLinearGradient(0,665,0,855);
  sombra.addColorStop(0,'#26302200'); sombra.addColorStop(1,'#414c32');
  c.fillStyle=sombra; c.fillRect(0,665,900,190);
  c.fillStyle=crema; c.fillRect(53,792,794,323);
  c.strokeStyle=dorado; c.lineWidth=2; c.strokeRect(63,802,774,303);
  centrado('P A S E   A   N O M B R E   D E',450,840,'19px Georgia',dorado);
  let tam=46, lineas;
  do {
    c.font=tam+'px Georgia'; lineas=[''];
    for (const palabra of pase.nombre.split(/\s+/)) {
      const i=lineas.length-1, usada=lineas[i];
      const siguiente=usada ? usada+' '+palabra : palabra;
      if (usada && c.measureText(siguiente).width > 680) lineas.push(palabra);
      else lineas[i]=siguiente;
    }
    if (lineas.length<=2) break;
  } while ((tam-=2)>20);
  lineas.slice(0,3).forEach((linea,i) => centrado(linea,450,895+i*33,tam+'px Georgia',oliva,680));
  c.strokeStyle='#cec1a7'; c.beginPath(); c.moveTo(97,970); c.lineTo(803,970); c.moveTo(484,983); c.lineTo(484,1084); c.stroke();
  centrado(pase.mesas.length===1 ? 'ACOMODO' : 'ACOMODO DISTRIBUIDO',291,1001,'19px Georgia',dorado);
  const mesas = pase.mesas.map(({mesa,cantidad:n}) => etiquetaMesa(mesa) + (pase.mesas.length>1 ? ' ('+n+')' : ''));
  if (mesas.length === 1) centrado(mesas[0],291,1058,'36px Georgia',oliva,368);
  else {
    const bloques = mesas.length <= 6 ? [mesas.slice(0,3),mesas.slice(3)] : [];
    if (bloques.length) bloques.filter(b=>b.length).forEach((b,i)=>centrado(b.join(' · '),291,1035+i*26,'21px Georgia',oliva,368));
    else centrado('Ver mesas en el enlace',291,1050,'25px Georgia',oliva,368);
  }
  centrado('PASE DE GRUPO',662,1001,'19px Georgia',dorado);
  centrado(cantidad(pase.total),662,1058,'36px Georgia',oliva,300);
  c.drawImage(qr,67,1150,182,182);
  centrado('FUNDADOR EVENTOS',549,1194,'30px Georgia',crema,560);
  centrado('Recepción 7:00 p. m.  ·  Vestimenta formal',549,1236,'23px Georgia',crema,545);
  centrado('Presenta este QR en recepción',549,1281,'22px Georgia',rosa,540);
  centrado('¡Nos vemos en la boda!',450,1373,'30px Georgia',crema);
  return canvas;
}

async function iniciar() {
  const token = location.hash.slice(1);
  if (!/^[a-f0-9]{64}$/.test(token)) {
    $('estado-pase').textContent = 'Abre el enlace del pase de grupo que te enviaron los novios.';
    return;
  }
  try {
    const response = await fetch('/api/pase', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, grupo: true }), signal: AbortSignal.timeout(25000)
    });
    const pase = await response.json();
    if (!response.ok) throw new Error(pase.error || 'No pudimos consultar el pase.');
    {
      const canvas = await dibujar(pase);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('No pudimos preparar la imagen del pase.');
      const url = URL.createObjectURL(blob);
      const nombre = 'Pase-de-grupo-Paola-Edgar-' + pase.codigo + '.png';
      const img = $('imagen-pase'); img.src = url; img.alt = 'Pase de grupo a nombre de ' + pase.nombre; img.hidden = false;
      const descarga = $('descargar-grupo'); descarga.href = url; descarga.download = nombre; descarga.hidden = false;
      const file = new File([blob], nombre, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        const boton = $('compartir-grupo'); boton.hidden = false;
        boton.addEventListener('click', async () => {
          try { await navigator.share({ title: 'Pase de grupo · Paola y Edgar', files: [file] }); }
          catch (error) { if (error.name !== 'AbortError') $('estado-pase').textContent = 'Puedes usar Descargar pase PNG para guardarlo.'; }
        });
      }
    }
    $('ayuda-grupo').hidden = false;
    $('estado-pase').textContent = pase.nombre + ' · ' + cantidad(pase.total) + ' · ' +
      pase.mesas.map(m => etiquetaMesa(m.mesa) + (pase.mesas.length > 1 ? ' ('+m.cantidad+')' : '')).join(', ');
  } catch (error) {
    $('estado-pase').textContent = error.name === 'TimeoutError' || error instanceof TypeError
      ? 'No pudimos conectar. Recarga la página para intentar de nuevo.' : error.message;
  }
}
iniciar();
