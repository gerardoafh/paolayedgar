(function () {
  const modal = document.getElementById('confirmacion');
  const form = document.getElementById('form-confirmacion');
  const status = document.getElementById('estado-confirmacion');
  const continuar = document.getElementById('continuar-whatsapp');
  const names = document.getElementById('nombres-invitados');
  const listaPases = document.getElementById('lista-pases');
  let requestId = crypto.randomUUID();
  let busy = false;
  document.getElementById('rsvp').addEventListener('click', () => modal.showModal());
  modal.querySelector('.cerrar-confirmacion').addEventListener('click', () => modal.close());
  for (const field of [names, document.getElementById('relacion-invitados')]) {
    field.addEventListener('input', () => {
      names.setCustomValidity('');
      continuar.hidden = true;
      listaPases.hidden = true;
      status.textContent = '';
    });
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    if (!names.value.trim()) {
      names.setCustomValidity('Escribe los nombres de quienes asistirán.');
      names.reportValidity();
      return;
    }
    const number = event.submitter?.value;
    if (!['528119831332', '528135910620'].includes(number)) return;
    const relationship = document.getElementById('relacion-invitados').value;
    const payload = { id: requestId, nombres: names.value.trim(), relacion: relationship, telefono: number };
    const buttons = [...form.querySelectorAll('button[type="submit"]')];
    busy = true;
    buttons.forEach(button => button.disabled = true);
    continuar.hidden = true;
    listaPases.hidden = true;
    status.textContent = 'Guardando tu confirmación…';
    try {
      const response = await fetch('/api/confirmaciones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(25000)
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'No pudimos guardar tu confirmación. Intenta de nuevo.');
      const message = '¡Hola! Confirmamos nuestra asistencia a la boda de Paola y Edgar, el 29 de noviembre de 2026.\n\nInvitados:\n' + payload.nombres + '\n\nSomos: ' + relationship + '.';
      continuar.href = 'https://wa.me/' + number + '?text=' + encodeURIComponent(message);
      continuar.textContent = 'Continuar por WhatsApp';
      continuar.hidden = false;
      status.textContent = '¡Tu asistencia quedó registrada! Si deseas, también puedes avisarnos por WhatsApp.';
      listaPases.replaceChildren();
      if (result.pases?.length) {
        const heading = document.createElement('h3');
        heading.textContent = result.pases.length === 1 ? 'Tu pase digital' : 'Sus pases digitales';
        const help = document.createElement('p');
        help.textContent = 'Hay un pase por persona. Abre cada uno y guárdalo como imagen para el día de la boda.';
        listaPases.append(heading, help);
        for (const pase of result.pases) {
          if (typeof pase.url !== 'string' || !/^\/pase#[a-f0-9]{64}$/.test(pase.url)) continue;
          const link = document.createElement('a');
          link.href = pase.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
          link.append(document.createTextNode(pase.nombre));
          const label = document.createElement('span');
          label.textContent = 'VER Y DESCARGAR PASE · ' + pase.codigo;
          link.append(label); listaPases.append(link);
        }
        listaPases.hidden = false;
      } else if (result.pasesPendientes) {
        status.textContent = 'Tu asistencia está registrada. No pudimos generar los pases todavía; pulsa Confirmar nuevamente para reintentar sin duplicar el registro.';
      }
    } catch (error) {
      status.textContent = error.name === 'TimeoutError' || error instanceof TypeError
        ? 'No pudimos comprobar el registro. Revisa tu conexión y vuelve a intentar; tus datos siguen aquí.'
        : error.message;
    } finally {
      busy = false;
      buttons.forEach(button => button.disabled = false);
    }
  });
})();
