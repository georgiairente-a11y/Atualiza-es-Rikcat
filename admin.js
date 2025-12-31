import { push, onValue } from "./firebase.js";

const ADMIN_PASSWORD = atob("UmlrY2F0QURNITIwMjU="); // RikcatADM!2025

export const effects = [];
let _isAdmin = false;
let effectsRef = null;

export function wireEffectsRef(ref) {
  effectsRef = ref;
  onValue(effectsRef, snap => {
    effects.length = 0;
    Object.values(snap.val() || {}).forEach(e => effects.push(e));
  });
}

export function tryPassword(p) {
  if (p === ADMIN_PASSWORD) {
    _isAdmin = true;
    document.getElementById("fireBtn").style.display = "block";
    return true;
  }
  return false;
}

export function isAdmin() {
  return _isAdmin;
}

export function spawnEffect(x,y,dir) {
  const e = { x,y,dir,len:400,createdAt:Date.now() };
  effects.push(e);
  if (effectsRef) push(effectsRef, e);
}
