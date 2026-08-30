// js/ui/contextMenu.js — Menú contextual del click derecho sobre un
// personaje seleccionado (acciones rápidas + sentarse en un asiento).
//
//   click derecho en el viewport con un humano activo
//     → menú: Animar (sostenidas) · Acción única (gestos) · Sentarse.
//   "Sentarse en una silla" entra en modo SELECCIÓN DE ASIENTO: el próximo
//   click IZQUIERDO en una silla/sillón lo sienta ahí (directo, para posar
//   la escena). Mientras dura el modo, TODOS los asientos válidos se
//   ILUMINAN al pasar el mouse (feedback de "acá podés"), y ESC cancela.
//
// Los botones usan clase propia (.ctx-btn) para NO entrar en los handlers
// globales de .action-btn del panel (que aplicarían sobre data-action).

import { byId } from '../dom.js';
import { canvas, camera } from '../core.js';
import { store, interactiveRegistry } from '../state.js';
import { getActiveEntry } from './selection.js';
import { sitAtAnchor, GESTURE_DEFS } from '../characters/characters.js';
import { getAnchor } from '../characters/anchors.js';
import { raycaster } from './gizmo.js';
import { setStatus } from '../media/recorder.js';
import { pushHistory } from '../undo.js';
import * as THREE from 'three';

const menu = byId('contextMenu');
let pickSeatMode = false;   // esperando el click en la silla
let menuTargetId = null;    // personaje sobre el que se abrió el menú

// ---------- acciones del menú ----------
const ANIM_ACTIONS = [
  ['idle', '🧍 De pie'],
  ['talk', '🗣️ Hablando'],
  ['sit_typing', '💻 Tecleando'],
  ['lay', '🛌 Tirado en piso'],
  ['walk', '🚶 Caminar'],
  ['run', '🏃 Correr'],
  ['wave', '👋 Saludar (bucle)'],
  ['clap', '👏 Aplaudir (bucle)'],
  ['point', '👉 Señalar (bucle)'],
  ['hold', '📦 Llevar objeto']
];
// (sin 'sit': "Sentarse" del menú va directo a elegir asiento — no existe
// "sentarse en el aire": siempre elige dónde sentarse.)

function buildMenu() {
  if (!menu) return;
  const animBox = byId('contextMenuAnim');
  const gestBox = byId('contextMenuGestures');
  if (animBox) {
    animBox.innerHTML = '';
    ANIM_ACTIONS.forEach(([act, label]) => {
      const b = document.createElement('button');
      b.className = 'ctx-btn blender-btn';
      b.textContent = label;
      b.addEventListener('click', (ev) => { ev.stopPropagation(); applyAction(act); hideMenu(); });
      animBox.appendChild(b);
    });
  }
  if (gestBox) {
    gestBox.innerHTML = '';
    Object.keys(GESTURE_DEFS).forEach(name => {
      const b = document.createElement('button');
      b.className = 'ctx-btn blender-btn';
      b.textContent = GESTURE_DEFS[name].label || name;
      b.addEventListener('click', (ev) => { ev.stopPropagation(); applyAction('gesture:' + name); hideMenu(); });
      gestBox.appendChild(b);
    });
  }
}

function applyAction(act) {
  const entry = interactiveRegistry.get(menuTargetId);
  if (entry && entry.rig) {
    entry.rig.setAction(act);
    pushHistory();
  }
}

function showMenu(e) {
  if (!menu) return;
  menuTargetId = null;
  const entry = getActiveEntry();
  if (!entry || entry.type !== 'human') return;
  menuTargetId = entry.id;
  const title = byId('contextMenuTitle');
  if (title) title.textContent = '🧍 ' + entry.name;
  menu.style.display = 'flex';
  const w = menu.offsetWidth || 220, h = menu.offsetHeight || 320;
  menu.style.left = Math.min(e.clientX, window.innerWidth - w - 8) + 'px';
  menu.style.top = Math.min(e.clientY, window.innerHeight - h - 8) + 'px';
}

function hideMenu() {
  if (menu) menu.style.display = 'none';
  menuTargetId = null;
}

// ---------- modo "elegir asiento" ----------
// Asientos válidos: entradas del registry (furniture) con ancla 'seat_<id>'.
function seatEntries() {
  const out = [];
  interactiveRegistry.forEach(entry => {
    if (entry.deleted || !entry.group || entry.type !== 'furniture') return;
    if (!getAnchor('seat_' + entry.id)) return;
    out.push(entry);
  });
  return out;
}

// Raycast PROPIO contra los grupos de asiento (no depende de editObjects:
// en modo Personajes las sillas no son "clickeables" para el gizmo, pero acá
// sí hay que poder elegirlas).
const seatRaycaster = new THREE.Raycaster();
const seatNDC = new THREE.Vector2();

function pickSeatAt(e) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0) return null;
  seatNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  seatNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  seatRaycaster.setFromCamera(seatNDC, camera);
  const groups = seatEntries().map(en => en.group);
  const hits = seatRaycaster.intersectObjects(groups, true);
  if (hits.length === 0) return null;
  let curr = hits[0].object;
  while (curr) {
    if (curr.userData && curr.userData.selectableRoot) {
      const root = curr.userData.selectableRoot;
      const entry = seatEntries().find(en => en.group === root);
      if (entry) return entry;
    }
    curr = curr.parent;
  }
  return null;
}

// Resaltado de asientos en el modo elegir: se ilumina el que está bajo el
// mouse. Los materiales de las sillas son COMPARTIDOS (chairMat común), así
// que al iluminar se CLONA el material del mesh (solo esa silla brilla) y
// al apagar se restaura el original.
let hoveredSeat = null;
const glowRestore = []; // { mesh, origMat }

function setSeatGlow(entry, on) {
  if (!entry || !entry.group) return;
  if (on) {
    glowRestore.length = 0;
    entry.group.traverse(o => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const clones = mats.map(m => {
        if (!m || !m.isMeshStandardMaterial) return m;
        const c = m.clone();
        c.emissive = new THREE.Color(0x35c46a);
        c.emissiveIntensity = 0.45;
        return c;
      });
      if (clones.length === 1) o.material = clones[0];
      else o.material = clones;
      glowRestore.push({ mesh: o, origMat: mats.length === 1 ? mats[0] : mats });
    });
  } else {
    glowRestore.forEach(r => { r.mesh.material = r.origMat; });
    glowRestore.length = 0;
  }
}

function enterPickSeat() {
  pickSeatMode = true;
  hideMenu();
  setStatus('🪑 Hacé click en la silla donde querés sentarlo (ESC cancela).');
  canvas.style.cursor = 'pointer';
}

// API pública: lo usa el botón "Sentado" del panel izquierdo (la acción `sit`
// ya no deja al personaje en el aire — siempre elige la silla).
export function startPickSeatMode() { enterPickSeat(); }

byId('contextMenuSit')?.addEventListener('click', enterPickSeat);

function exitPickSeat() {
  pickSeatMode = false;
  if (hoveredSeat) setSeatGlow(hoveredSeat, false);
  hoveredSeat = null;
  canvas.style.cursor = 'default';
}

// Hover: iluminar la silla bajo el mouse mientras se elige
canvas.addEventListener('pointermove', (e) => {
  if (!pickSeatMode) return;
  const hit = pickSeatAt(e);
  if (hit === hoveredSeat) return;
  if (hoveredSeat) setSeatGlow(hoveredSeat, false);
  if (hit) setSeatGlow(hit, true);
  hoveredSeat = hit;
});

// Click en el asiento: capture ANTES del gizmo para que no lo pise la
// selección normal (en modo Personajes el click en la silla no selecciona).
canvas.addEventListener('pointerdown', (e) => {
  if (!pickSeatMode || e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const hit = pickSeatAt(e);
  if (!hit) return;
  const entry = getActiveEntry();
  if (entry && entry.rig && sitAtAnchor(entry.rig, 'seat_' + hit.id, { instant: true })) {
    setStatus(`${entry.name} sentado en ${hit.name}.`);
    pushHistory();
    exitPickSeat();
  }
}, true);

// ESC cancela el modo elegir asiento
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (pickSeatMode) { exitPickSeat(); setStatus('Selección de asiento cancelada.'); }
  hideMenu();
});

// ---------- apertura del menú ----------
// Click derecho SOLO con un humano activo (sin humano: el click derecho
// sigue siendo pan/vuelo de cámara, como siempre).
canvas.addEventListener('contextmenu', (e) => {
  const entry = getActiveEntry();
  if (!entry || entry.type !== 'human') return;
  e.preventDefault();
  e.stopPropagation();
  showMenu(e);
});

// Click fuera del menú lo cierra
window.addEventListener('pointerdown', (e) => {
  if (!menu || menu.style.display === 'none') return;
  if (e.target !== menu && !menu.contains(e.target)) hideMenu();
}, true);

buildMenu();
