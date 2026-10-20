(function () {
  const modal = document.getElementById('confirmacion');
  const form = document.getElementById('form-confirmacion');
  const status = document.getElementById('estado-confirmacion');
  const continuar = document.getElementById('continuar-whatsapp');
  const names = document.getElementById('nombres-invitados');
  const generales = document.getElementById('invitados-generales');
  const campos = document.getElementById('campos-invitados');
  const agregar = document.getElementById('agregar-invitado');
  const total = document.getElementById('total-invitados');
  const listaPases = document.getElementById('lista-pases');
  const relacion = document.getElementById('relacion-invitados');
  const familia = document.getElementById('familia-hermanos');
  const hermano = document.getElementById('nombre-hermano');
  const pareja = document.getElementById('nombre-pareja');
  const hijos = document.getElementById('nombres-hijos');
  function cambiarRelacion() {
    const esHermano = relacion.value.startsWith('Hermanos');
    familia.hidden = !esHermano;
    hermano.required = esHermano;
    for (const field of [hermano, pareja, hijos]) field.disabled = !esHermano;
    generales.hidden = esHermano;
    generales.disabled = esHermano;
  }
  relacion.addEventListener('change', cambiarRelacion);
  cambiarRelacion();
  let requestId = crypto.randomUUID();
  let busy = false;
  let siguienteInvitado = 1;
  function limpiarResultado() {
    names.setCustomValidity('');
    hermano.setCustomValidity('');
    continuar.hidden = true;
    listaPases.hidden = true;
    status.textContent = '';
  }
  function actualizarInvitados() {
    const filas = [...campos.children];
    filas.slice(1).forEach((fila, i) => {
      fila.querySelector('label').textContent = 'Nombre completo del invitado ' + (i + 2);
      fila.querySelector('button').setAttribute('aria-label', 'Quitar invitado ' + (i + 2));
    });
    agregar.disabled = filas.length >= 16;
    total.textContent = filas.length + (filas.length === 1 ? ' persona en esta confirmación' : ' personas en esta confirmación');
  }
  agregar.addEventListener('click', () => {
    if (busy || campos.children.length >= 16) return;
    const fila = document.createElement('div');
    fila.className = 'campo-invitado';
    const input = document.createElement('input');
    input.id = 'invitado-' + siguienteInvitado++;
    input.name = 'nombre-invitado'; input.type = 'text';
    input.required = true; input.maxLength = 150;
    input.placeholder = 'Nombre y apellidos';
    const label = document.createElement('label');
    label.htmlFor = input.id;
    const quitar = document.createElement('button');
    quitar.type = 'button'; quitar.className = 'quitar-invitado';
    quitar.textContent = 'Quitar';
    quitar.addEventListener('click', () => {
      if (busy) return;
      fila.remove(); actualizarInvitados(); limpiarResultado(); agregar.focus();
    });
    fila.append(label, input, quitar); campos.append(fila);
    actualizarInvitados(); limpiarResultado(); input.focus();
  });
  document.getElementById('rsvp').addEventListener('click', () => modal.showModal());
  modal.querySelector('.cerrar-confirmacion').addEventListener('click', () => modal.close());
  form.addEventListener('input', limpiarResultado);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const esHermano = relacion.value.startsWith('Hermanos');
    const integrantes = esHermano ? [
      { nombre: hermano.value.trim(), parentesco: 'Hermano/a' },
      ...(pareja.value.trim() ? [{ nombre: pareja.value.trim(), parentesco: 'Pareja' }] : []),
      ...hijos.value.split(/\r?\n/).map(n => n.trim()).filter(Boolean).map(nombre => ({ nombre, parentesco: 'Hijo/a' }))
    ] : [];
    const invitados = [...campos.querySelectorAll('input')];
    const incompleto = !esHermano && invitados.find(input => !input.value.trim());
    if (incompleto) {
      incompleto.setCustomValidity('Escribe el nombre de este invitado o quítalo de la lista.');
      incompleto.reportValidity();
      incompleto.addEventListener('input', () => incompleto.setCustomValidity(''), { once: true });
      return;
    }
    const nombres = esHermano ? integrantes.map(p => p.nombre).join('\n') : invitados.map(input => input.value.trim()).join('\n');
    if (!nombres || (esHermano && !integrantes[0].nombre)) {
      if (esHermano) { hermano.setCustomValidity('Escribe el nombre del hermano o hermana.'); hermano.reportValidity(); return; }
      names.setCustomValidity('Escribe los nombres de quienes asistirán.');
      names.reportValidity();
      return;
    }
    const number = event.submitter?.value;
    if (!['528119831332', '528135910620'].includes(number)) return;
    const relationship = relacion.value;
    const payload = { id: requestId, nombres, relacion: relationship, telefono: number, integrantes };
    const controls = [...form.querySelectorAll('input, textarea, select, button')].map(control => ({ control, disabled: control.disabled }));
    busy = true;
    controls.forEach(({ control }) => control.disabled = true);
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
          label.textContent = (pase.mesaTexto ? pase.mesaTexto + ' · ' : '') + 'VER Y DESCARGAR PASE · ' + pase.codigo;
          link.append(label); listaPases.append(link);
        }
        listaPases.hidden = false;
        if (result.mesasPendientes) status.textContent = 'Tu asistencia está registrada. La mesa de alguna persona está pendiente de acomodo; puedes descargar tus pases y consultarlo con los novios.';
      } else if (result.pasesPendientes) {
        status.textContent = 'Tu asistencia está registrada. No pudimos generar los pases todavía; pulsa Confirmar nuevamente para reintentar sin duplicar el registro.';
      }
    } catch (error) {
      status.textContent = error.name === 'TimeoutError' || error instanceof TypeError
        ? 'No pudimos comprobar el registro. Revisa tu conexión y vuelve a intentar; tus datos siguen aquí.'
        : error.message;
    } finally {
      busy = false;
      controls.forEach(({ control, disabled }) => control.disabled = disabled);
    }
  });
})();
