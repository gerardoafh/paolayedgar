import test from 'node:test';
import assert from 'node:assert/strict';
import { mensajePases, enlaceWhatsApp } from '../lib/reenvio.js';
const pases = [{ nombre: 'Invitada Uno', mesaTexto: 'Mesa 3', url: 'https://paola-edgar.vercel.app/pase#' + 'a'.repeat(64) }, { nombre: 'Invitado Dos', mesaTexto: 'Mesa 3', url: 'https://paola-edgar.vercel.app/pase#' + 'b'.repeat(64) }];
test('comparte el enlace original de cada pase sin generar uno nuevo', () => {
  const mensaje = mensajePases(pases);
  assert(mensaje.includes(pases[0].url)); assert(mensaje.includes(pases[1].url));
  assert(mensaje.includes('Invitada Uno')); assert(mensaje.includes('Invitado Dos'));
  assert(mensaje.includes('Mesa 3'));
  assert.equal(new URL(enlaceWhatsApp(pases)).searchParams.get('text'), mensaje);
});
test('permite enviar un solo pase y no inventa destinatario', () => {
  const url = new URL(enlaceWhatsApp([pases[0]]));
  assert.equal(url.pathname, '/');
  assert(!url.searchParams.has('phone'));
  assert(!url.searchParams.get('text').includes(pases[1].url));
  assert.equal(mensajePases([]), '');
});
