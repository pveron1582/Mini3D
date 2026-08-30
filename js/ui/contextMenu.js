// js/ui/contextMenu.js — Menú contextual del click derecho sobre un
// personaje seleccionado (P-sentarse / acciones rápidas).
//
//   click derecho en el viewport con un humano activo
//     → menú con: Animar (sostenidas) · Acción única (gestos) · Elegir asiento.
//   "Elegir asiento" entra en modo selección: el próximo click IZQUIERDO en
//   una silla sienta al personaje ahí DIRECTO (sin animación — sirve para
//   posar la escena: que arranque sentado o se quede durante una toma).

import { byId } from '../dom.js';
import { canvas } from '../core.js';
import { store, interactiveRegistry } from '../state.js';
import { getActiveEntry, setActiveTarget } from './selection.js';
import { sitAtAnchor, GESTURE_DEFS } from '../characters/characters.js';
import { raycaster, getIntersectedObjectId } from './gizmo.js';
import { setStatus } from '../media/recorder.js';
import { pushHistory } from '../undo.js';
import * as THREE from 'three';

const menu = byId('contextMenu');
let pickSeatMode = false;   // esperando el click en la silla
let menuTargetId = null;    // personaje sobre el que se abrió

// Acciones sostenidas relevantes del panel (mismo orden/vocabulario).
const ANIM_ACTIONS = [
  ['idle', '🧍 De pie'],
  ['talk', '🗣️ Hablando'],
  ['sit', '🪑 Sentado (en el lugar)'],
  ['sit_typing', '💻 Tecleando'],
  ['lay', '🛌 Tirado en piso'],
  ['walk', '🚶 Caminar'],
  ['run', '🏃 Correr'],
  ['wave', '👋 Saludar (bucle)'],
  ['clap', '👏 Aplaudir (bucle)'],
  ['point', '👉 Señalar (bucle)'],
  ['hold', '📦 Llevar objeto']
];

function buildMenu() {
  if (!menu) return;
  const animBox = byId('contextMenuAnim');
  const gestBox = byId('contextMenuGestures');
  if (animBox) {
    animBox.innerHTML = '';
    ANIM_ACTIONS.forEach(([act, label]) => {
      const b = document.createElement('button');
      b.className = 'action-btn';
      b.textContent = label;
      b.addEventListener('click', () => { applyAction(act); hideMenu(); });
      animBox.appendChild(b);
    });
  }
  if (gestBox) {
    gestBox.innerHTML = '';
    Object.keys(GESTURE_DEFS).forEach(name => {
      const b = document.createElement('button');
      b.className = 'action-btn';
      b.textContent = GESTURE_DEFS[name].label || name;
      b.addEventListener('click', () => { applyAction('gesture:' + name); hideMenu(); });
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
  const entry = getActiveEntry();
  if (!entry || entry.type !== 'human') return false;
  menuTargetId = entry.id;
  if (!menu) return false;
  const title = byId('contextMenuTitle');
  if (title) title.textContent = '🧍 ' + entry.name;
  menu.style.display = 'flex';
  // Clampear para que no se salga de la ventana
  const w = menu.offsetWidth || 220, h = menu.offsetHeight || 300;
  menu.style.left = Math.min(e.clientX, window.innerWidth - w - 8) + 'px';
  menu.style.top = Math.min(e.clientY, window.innerHeight - h - 8) + 'px';
  return true;
}

function hideMenu() {
  if (menu) menu.style.display = 'none';
  menuTargetId = null;
}

byId('contextMenuSit')?.addEventListener('click', () => {
  pickSeatMode = true;
  hideMenu();
  setStatus('🪑 Hacé click en la silla donde querés sentarlo (ESC cancela).');
  canvas.style.cursor = 'pointer';
});

// Click derecho: abrir menú SOLO con un humano activo (el resto, el menú
// nativo del navegador para pan/vuelo sigue igual que siempre).
canvas.addEventListener('contextmenu', (e) => {
  const entry = getActiveEntry();
  if (!entry || entry.type !== 'human') return; // sin humano activo: no abrir
  e.preventDefault();
  e.stopPropagation();
  showMenu(e);
});

// Modo "elegir asiento": el próximo click izquierdo en una silla lo sienta
// ahí DIRECTO (sin animación — posiciona para posar la escena).
canvas.addEventListener('pointerdown', (e) => {
  if (!pickSeatMode || e.button !== 0) return;
  const hitId = getIntersectedObjectId(e);
  if (!hitId) return;
  // Aceptar solo anclas de asiento (sillas registradas con seat_<id>)
  const anchorName = 'seat_' + hitId;
  const entry = getActiveEntry();
  if (entry && entry.rig) {
    const pose = sitAtAnchorDirect(entry.rig, anchorName);
    if (pose) {
      pickSeatMode = false;
      canvas.style.cursor = 'default';
      setStatus(`${entry.name} sentado en ${interactiveRegistry.get(hitId)?.name || 'el asiento'}.`);
      pushHistory();
      e.preventDefault();
      e.stopPropagation();
    }
  }
}, true);

// ESC cancela el modo elegir asiento (y cierra el menú si estaba abierto)
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (pickSeatMode) {
    pickSeatMode = false;
    canvas.style.cursor = 'default';
    setStatus('Selección de asiento cancelada.');
  }
  hideMenu();
});

// Click fuera del menú lo cierra
window.addEventListener('pointerdown', (e) => {
  if (!menu || menu.style.display === 'none') return;
  if (e.target !== menu && !menu.contains(e.target)) hideMenu();
}, true);

// Colocación directa (sin animación): pose exacta del ancla + acción sit.
function sitAtAnchorDirect(rig, anchorName) {
  // Reutiliza sitAtAnchor con duración ~0: ubicación inmediata.
  const ok = sitAtAnchor(rig, anchorName, { instant: true });
  return ok;
}

buildMenu();
