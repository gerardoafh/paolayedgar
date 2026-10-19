from pathlib import Path
import re

p = Path(__file__).with_name('index.html')
h = p.read_text(encoding='utf-8')
h, n = re.subn(r'<a\b[^>]*id="rsvp"[^>]*>.*?</a>', '<button class="btn" type="button" id="rsvp">Confirmar asistencia</button>', h)
assert n == 1, 'No se encontró el botón de confirmación'
css = '''
#confirmacion{width:min(540px,calc(100% - 32px));max-height:90dvh;overflow:auto;border:1px solid var(--line);background:var(--bg);color:var(--ink);padding:32px 24px;text-align:left;box-shadow:0 20px 80px #0004}
#confirmacion::backdrop{background:#262d20b8}#confirmacion h2{text-align:center;font-size:2.8rem;margin:12px 0 24px}#confirmacion label{display:block;margin:18px 0 6px;font-weight:600}#confirmacion textarea,#confirmacion select{display:block;width:100%;padding:12px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:inherit;border-radius:0}#confirmacion textarea{min-height:110px;resize:vertical}.cerrar-confirmacion{display:block;margin-left:auto;background:none;border:0;font:inherit;color:var(--accent);cursor:pointer}.acciones-rsvp{display:grid;gap:12px;margin-top:24px}.acciones-rsvp .btn{margin:0;width:100%;cursor:pointer;line-height:1.6}.nota-rsvp{font-size:1rem;line-height:1.4;margin-top:18px}button.btn{cursor:pointer}
'''
markup = '''
<dialog id="confirmacion" aria-labelledby="titulo-confirmacion">
  <button type="button" class="cerrar-confirmacion" aria-label="Cerrar confirmación">Cerrar ×</button>
  <h2 id="titulo-confirmacion">Confirma tu asistencia</h2>
  <form id="form-confirmacion">
    <label for="nombres-invitados">Nombres de los invitados que asistirán</label>
    <textarea id="nombres-invitados" name="nombres" required maxlength="1500" placeholder="Escribe el nombre y apellido de cada invitado, uno por línea"></textarea>
    <label for="relacion-invitados">¿De parte de quién nos acompañan?</label>
    <select id="relacion-invitados" name="relacion" required>
      <option value="">Selecciona una opción</option>
      <option>Familiares de la novia</option>
      <option>Familiares del novio</option>
      <option>Amigos de la novia</option>
      <option>Amigos del novio</option>
      <option>Familiares de ambos</option>
      <option>Amigos de ambos</option>
    </select>
    <p class="nota-rsvp">Elige uno de los dos números para enviar tu confirmación. WhatsApp abrirá el mensaje con tus datos; pulsa Enviar para completarla.</p>
    <div class="acciones-rsvp">
      <button class="btn" type="submit" value="528119931332">Enviar al 81 1993 1332</button>
      <button class="btn" type="submit" value="528135910620">Enviar al 81 3591 0620</button>
    </div>
    <p id="estado-confirmacion" class="nota-rsvp" role="status"></p>
  </form>
</dialog>
<script>
(function(){
  const modal = document.getElementById('confirmacion');
  const form = document.getElementById('form-confirmacion');
  document.getElementById('rsvp').addEventListener('click',function(){modal.showModal()});
  modal.querySelector('.cerrar-confirmacion').addEventListener('click',function(){modal.close()});
  form.addEventListener('submit',function(event){
    event.preventDefault();
    const names = document.getElementById('nombres-invitados');
    if(!names.value.trim()){names.setCustomValidity('Escribe los nombres de quienes asistirán.');names.reportValidity();return;}
    names.setCustomValidity('');
    const number = event.submitter && event.submitter.value;
    if(!['528119931332','528135910620'].includes(number))return;
    const relationship = document.getElementById('relacion-invitados').value;
    const message = '¡Hola! Confirmamos nuestra asistencia a la boda de Paola y Edgar, el 29 de noviembre de 2026.\\n\\nInvitados:\\n' + names.value.trim() + '\\n\\nSomos: ' + relationship + '.';
    window.open('https://wa.me/' + number + '?text=' + encodeURIComponent(message),'_blank','noopener,noreferrer');
    document.getElementById('estado-confirmacion').textContent='Completa el envío en WhatsApp para que los novios reciban tu confirmación.';
  });
  document.getElementById('nombres-invitados').addEventListener('input',function(){this.setCustomValidity('')});
})();
</script>
'''
h = h.replace('</style>', css + '\n</style>').replace('</body>', markup + '\n</body>')
p.write_text(h, encoding='utf-8')
readme = p.with_name('README.md')
r = readme.read_text(encoding='utf-8')
r = r.replace('## Pendiente de personalizar\n\nReemplazar `52XXXXXXXXXX` en `index.html` por el número de WhatsApp de confirmación.', '## Confirmaciones\n\nEl formulario solicita los nombres y la relación con los novios. Permite enviar la confirmación por WhatsApp al 81 1993 1332 o al 81 3591 0620. El invitado debe pulsar Enviar en WhatsApp; no hay base de datos de confirmaciones.')
readme.write_text(r, encoding='utf-8')
print('Ventana de confirmación agregada con ambos números.')
