// audio.js — música de fundo

let bgm = null;

export function initMusic() {
  bgm = new Audio("./assets/music.mp3");
  bgm.loop = true;
  bgm.volume = 0.4;
}

export function playMusic() {
  if (!bgm) return;
  bgm.play().catch(()=>{});
}

export function stopMusic() {
  if (!bgm) return;
  bgm.pause();
  bgm.currentTime = 0;
}
