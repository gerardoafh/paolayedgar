export function mensajePases(pases) {
  if (!pases.length) return '';
  const saludo = pases.length === 1
    ? '¡Hola! Te compartimos nuevamente tu pase para la boda de Paola y Edgar, el 29 de noviembre de 2026.'
    : '¡Hola! Les compartimos nuevamente sus pases para la boda de Paola y Edgar, el 29 de noviembre de 2026.';
  return saludo + '\n\n' + pases.map(p => `${p.nombre}\n${p.mesaTexto}\n${p.url}`).join('\n\n')
    + '\n\nAbre cada enlace y pulsa Descargar pase para guardarlo como imagen. Conserva el pase para el día de la boda. ¡Nos encantará compartir este día contigo!';
}
export const enlaceWhatsApp = pases => 'https://wa.me/?text=' + encodeURIComponent(mensajePases(pases));
