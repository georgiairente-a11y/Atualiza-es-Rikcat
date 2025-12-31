// game.js — CORRIGIDO: colisão com chão e desenho do mapa (PC + Mobile + Multiplayer básico)
import { db, ref, set, push, onValue, onDisconnect } from "./firebase.js";
import { drawRikcat } from "./rikcat.js";
import { wireEffectsRef, spawnEffect } from "./admin.js"; // se admin não exportar, remova a importação

// canvas setup
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
fitCanvas();
window.addEventListener("resize", fitCanvas);

// basic platform settings
const GROUND_HEIGHT = 40; // altura do "chão" em px (visual)
const GRAVITY = 0.6;
const MOVE_SPEED = 3;
const JUMP_V = -10;

// detect platform (hide mobile buttons on PC)
const isPC = !/Android|iPhone|iPad/i.test(navigator.userAgent);
if (isPC) {
  document.querySelectorAll(".btn").forEach(b => b.style.display = "none");
}

// room / player id
const ROOM = "global";
const PLAYER_ID = Math.random().toString(36).slice(2);

// local state
let dbPlayers = {}; // players read from DB
let effects = []; // optional, will be populated by admin module if available

// player defaults (p.y is TOP coordinate — important for collision math)
const player = {
  x: 100,
  // start on ground properly (top coordinate = canvas.height - ground - halfHeight)
  y: (canvas.height || window.innerHeight) - GROUND_HEIGHT - 16, // h/2 = 16
  w: 32,
  h: 32,
  vx: 0,
  vy: 0,
  onGround: true,
  facing: 1,
  nick: "Player",
  color: "#FFB000"
};

// Firebase refs
const playerRef = ref(db, `rooms/${ROOM}/players/${PLAYER_ID}`);
const playersRef = ref(db, `rooms/${ROOM}/players`);
const effectsRef = ref(db, `rooms/${ROOM}/effects`);
const chatRef = ref(db, `rooms/${ROOM}/chat`);

// wire admin effects if function exists
try {
  wireEffectsRef && wireEffectsRef(effectsRef);
} catch (err) {
  // ignore if admin module not present or wireEffectsRef undefined
}

// write initial presence and ensure removal on disconnect
set(playerRef, sanitizeForDB(player));
try { onDisconnect(playerRef).remove(); } catch (e) { /* ignore in environments without onDisconnect */ }

// listen to other players
onValue(playersRef, snap => {
  dbPlayers = snap.val() || {};
});

// --- CHAT (minimal) ---
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
if (chatBox && chatInput) {
  onValue(chatRef, snap => {
    const val = snap.val() || {};
    chatBox.innerHTML = "";
    Object.values(val).forEach(m => {
      const nick = escapeHtml(m.nick || "Anon");
      const text = escapeHtml(m.text || "");
      chatBox.innerHTML += `<div><b>${nick}:</b> ${text}</div>`;
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  });

  chatInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && chatInput.value.trim()) {
      push(chatRef, { nick: player.nick, text: chatInput.value });
      chatInput.value = "";
    }
  });
}

// simple escape helper
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}

// --- Controls ---
const keys = {};
window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
});
window.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
});

function handleKeyboardControls() {
  if (keys["a"] || keys["arrowleft"]) {
    player.vx = -MOVE_SPEED;
    player.facing = -1;
  } else if (keys["d"] || keys["arrowright"]) {
    player.vx = MOVE_SPEED;
    player.facing = 1;
  } else {
    player.vx = 0;
  }

  if ((keys["w"] || keys["arrowup"] || keys[" "]) && player.onGround) {
    player.vy = JUMP_V;
    player.onGround = false;
  }
}

// mobile controls (pointer events — works for mouse + touch)
const leftBtn = document.getElementById("left");
const rightBtn = document.getElementById("right");
const jumpBtn = document.getElementById("jump");

if (leftBtn) {
  leftBtn.addEventListener("pointerdown", e => { player.vx = -MOVE_SPEED; player.facing = -1; e.preventDefault(); });
  leftBtn.addEventListener("pointerup", () => { player.vx = 0; });
  leftBtn.addEventListener("pointercancel", () => { player.vx = 0; });
}
if (rightBtn) {
  rightBtn.addEventListener("pointerdown", e => { player.vx = MOVE_SPEED; player.facing = 1; e.preventDefault(); });
  rightBtn.addEventListener("pointerup", () => { player.vx = 0; });
  rightBtn.addEventListener("pointercancel", () => { player.vx = 0; });
}
if (jumpBtn) {
  jumpBtn.addEventListener("pointerdown", () => {
    if (player.onGround) {
      player.vy = JUMP_V;
      player.onGround = false;
    }
  });
}

// optional: fire button (admin)
const fireBtn = document.getElementById("fireBtn");
if (fireBtn) {
  fireBtn.addEventListener("click", () => {
    try {
      spawnEffect && spawnEffect(player.x, player.y + (player.h/2), player.facing);
    } catch (err) { /* ignore */ }
  });
}

// --- Physics & Collision ---
// Note: drawRikcat expects p.y to be TOP coordinate. To keep things consistent:
// - ground top for player's TOP coordinate should be: canvas.height - GROUND_HEIGHT - (player.h / 2)
//   because drawRikcat renders using p.y + (p.h/2) as center Y.

function physicsStep() {
  // gravity
  player.vy += GRAVITY;

  // movement
  player.x += player.vx;
  player.y += player.vy;

  // ground collision (we compute top coordinate that places center on ground)
  const groundCenterY = canvas.height - GROUND_HEIGHT; // y of the very top of ground (visual)
  const playerTopMax = groundCenterY - (player.h / 2); // maximum top coordinate allowed

  if (player.y > playerTopMax) {
    player.y = playerTopMax;
    player.vy = 0;
    player.onGround = true;
  } else {
    player.onGround = false;
  }

  // simple world bounds on X (keep player inside a wide world)
  if (player.x < 0) player.x = 0;
  // arbitrary right bound (can be large)
  if (player.x > 10000) player.x = 10000;
}

// --- Drawing ---
let camX = 0;
function updateCamera() {
  camX = player.x - canvas.width / 2;
}

function drawBackground() {
  // sky
  ctx.fillStyle = "#6aa5ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // distant hills / decoration (simple)
  const hillsY = canvas.height - GROUND_HEIGHT - 40;
  ctx.fillStyle = "#4ea357";
  for (let i = -2000; i < 10000; i += 300) {
    const hx = i - camX;
    ctx.beginPath();
    ctx.ellipse(hx + 150, hillsY + 30, 120, 60, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ground (long rectangle)
  ctx.fillStyle = "#3cb371";
  // draw far more width than screen to avoid gaps while camera moves
  ctx.fillRect(-camX - 2000, canvas.height - GROUND_HEIGHT, 20000, GROUND_HEIGHT);

  // optional: simple grid or platform lines on ground
  ctx.strokeStyle = "rgba(0,0,0,0.05)";
  ctx.lineWidth = 1;
  for (let gx = -2000; gx < 10000; gx += 64) {
    const sx = gx - camX;
    ctx.beginPath();
    ctx.moveTo(sx, canvas.height - GROUND_HEIGHT);
    ctx.lineTo(sx, canvas.height - GROUND_HEIGHT + 6);
    ctx.stroke();
  }
}

function drawAllPlayers() {
  // draw every player from DB (including ourselves as stored)
  Object.entries(dbPlayers).forEach(([id, pRaw]) => {
    // normalize fields (DB may have different shape)
    const p = {
      x: Number(pRaw.x || 0),
      y: Number(pRaw.y || 0),
      vx: Number(pRaw.vx || 0),
      vy: Number(pRaw.vy || 0),
      onGround: !!pRaw.onGround,
      facing: (typeof pRaw.facing === "number") ? pRaw.facing : (pRaw.facing === "-1" ? -1 : 1),
      nick: pRaw.nick || "Player",
      color: pRaw.color || "#FFB000",
      w: Number(pRaw.w || 32),
      h: Number(pRaw.h || 32)
    };
    drawRikcat(ctx, p, camX);
  });

  // if our local player isn't yet in DBPlayers (rare), draw local
  if (!dbPlayers[PLAYER_ID]) {
    drawRikcat(ctx, player, camX);
  }
}

function drawEffects() {
  // if admin module pushed effects into DB and wireEffectsRef populated them,
  // they should be available from 'effects' variable (admin module handles update).
  try {
    effects.forEach(e => {
      ctx.strokeStyle = "orange";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(e.x - camX, e.y);
      ctx.lineTo(e.x - camX + (e.dir || 1) * (e.len || 400), e.y);
      ctx.stroke();
    });
  } catch (err) {
    // nothing — effects optional
  }
}

function render() {
  // clear + draw background
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  // players
  drawAllPlayers();

  // effects
  drawEffects();
}

// --- Update loop ---
function sanitizeForDB(obj) {
  // remove functions and keep only primitives
  return {
    x: Number(obj.x || 0),
    y: Number(obj.y || 0),
    vx: Number(obj.vx || 0),
    vy: Number(obj.vy || 0),
    onGround: !!obj.onGround,
    facing: Number(obj.facing || 1),
    nick: obj.nick || "Player",
    color: obj.color || "#FFB000",
    w: Number(obj.w || 32),
    h: Number(obj.h || 32),
    updatedAt: Date.now()
  };
}

function update() {
  // controls
  if (isPC) handleKeyboardControls();

  // physics
  physicsStep();

  // camera
  updateCamera();

  // write to DB (minimal)
  try {
    set(playerRef, sanitizeForDB(player));
  } catch (err) {
    // ignore DB write errors in offline dev
  }
}

function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// --- Basic title/config wiring (non-invasive) ---
const titleScreen = document.getElementById("titleScreen");
const soloBtn = document.getElementById("soloBtn");
const multiBtn = document.getElementById("multiBtn");
const gameDiv = document.getElementById("game");
const configBtn = document.getElementById("configBtn");
const configScreen = document.getElementById("configScreen");
const closeConfig = document.getElementById("closeConfig");
const nickInput = document.getElementById("nickInput");
const colorSelect = document.getElementById("colorSelect");
const skinSelect = document.getElementById("skinSelect");

function enterGameScreen() {
  if (titleScreen) titleScreen.style.display = "none";
  if (gameDiv) gameDiv.style.display = "block";
}

// attach but do not override existing game code if present
if (soloBtn) soloBtn.addEventListener("click", enterGameScreen);
if (multiBtn) multiBtn.addEventListener("click", enterGameScreen);

// config open/close (if elements exist)
if (configBtn) configBtn.addEventListener("click", () => {
  if (!configScreen) return;
  // populate values
  if (nickInput) nickInput.value = player.nick;
  if (colorSelect) colorSelect.value = player.color || "#FFB000";
  if (skinSelect) skinSelect.value = player.skin || "rikcat";
  configScreen.style.display = "flex";
});
if (closeConfig) closeConfig.addEventListener("click", () => {
  if (nickInput) player.nick = nickInput.value.trim() || player.nick;
  if (colorSelect) player.color = colorSelect.value || player.color;
  if (skinSelect) player.skin = skinSelect.value || player.skin;
  try { set(playerRef, sanitizeForDB(player)); } catch(e){}
  if (configScreen) configScreen.style.display = "none";
});

// make first pointer event unlock audio on some browsers (no-op safe)
window.addEventListener("pointerdown", () => {}, { once: true });
