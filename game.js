import { db, ref, set, onValue, onDisconnect, push } from "./firebase.js";
import { drawRikcat } from "./rikcat.js";
import { initMusic, playMusic } from "./audio.js";
import { tryPassword, isAdmin, wireEffectsRef, effects, spawnEffect } from "./admin.js";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = innerWidth;
canvas.height = innerHeight;

const isPC = !/Android|iPhone|iPad/i.test(navigator.userAgent);

if (isPC) {
  document.querySelectorAll(".btn").forEach(b => b.style.display = "none");
}

let camX = 0;
let room = "global";
let playerId = Math.random().toString(36).slice(2);

const keys = {};
window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

const players = {};
const playerRef = ref(db, `rooms/${room}/players/${playerId}`);

const player = {
  x: 100,
  y: 0,
  w: 32,
  h: 32,
  vx: 0,
  vy: 0,
  onGround: false,
  facing: 1,
  nick: "Player",
  color: "#FFB000"
};

set(playerRef, player);
onDisconnect(playerRef).remove();

const playersRef = ref(db, `rooms/${room}/players`);
onValue(playersRef, snap => {
  Object.assign(players, snap.val() || {});
});

const effectsRef = ref(db, `rooms/${room}/effects`);
wireEffectsRef(effectsRef);

function handleKeyboard() {
  if (keys["a"] || keys["arrowleft"]) player.vx = -3;
  else if (keys["d"] || keys["arrowright"]) player.vx = 3;
  else player.vx = 0;

  if ((keys["w"] || keys["arrowup"] || keys[" "]) && player.onGround) {
    player.vy = -10;
    player.onGround = false;
  }
}

function physics() {
  player.vy += 0.5;
  player.x += player.vx;
  player.y += player.vy;

  if (player.y > canvas.height - 40) {
    player.y = canvas.height - 40;
    player.vy = 0;
    player.onGround = true;
  }

  camX = player.x - canvas.width / 2;
}

function update() {
  if (isPC) handleKeyboard();
  physics();
  set(playerRef, player);
}

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  Object.values(players).forEach(p => {
    drawRikcat(ctx, p, camX);
  });

  effects.forEach(e => {
    ctx.strokeStyle = "orange";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(e.x - camX, e.y);
    ctx.lineTo(e.x - camX + e.dir * e.len, e.y);
    ctx.stroke();
  });
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();

// MOBILE CONTROLES
document.getElementById("left").ontouchstart = () => player.vx = -3;
document.getElementById("right").ontouchstart = () => player.vx = 3;
document.getElementById("left").ontouchend =
document.getElementById("right").ontouchend = () => player.vx = 0;
document.getElementById("jump").ontouchstart = () => {
  if (player.onGround) {
    player.vy = -10;
    player.onGround = false;
  }
};

// FIRE ADM
document.getElementById("fireBtn").onclick = () => {
  spawnEffect(player.x, player.y + 10, player.facing);
};

// CHAT
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const chatRef = ref(db, `rooms/${room}/chat`);

onValue(chatRef, snap => {
  chatBox.innerHTML = "";
  Object.values(snap.val() || {}).forEach(m => {
    chatBox.innerHTML += `<div><b>${m.nick}:</b> ${m.text}</div>`;
  });
  chatBox.scrollTop = chatBox.scrollHeight;
});

chatInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && chatInput.value.trim()) {
    push(chatRef, { nick: player.nick, text: chatInput.value });
    chatInput.value = "";
  }
});

// MÚSICA
document.getElementById("soloBtn").onclick =
document.getElementById("multiBtn").onclick = () => {
  initMusic();
  playMusic();
  document.getElementById("titleScreen").style.display = "none";
  document.getElementById("game").style.display = "block";
};
