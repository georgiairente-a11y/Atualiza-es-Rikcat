// game.js — PC + Mobile + Multiplayer (corrigido)
import { db, ref, set, push, onValue, onDisconnect } from "./firebase.js";
import { drawRikcat } from "./rikcat.js";
import { initMusic, playMusic, setVolume } from "./audio.js";
import { tryPassword, isAdmin, wireEffectsRef, effects, spawnEffect } from "./admin.js";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

function fitCanvas() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
fitCanvas();
window.addEventListener("resize", fitCanvas);

const isPC = !/Android|iPhone|iPad/i.test(navigator.userAgent);

if (isPC) {
  document.querySelectorAll(".btn").forEach(b => b.style.display = "none");
}

let camX = 0;
const room = "global";
const playerId = Math.random().toString(36).slice(2);

let localPlayers = {}; // store from DB

const keys = {};
window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
});
window.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
});

// player default
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

// Firebase refs
const playerRef = ref(db, `rooms/${room}/players/${playerId}`);
const playersRef = ref(db, `rooms/${room}/players`);
const effectsRef = ref(db, `rooms/${room}/effects`);
const chatRef = ref(db, `rooms/${room}/chat`);

wireEffectsRef(effectsRef);

// write initial player (will be updated continuously)
set(playerRef, player);
onDisconnect(playerRef).remove();

// read players
onValue(playersRef, snap => {
  localPlayers = snap.val() || {};
});

// read chat
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
onValue(chatRef, snap => {
  const val = snap.val() || {};
  chatBox.innerHTML = "";
  Object.values(val).forEach(m => {
    chatBox.innerHTML += `<div><b>${escapeHtml(m.nick)}:</b> ${escapeHtml(m.text)}</div>`;
  });
  if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
});

function escapeHtml(text) {
  return String(text || "").replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}

chatInput && chatInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && chatInput.value.trim()) {
    push(chatRef, { nick: player.nick, text: chatInput.value });
    chatInput.value = "";
  }
});

// control handling
function handleKeyboard() {
  if (keys["a"] || keys["arrowleft"]) {
    player.vx = -3;
    player.facing = -1;
  } else if (keys["d"] || keys["arrowright"]) {
    player.vx = 3;
    player.facing = 1;
  } else {
    player.vx = 0;
  }

  if ((keys["w"] || keys["arrowup"] || keys[" "]) && player.onGround) {
    player.vy = -10;
    player.onGround = false;
  }
}

// mobile/touch controls
const leftBtn = document.getElementById("left");
const rightBtn = document.getElementById("right");
const jumpBtn = document.getElementById("jump");

if (leftBtn) {
  leftBtn.addEventListener("pointerdown", (e) => { player.vx = -3; player.facing = -1; e.preventDefault(); });
  leftBtn.addEventListener("pointerup", () => { player.vx = 0; });
  leftBtn.addEventListener("pointercancel", () => { player.vx = 0; });
}
if (rightBtn) {
  rightBtn.addEventListener("pointerdown", (e) => { player.vx = 3; player.facing = 1; e.preventDefault(); });
  rightBtn.addEventListener("pointerup", () => { player.vx = 0; });
  rightBtn.addEventListener("pointercancel", () => { player.vx = 0; });
}
if (jumpBtn) {
  jumpBtn.addEventListener("pointerdown", () => {
    if (player.onGround) {
      player.vy = -10;
      player.onGround = false;
    }
  });
}

// physics
function physics() {
  player.vy += 0.5; // gravity

  player.x += player.vx;
  player.y += player.vy;

  const groundY = canvas.height - 40;
  if (player.y >= groundY) {
    player.y = groundY;
    player.vy = 0;
    player.onGround = true;
  } else {
    player.onGround = false;
  }

  camX = player.x - canvas.width / 2;
}

// update -> write to firebase
function update() {
  if (isPC) handleKeyboard();
  physics();
  // update player data to DB (minimal set)
  const toSend = {
    x: player.x,
    y: player.y,
    vx: player.vx,
    vy: player.vy,
    onGround: player.onGround,
    facing: player.facing,
    nick: player.nick,
    color: player.color,
    w: player.w,
    h: player.h,
    updatedAt: Date.now()
  };
  set(playerRef, toSend);
}

function drawBackground() {
  // sky
  ctx.fillStyle = "#6aa5ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ground (long rect)
  ctx.fillStyle = "#3cb371";
  ctx.fillRect(-camX - 1000, canvas.height - 40, 10000, 40);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  // draw other players (and ourselves)
  Object.entries(localPlayers).forEach(([id, p]) => {
    // p may be plain object from DB - ensure defaults
    const px = {
      x: p.x || 0,
      y: p.y || 0,
      vx: p.vx || 0,
      vy: p.vy || 0,
      onGround: !!p.onGround,
      facing: (typeof p.facing === "number") ? p.facing : 1,
      nick: p.nick || "Player",
      color: p.color || "#FFB000",
      w: p.w || 32,
      h: p.h || 32
    };
    drawRikcat(ctx, px, camX);
  });

  // draw effects (from admin module)
  effects.forEach(e => {
    ctx.strokeStyle = "orange";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(e.x - camX, e.y);
    ctx.lineTo(e.x - camX + e.dir * (e.len || 400), e.y);
    ctx.stroke();
  });
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();

// title screen buttons (play music after interaction)
const soloBtn = document.getElementById("soloBtn");
const multiBtn = document.getElementById("multiBtn");
const titleScreen = document.getElementById("titleScreen");
const gameScreen = document.getElementById("game");

function enterGame() {
  // init music and play (will only start after user interaction)
  initMusic("./assets/music.mp3", 0.4);
  playMusic();

  titleScreen.style.display = "none";
  gameScreen.style.display = "block";
}
if (soloBtn) soloBtn.onclick = enterGame;
if (multiBtn) multiBtn.onclick = enterGame;

// CONFIG UI
const configBtn = document.getElementById("configBtn");
const configScreen = document.getElementById("configScreen");
const closeConfig = document.getElementById("closeConfig");
const nickInput = document.getElementById("nickInput");
const colorSelect = document.getElementById("colorSelect");
const skinSelect = document.getElementById("skinSelect");

configBtn && (configBtn.onclick = () => {
  // populate inputs with current values
  nickInput.value = player.nick;
  colorSelect.value = player.color || "#FFB000";
  skinSelect.value = player.skin || "rikcat";
  configScreen.style.display = "flex";
});
closeConfig && (closeConfig.onclick = () => {
  // save changes locally and to DB
  player.nick = nickInput.value.trim() || player.nick;
  player.color = colorSelect.value || player.color;
  player.skin = skinSelect.value || player.skin;
  set(playerRef, {
    x: player.x, y: player.y, vx: player.vx, vy: player.vy,
    onGround: player.onGround, facing: player.facing,
    nick: player.nick, color: player.color, w: player.w, h: player.h
  });
  configScreen.style.display = "none";
});

// ADMIN modal wiring
const adminBtn = document.getElementById("adminBtn");
const adminModal = document.getElementById("adminModal");
const adminSubmit = document.getElementById("adminSubmit");
const adminCancel = document.getElementById("adminCancel");
const adminPass = document.getElementById("adminPass");
const fireBtn = document.getElementById("fireBtn");

adminBtn && (adminBtn.onclick = () => { adminModal.style.display = "flex"; });
adminCancel && (adminCancel.onclick = () => { adminModal.style.display = "none"; adminPass.value = ""; });
adminSubmit && (adminSubmit.onclick = () => {
  const pass = adminPass.value || "";
  if (tryPassword(pass)) {
    adminModal.style.display = "none";
    adminPass.value = "";
    // show fire button if any
    if (fireBtn) fireBtn.style.display = "block";
    alert("Modo ADM ativado");
  } else {
    alert("Senha incorreta");
  }
});

// Fire effect button
fireBtn && (fireBtn.onclick = () => {
  spawnEffect(player.x, player.y + 10, player.facing);
});

// allow clicking anywhere to focus (helpful for keyboard)
window.addEventListener("pointerdown", () => { /* noop to allow audio on first interaction if needed */ });

// small helper: show/hide mobile controls on PC
if (isPC) {
  document.querySelectorAll(".btn").forEach(b => b.style.display = "none");
}
