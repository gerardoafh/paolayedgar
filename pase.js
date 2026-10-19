(() => {
  const estado = document.getElementById('estado-pase');
  const preview = document.getElementById('imagen-pase');
  const download = document.getElementById('descargar-pase');
  const share = document.getElementById('compartir-pase');
  const token = location.hash.slice(1);
  const cargarImagen = src => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
  const lineas = (ctx, texto, max) => {
    const out = []; let line = '';
    for (const palabra of texto.split(/\s+/)) {
      const next = line ? line + ' ' + palabra : palabra;
      if (line && ctx.measureText(next).width > max) { out.push(line); line = palabra; }
      else line = next;
    }
    if (line) out.push(line);
    return out;
  };
  async function render(pase) {
    const [qr, flores] = await Promise.all([cargarImagen(pase.qr), cargarImagen('/flores-marco.svg')]);
    const canvas = document.createElement('canvas');
    canvas.width = 1000; canvas.height = 1500;
    const c = canvas.getContext('2d');
    c.fillStyle = '#69734c'; c.fillRect(0, 0, 1000, 1500);
    c.globalAlpha = .55;
    c.drawImage(flores, -25, 0, 210, 756);
    c.save(); c.translate(1000, 1500); c.rotate(Math.PI); c.drawImage(flores, -25, 0, 210, 756); c.restore();
    c.globalAlpha = 1;
    c.fillStyle = '#fffdf7';
    c.beginPath(); c.roundRect(85, 85, 830, 1330, [365, 365, 12, 12]); c.fill();
    c.strokeStyle = '#d9b4af'; c.lineWidth = 2;
    c.beginPath(); c.roundRect(110, 110, 780, 1280, [345, 345, 5, 5]); c.stroke();
    c.textAlign = 'center'; c.fillStyle = '#69734c';
    c.font = '22px Georgia'; c.fillText('N U E S T R A   B O D A', 500, 260);
    c.font = '76px "Great Vibes", cursive'; c.fillText('Paola y Edgar', 500, 365);
    c.font = '20px Georgia'; c.fillStyle = '#9b6c70'; c.fillText('P A S E   P E R S O N A L', 500, 445);
    let size = 48, lines;
    do { c.font = `${size}px Georgia`; lines = lineas(c, pase.nombre, 630); size -= 2; } while ((lines.length > 3 || lines.some(s => c.measureText(s).width > 630)) && size >= 24);
    c.fillStyle = '#343b2c';
    lines.forEach((line, i) => c.fillText(line, 500, 525 + i * 55, 650));
    c.font = '24px Georgia'; c.fillStyle = '#69734c'; c.fillText('29 DE NOVIEMBRE DE 2026', 500, 715);
    c.font = '22px Georgia'; c.fillText('Ceremonia 5:00 p. m. · Recepción 7:00 p. m.', 500, 760);
    c.font = '27px Georgia'; c.fillText('Fundador Eventos', 500, 810);
    c.font = '19px Georgia'; c.fillText('Santa Isabel 100, Santa Alicia · Apodaca, N. L.', 500, 850);
    c.drawImage(qr, 340, 890, 320, 320);
    c.font = '20px Georgia'; c.fillStyle = '#9b6c70'; c.fillText('1 PERSONA · ' + pase.codigo, 500, 1260);
    c.font = '18px Georgia'; c.fillStyle = '#69734c'; c.fillText('Conserva tu pase para el día de la boda', 500, 1320);
    return canvas;
  }
  async function start() {
    if (!/^[a-f0-9]{64}$/.test(token)) { estado.textContent = 'Abre el enlace de tu pase desde la confirmación de asistencia.'; return; }
    try {
      const response = await fetch('/api/pase', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }), signal: AbortSignal.timeout(25000)
      });
      const pase = await response.json();
      if (!response.ok) throw new Error(pase.error || 'No pudimos consultar tu pase.');
      try { await Promise.all([document.fonts.load('76px "Great Vibes"'), document.fonts.ready]); } catch {}
      const canvas = await render(pase);
      const data = canvas.toDataURL('image/png');
      preview.src = data;
      preview.alt = 'Pase personal de ' + pase.nombre + ' para la boda de Paola y Edgar';
      preview.hidden = false;
      const filename = 'Pase-Paola-Edgar-' + pase.codigo + '.png';
      download.hidden = false;
      download.addEventListener('click', () => {
        const a = document.createElement('a'); a.href = data; a.download = filename;
        document.body.append(a); a.click(); a.remove();
      });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        share.hidden = false;
        share.addEventListener('click', async () => {
          try { await navigator.share({ title: 'Tu pase · Paola y Edgar', files: [file] }); }
          catch (error) { if (error.name !== 'AbortError') estado.textContent = 'Puedes usar Descargar pase para guardar la imagen.'; }
        });
      }
      document.getElementById('ayuda-pase').hidden = false;
      estado.textContent = 'Asistencia confirmada · ' + pase.nombre;
    } catch (error) {
      estado.textContent = error.name === 'TimeoutError' || error instanceof TypeError
        ? 'No pudimos cargar tu pase. Revisa tu conexión y recarga la página.' : error.message;
    }
  }
  start();
})();
