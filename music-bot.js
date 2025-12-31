// music-boot.js — inicia música após interação do usuário
import { initMusic, playMusic } from "./audio.js";

// pega os botões (se existirem)
const tryAttach = () => {
  const soloBtn = document.getElementById("soloBtn");
  const multiBtn = document.getElementById("multiBtn");
  const titleScreen = document.getElementById("titleScreen");

  // se não existir ainda, tenta de novo depois
  if (!soloBtn && !multiBtn) {
    // espera o DOM ou outro script colocar os elementos
    setTimeout(tryAttach, 300);
    return;
  }

  const startMusicOnce = () => {
    // init + play após interação (respeita regras do navegador)
    initMusic("./assets/music.mp3", 0.4);
    playMusic();
    // remover os listeners para não repetir
    if (soloBtn) soloBtn.removeEventListener("click", startMusicOnce);
    if (multiBtn) multiBtn.removeEventListener("click", startMusicOnce);
  };

  if (soloBtn) soloBtn.addEventListener("click", startMusicOnce);
  if (multiBtn) multiBtn.addEventListener("click", startMusicOnce);

  // também tenta iniciar se qualquer outro clique acontecer (fallback)
  titleScreen && titleScreen.addEventListener("click", startMusicOnce, { once: true });
};

// inicie a tentativa após carregar o script
tryAttach();
