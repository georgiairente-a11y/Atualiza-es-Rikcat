// audio.js — controle de música de fundo e efeitos simples

let bgm = null;
let volume = 0.4;

export function initMusic(src = "./assets/music.mp3", vol = 0.4) {
  if (bgm) {
    bgm.pause();
    bgm = null;
  }
  bgm = new Audio(src);
  bgm.loop = true;
  volume = vol;
  bgm.volume = volume;
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

export function setVolume(v) {
  volume = Number(v) || 0;
  if (bgm) bgm.volume = volume;
}
