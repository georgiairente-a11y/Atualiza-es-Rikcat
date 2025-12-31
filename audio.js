// audio.js — música de fundo (isolado, não interfere no jogo)
let bgm = null;

export function initMusic(src = "./assets/music.mp3", vol = 0.4) {
  if (bgm) return;
  bgm = new Audio(src);
  bgm.loop = true;
  bgm.volume = vol;
}

export function playMusic() {
  if (!bgm) return;
  bgm.play().catch(() => {});
}

export function stopMusic() {
  if (!bgm) return;
  bgm.pause();
  bgm.currentTime = 0;
}

export function setVolume(v) {
  if (!bgm) return;
  bgm.volume = Number(v) || 0;
}
