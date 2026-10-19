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
    if (ready && player.getPlayerState() === YT.PlayerState.PLAYING) { requested = false; player.pauseVideo(); estado(false); }
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
          frame.setAttribute('tabindex', '-1');
          frame.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
          message.textContent = 'Puedes pausar o reproducir la música mientras recorres la invitación.';
          if (requested) reproducir();
        },
        onStateChange: event => {
          if (event.data === YT.PlayerState.PLAYING) estado(true);
          else if ([YT.PlayerState.PAUSED, YT.PlayerState.ENDED, YT.PlayerState.CUED].includes(event.data)) estado(false);
          if (event.data === YT.PlayerState.PLAYING) message.textContent = 'Escuchando Bendita Tu Luz · Maná';
          if (event.data === YT.PlayerState.PAUSED) message.textContent = 'Música en pausa. Puedes continuar cuando quieras.';
        },
        onAutoplayBlocked: () => {
          if (ready && player.getPlayerState() === YT.PlayerState.PLAYING) return;
          estado(false);
          message.textContent = 'Toca «Reproducir música» para escuchar nuestra canción.';
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
  setInterval(() => {
    if (ready) {
      const current = player.getPlayerState();
      if (current === YT.PlayerState.PLAYING) estado(true);
      else if ([YT.PlayerState.PAUSED, YT.PlayerState.ENDED, YT.PlayerState.CUED].includes(current)) estado(false);
    }
  }, 1500);
})();
