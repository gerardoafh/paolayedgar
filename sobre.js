(() => {
  const intro = document.getElementById('sobre-inicio');
  const button = document.getElementById('abrir-sobre');
  let opened = false;
  document.body.classList.add('sobre-cerrado');
  button.addEventListener('click', () => {
    if (opened) return;
    opened = true;
    intro.classList.add('abriendo');
    button.disabled = true;
    const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1250;
    setTimeout(() => {
      intro.hidden = true;
      document.body.classList.remove('sobre-cerrado');
      window.scrollTo(0, 0);
      document.querySelector('h1').focus({ preventScroll: true });
    }, delay);
  });
})();
