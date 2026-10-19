(() => {
  const control = document.getElementById('control-musica');
  const message = document.getElementById('estado-musica');
  let player, ready = false, playing = false, requested = false;
  function estado(active) {
    playing = active;
    control.textContent = active ? 'Ⅱ Pausar música' : '♫ Reproducir música';
    control.setAttribute('aria-pressed', String(active));
  }
  function reproducir() {
    requested = true;
    if (ready) { player.unMute(); player.playVideo(); }
  }
  function mostrarControl() { control.hidden = false; reproducir(); }
  document.getElementById('abrir-sobre').addEventListener('click', mostrarControl, { once: true });
  control.addEventListener('click', () => {
    if (playing) { requested = false; player.pauseVideo(); }
    else reproducir();
  });
  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('video-cancion', {
      host: 'https://www.youtube-nocookie.com',
      videoId: '44kityInDvM', width: '480', height: '270',
      playerVars: {
        playsinline: 1, controls: 1, rel: 0,
        loop: 1, playlist: '44kityInDvM', origin: location.origin
      },
      events: {
        onReady: event => {
          ready = true; control.disabled = false;
          event.target.setVolume(35);
          const frame = event.target.getIframe();
          frame.title = 'Maná · Bendita Tu Luz · Video oficial';
          frame.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
          message.textContent = 'Puedes pausar o reproducir la música mientras recorres la invitación.';
          if (requested) reproducir();
        },
        onStateChange: event => {
          estado(event.data === YT.PlayerState.PLAYING);
          if (event.data === YT.PlayerState.PLAYING) message.textContent = 'Escuchando Bendita Tu Luz · Maná';
        },
        onAutoplayBlocked: () => {
          estado(false);
          message.textContent = 'Toca «Reproducir música» o el video para escuchar nuestra canción.';
        },
        onError: () => {
          estado(false); control.disabled = true;
          message.textContent = 'No pudimos reproducir la canción aquí. Puedes escucharla desde el enlace de YouTube.';
        }
      }
    });
  };
  const script = document.createElement('script');
  script.src = 'https://www.youtube.com/iframe_api';
  script.onerror = () => {
    message.textContent = 'El reproductor no pudo cargar. Puedes escuchar la canción desde el enlace de YouTube.';
  };
  document.head.append(script);
})();
