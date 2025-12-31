// admin.js — controle simples de efeitos/admin (mínimo)
import { push, onValue } from "./firebase.js";

export const effects = [];

let _isAdmin = false;
let _effectsRef = null;

const ADMIN_PASSWORD = atob("UmlrY2F0QURNITIwMjU="); // "RikcatADM!2025"

export function wireEffectsRef(ref) {
  _effectsRef = ref;
  if (!_effectsRef) return;
  onValue(_effectsRef, snap => {
    const data = snap.val() || {};
    effects.length = 0;
    Object.values(data).forEach(e => effects.push(e));
  });
}

export function tryPassword(p) {
  if (p === ADMIN_PASSWORD) {
    _isAdmin = true;
    const fb = document.getElementById("fireBtn");
    if (fb) fb.style.display = "block";
    return true;
  }
  return false;
}

export function isAdmin() {
  return _isAdmin;
}

export function spawnEffect(x, y, dir = 1, len = 500, duration = 700) {
  const ef = { x, y, dir, len, duration, createdAt: Date.now() };
  effects.push(ef);
  if (_effectsRef) {
    push(_effectsRef, ef).catch(()=>{});
  }
  setTimeout(() => {
    const i = effects.indexOf(ef);
    if (i !== -1) effects.splice(i, 1);
  }, duration + 400);
}
