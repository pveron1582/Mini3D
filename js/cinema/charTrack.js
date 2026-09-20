// js/cinema/charTrack.js — Pista 🧍 PERSONAJES: una LANE por personaje.
// Cada personaje tiene su propia fila en la línea de tiempo con:
//   - BLOQUE BASE: si su acción dura TODA la escena (ej. empleados en sus
//     PCs), un bloque que cubre la línea completa (charFullRange).
//   - BLOQUES de acciones por tramo (talk, sit, caminar…), con 💾/✕.
//   - BLOQUE 🚶 CAMINO: el recorrido (waypoints) dibujado como bloque en la
//     misma lane — su duración es la de la caminata; click abre el editor
//     de recorrido clásico sobre el piso.
// Solo se muestran las lanes con algo (acción base, bloques o recorrido);
// el rótulo de cada lane colapsa/expande su contenido.
// La posición física sigue en los recorridos (cinemaPaths) para los que
// caminan; para los que NO tienen camino, cada bloque guarda su POSE
// (posición + rotación) al 💾 — en reproducción el personaje aparece donde
// quedó en cada cuadro, aunque sea de un salto.

import * as THREE from 'three';
import { charBlocks, timeline, interactiveRegistry, blockEdit, charLaneBus, charFullRange, store, timelineBus, blockPin, pinMatches, togglePinBlock, blockSelectionBlocked, blockBus } from '../state.js';
import { byId, showViewportHint } from '../dom.js';
import { camera, canvas, scene } from '../core.js';
import { setActiveTarget } from '../ui/selection.js';
import { pushHistory } from '../undo.js';
import { setStatus } from '../media/recorder.js';
import { collectTimelineSnapTimes, snapTimeToRefs, TL_SNAP_PX } from './tlSnap.js';
import { pxPerSec, LANE_LABEL_W } from './tlScale.js';

let blockCounter = 0;
export function bumpCharBlockCounter(n) { blockCounter = Math.max(blockCounter, n); }

// ---------- Estado ----------
let selectedBlock = null;      // bloque de acciones en edición (panel Personajes)
let blockSnapshot = null;     // snapshot del bloque al seleccionarlo (✕ descarta)
let baseSelectionId = null;   // id del personaje con su bloque base ⏳ seleccionado
let baseSnapshot = null;      // snapshot de la acción base al seleccionarla
const collapsedLanes = new Set(); // ids de lanes colapsadas (rótulo click)

export function charBlockSelection() { return selectedBlock; }

// Tramo de camino elegido (el pedazo azul visible): { charId, seg } o null.
// El camino es una tira larga bajo los cuadros; la selección abraza SOLO el
// tramo clickeado, no la tira entera.
let selectedCamino = null;

export function clearCaminoSelection() {
  if (!selectedCamino) return;
  selectedCamino = null;
  renderCharBlocks();
}

// Tramos visibles del camino: la tira [0, totalEnd] menos lo tapado por la
// base (toda la escena) y los cuadros. Exportado para tests.
export function caminoGaps(charId, totalEnd) {
  if (!(totalEnd > 0)) return [];
  if (charFullRange[charId]) return [[0, totalEnd]];
  const ivals = charBlocks
    .filter(b => b.actions && b.actions[charId])
    .map(b => [b.start, b.start + b.duration])
    .sort((x, y) => x[0] - y[0]);
  const gaps = [];
  let cur = 0;
  for (const [s, e] of ivals) {
    if (s - cur >= 0.3) gaps.push([cur, s]);
    cur = Math.max(cur, e);
  }
  if (totalEnd - cur >= 0.3) gaps.push([cur, totalEnd]);
  return gaps;
}

function renderCaminoSegments(inner, entry, info, pps) {
  const totalEnd = Math.min(info.duration > 0 ? info.duration : 1, Math.max(timeline.duration, 20));
  const gaps = caminoGaps(entry.id, totalEnd);
  gaps.forEach(([s, e], idx) => {
    const el = document.createElement('div');
    // El tramo se marca SOLO si está elegido Y editándose: si el editor se
    // cerró por otro lado (💾 de toma, otro bloque...), no queda un blanco
    // huérfano con dos iconos sueltos.
    const sel = selectedCamino && selectedCamino.charId === entry.id && selectedCamino.seg === idx && charLaneBus.isEditing(entry.id);
    el.className = 'tl-sub tl-charblock tl-charpath' + (sel ? ' selected' : '') + (pinMatches('camino', entry.id) ? ' pinned' : '');
    el.style.left = (LANE_LABEL_W + s * pps) + 'px';
    el.style.width = Math.max(18, (e - s) * pps) + 'px';
    const lab = document.createElement('span');
    lab.className = 'tl-shot-label';
    lab.textContent = `🚶 camino${info.loop ? ' 🔁' : ''}`;
    el.appendChild(lab);

    el.title = `Recorrido de ${entry.name}: tramo ${s.toFixed(1)}s → ${e.toFixed(1)}s (de ${info.duration.toFixed(1)}s) · ${info.speed} m/s${info.loop ? ' · en bucle' : ''} — click para editar, doble clic para fijar`;
    el.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); });
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (blockSelectionBlocked('camino', entry.id)) {
        setStatus('Bloque fijado con 📌: soltalo (doble clic o 📌) para elegir otro.');
        return;
      }
      togglePathEditor(entry.id);
      selectedCamino = { charId: entry.id, seg: idx };
      renderCharBlocks();
      if (blockBus.refreshBar) blockBus.refreshBar();
    });
    el.addEventListener('dblclick', (ev) => {
      ev.stopPropagation();
      if (blockSelectionBlocked('camino', entry.id)) {
        setStatus('Bloque fijado con 📌: soltalo (doble clic o 📌) para elegir otro.');
        return;
      }
      togglePathEditor(entry.id);
      selectedCamino = { charId: entry.id, seg: idx };
      togglePinBlock('camino', entry.id);
      renderCharBlocks();
      if (blockBus.refreshBar) blockBus.refreshBar();
    });
    inner.appendChild(el);
  });
}

export function clearCharBlockSelection() {
  if (chooserFor) closeBlockChooser();
  if (movePick) cancelMovePick();
  clearCaminoSelection();
  if (selectedBlock) {
    selectedBlock = null;
    blockSnapshot = null;
    renderCharBlockEditor();
    renderCharBlocks();
    blockEdit.set(null);
  }
  if (baseSelectionId) clearBaseSelection();
  if (blockBus.refreshBar) blockBus.refreshBar();
}

// Selección de camino vigente (tramo elegido y editándose) para la barra.
export function caminoSelection() {
  if (!selectedCamino) return null;
  if (!charLaneBus.isEditing(selectedCamino.charId)) return null;
  return selectedCamino;
}

// ---------- Selección del bloque base ⏳ (acción de toda la escena) ----------
export function charBaseSelection() { return baseSelectionId; }

function selectBaseBlock(entry) {
  const base = entry && charFullRange[entry.id];
  if (!base) return;
  if (blockSelectionBlocked('charbase', entry.id)) {
    setStatus('Bloque fijado con 📌: soltalo (doble clic o 📌) para elegir otro.');
    return;
  }
  // Exclusividad total: un solo bloque a la vez (suelta el de acciones y
  // cierra el editor de recorrido).
  if (selectedBlock) clearCharBlockSelection();
  clearCaminoSelection();
  charLaneBus.closeEditor();
  window.dispatchEvent(new CustomEvent('char-block-selected'));
  baseSelectionId = entry.id;
  baseSnapshot = JSON.parse(JSON.stringify(base));
  blockEdit.set('charbase');
  // Seleccionar también al PERSONAJE en la escena: su anillo/gizmo queda
  // activo para moverlo y cambiarle la pose mientras se edita el bloque.
  setActiveTarget(entry.id);
  renderCharBlocks();
  window.dispatchEvent(new CustomEvent('edit-mode-request', { detail: { mode: 'personajes' } }));
  editFullRange(entry);
  if (blockBus.refreshBar) blockBus.refreshBar();
}

export function clearBaseSelection() {
  if (baseSelectionId) {
    baseSelectionId = null;
    baseSnapshot = null;
    blockEdit.set(null);
    renderCharBlocks();
    const panel = byId('charBlockEditPanel');
    if (panel) panel.style.display = 'none';
  }
  if (blockBus.refreshBar) blockBus.refreshBar();
}

// Restaurar la base a su snapshot (↻: descarta cambios, sigue editando)
export function resetCharBase() {
  if (!baseSelectionId) return false;
  if (baseSnapshot && charFullRange[baseSelectionId]) {
    charFullRange[baseSelectionId] = JSON.parse(JSON.stringify(baseSnapshot));
  }
  renderCharBlocks();
  const entry = interactiveRegistry.get(baseSelectionId);
  if (entry) editFullRange(entry);
  pushHistory();
  setStatus('Acción base restablecida.');
  return true;
}

// Quitar la acción base (🗑: el bloque desaparece de la lane)
export function deleteCharBase() {
  if (!baseSelectionId) return false;
  delete charFullRange[baseSelectionId];
  clearBaseSelection();
  renderCharBlocks();
  pushHistory();
  if (blockPin.kind === 'charbase') { blockPin.kind = null; blockPin.ref = null; }
  if (blockBus.refreshBar) blockBus.refreshBar();
  setStatus('Acción base quitada.');
  return true;
}

// Guardar lugar+acción base (lo que hacía el 💾 del bloque)
export function commitCharBase() {
  if (!baseSelectionId) return false;
  const entry = interactiveRegistry.get(baseSelectionId);
  const base = charFullRange[baseSelectionId];
  if (!entry || !base) return false;
  if (entry.initialState) {
    entry.initialState.pos = [entry.group.position.x, entry.group.position.y, entry.group.position.z];
    entry.initialState.rotY = entry.group.rotation.y;
  } else {
    entry.initialState = {
      pos: [entry.group.position.x, entry.group.position.y, entry.group.position.z],
      rotY: entry.group.rotation.y,
      action: base.action
    };
  }
  pushHistory();
  setStatus(`Acción + lugar de ${entry.name} guardados.`);
  return true;
}

// ---------- Consulta del motor ----------
// Acciones vigentes en el instante t. Tres capas, en orden de prioridad:
//   1. charFullRange: acción de TODA la escena (bloque base de la lane).
//   2. Bloques por tramo (las últimas pisan a las anteriores).
// HABLAR (talk / sit_talk) es una acción de tramo: al TERMINAR el bloque
// que la definió, el personaje vuelve a su acción base — nadie queda
// hablando para siempre cuando otro toma la palabra.
const TALK_ACTIONS = new Set(['talk', 'sit_talk']);

export function charActionsAt(t) {
  const state = new Map();
  // 1. charFullRange (base de toda la escena)
  Object.keys(charFullRange).forEach(charId => {
    const a = charFullRange[charId];
    if (a) state.set(charId, { action: a.action, mood: a.mood || null, t0: 0, expired: false });
  });
  // 2. Bloques por tramo
  charBlocks
    .slice()
    .sort((a, b) => a.start - b.start)
    .forEach(b => {
      if (b.start > t) return;   // el bloque aún no arrancó
      const end = b.start + b.duration;
      const expired = t >= end;
      Object.keys(b.actions || {}).forEach(charId => {
        const a = b.actions[charId];
        if (!a || !a.action) return;   // en definición (ej. anim sin elegir)
        // HABLAR y DESPLAZARSE son acciones de tramo: al TERMINAR el bloque
        // expiran y el personaje vuelve a su acción base.
        if (expired && (TALK_ACTIONS.has(a.action) || a.move)) return;
        state.set(charId, { action: a.action, mood: a.mood || null, t0: b.start, expired });
      });
    });
  return state;
}

// Desplazamiento vigente en el instante t: por personaje, { from, to, k
// (0→1 en su tramo), action, rotY (rumbo) }. Solo dentro del tramo y con
// puntos válidos; fuera, la pose de fin (charPoseAt) lo conserva.
export function charMoveAt(t) {
  const moves = new Map();
  charBlocks.forEach(b => {
    if (t < b.start || t >= b.start + b.duration) return;
    Object.keys(b.actions || {}).forEach(charId => {
      const a = b.actions[charId];
      if (!a || !a.move || !a.move.from || !a.move.to) return;
      const d = moveDist(a.move);
      if (d < 1e-6 || !(b.duration > 0)) return;
      const k = Math.max(0, Math.min(1, (t - b.start) / b.duration));
      moves.set(charId, {
        from: a.move.from, to: a.move.to, k,
        action: a.action || null,
        rotY: Math.atan2(a.move.to.x - a.move.from.x, a.move.to.z - a.move.from.z)
      });
    });
  });
  return moves;
}

// ---------- charFullRange: acción que dura TODA la escena ----------
// Vive en state.js (charFullRange): { [charId]: { action, mood? } }.
// En charActionsAt (capa 1) se aplica de 0s hasta el fin.

// ---------- Personajes con contenido (lanes visibles) ----------
function charIdsWithContent() {
  const ids = new Set();
  Object.keys(charFullRange).forEach(id => ids.add(id));
  charBlocks.forEach(b => Object.keys(b.actions || {}).forEach(id => ids.add(id)));
  interactiveRegistry.forEach(entry => {
    if (entry.deleted) return;
    if (entry.type !== 'human' && entry.type !== 'pet') return;
    const info = charLaneBus.pathInfo(entry.id);
    if (info) ids.add(entry.id);
  });
  // Solo ids que existen en el registry (personajes vivos)
  const out = [];
  ids.forEach(id => {
    const e = interactiveRegistry.get(id);
    if (e && !e.deleted) out.push(e);
  });
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

// ---------- Render de las pistas ----------

// Abrir el editor del camino con reporte: si algo falla se ve en la barra
// de estado en vez de parecer que el clic no hizo nada. Si ya se está
// editando, no se cierra (para eso están 💾/✕): se avisa dónde terminar.
function togglePathEditor(id) {
  try {
    const entry = interactiveRegistry.get(id);
    const name = entry ? entry.name : id;
    if (blockSelectionBlocked('camino', id)) {
      setStatus('Bloque fijado con 📌: soltalo (doble clic o 📌) para elegir otro.');
      return;
    }
    if (charLaneBus.isEditing(id)) {
      setStatus(`Ya estás editando el recorrido de ${name}: ↻ restablece, ✕ cierra.`);
      return;
    }
    charLaneBus.toggleEditor(id);
    setStatus(`Editando recorrido de ${name}: clic en la línea suma puntos, arrastralos para moldear. ↻ restablece, ✕ cierra.`);
  } catch (err) {
    console.error(err);
    setStatus('No se pudo abrir el editor del camino: ' + (err && err.message ? err.message : err));
  }
}

function blockLabel(b) {
  const names = Object.keys(b.actions || {}).map(id => {
    const e = interactiveRegistry.get(id);
    const act = (b.actions[id] && b.actions[id].action) || 'idle';
    return act;
  });
  return names.length ? names.join(' + ') : '(vacío)';
}

// Etiqueta de un cuadro en su lane: estático = acción; desplazamiento = anim + →.
function charBlockLabel(b, charId) {
  const a = b.actions ? b.actions[charId] : null;
  if (a && a.move) {
    const anim = MOVE_ACTIONS.find(m => m.id === a.action);
    return anim ? `🚶 ${anim.label} →` : '❓ Mover';
  }
  return actionLabel(a ? a.action : 'idle');
}

export function renderCharBlocks() {
  const host = byId('charLanes');
  if (!host) return;
  host.innerHTML = '';
  const pps = pxPerSec();
  const chars = charIdsWithContent();
  if (chars.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'tl-lane-name';
    empty.style.cssText = 'position:static; transform:none; display:block; padding:4px 8px; pointer-events:none;';
    empty.textContent = '🧍 PERSONAJES —elegí uno y dale una acción, o dibujá su camino—';
    host.appendChild(empty);
    return;
  }
  chars.forEach(entry => {
    const lane = document.createElement('div');
    lane.className = 'tl-sub-lane tl-char-lane' + (collapsedLanes.has(entry.id) ? ' collapsed' : '');

    // --- Rótulo: nombre + botón ＋ (nuevo bloque) + colapso ---
    const label = document.createElement('div');
    label.className = 'tl-lane-name';
    label.style.cursor = 'pointer';
    const icon = entry.type === 'human' ? '🧍' : '🐾';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = `${icon} ${entry.name}`;
    label.appendChild(nameSpan);
    const arrowSpan = document.createElement('span');
    arrowSpan.textContent = collapsedLanes.has(entry.id) ? ' ▸' : ' ▾';
    label.appendChild(arrowSpan);

    // Botón ＋ delante del personaje: crea un bloque de acción para ÉL.
    const addBtn = document.createElement('button');
    addBtn.className = 'tl-lane-add tl-char-add';
    addBtn.textContent = '＋';
    addBtn.title = `Agregar un bloque de acción para ${entry.name}`;
    addBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openBlockChooser(entry);
    });
    label.appendChild(addBtn);

    label.title = collapsedLanes.has(entry.id)
      ? `Expandir la pista de ${entry.name}`
      : `Colapsar la pista de ${entry.name} (el contenido sigue funcionando igual)`;
    label.addEventListener('pointerdown', (e) => e.stopPropagation());
    label.addEventListener('click', (e) => {
      // Click en el nombre/arrow colapsa/expande; el ＋ agrega bloque
      if (e.target.closest('.tl-char-add')) return;
      e.stopPropagation();
      if (collapsedLanes.has(entry.id)) collapsedLanes.delete(entry.id);
      else collapsedLanes.add(entry.id);
      renderCharBlocks();
    });
    lane.appendChild(label);

    if (!collapsedLanes.has(entry.id)) {
      const inner = document.createElement('div');
      inner.className = 'tl-char-inner';

      // --- BLOQUE BASE (charFullRange): acción de TODA la escena ---
      // Seleccionable como cualquier bloque: click lo selecciona (resaltado),
      // 💾 guarda, 🗑 quita la acción base, ✕ descarta cambios.
      const base = charFullRange[entry.id];
      if (base) {
        const isSel = baseSelectionId === entry.id;
        const el = document.createElement('div');
        el.className = 'tl-sub tl-charblock tl-charbase' + (isSel ? ' selected' : '') + (pinMatches('charbase', entry.id) ? ' pinned' : '');
        el.style.left = (LANE_LABEL_W + 0) + 'px';
        el.style.width = Math.max(18, Math.max(timeline.duration, 20) * pps) + 'px';
        const lab = document.createElement('span');
        lab.className = 'tl-shot-label';
        lab.textContent = '⏳ ' + actionLabel(base.action);
        el.appendChild(lab);

        el.title = `${entry.name}: ${actionLabel(base.action)} durante TODA la escena (click para editar, doble clic para fijar)`;
        el.addEventListener('pointerdown', (e) => e.stopPropagation());
        el.addEventListener('click', (e) => { e.stopPropagation(); selectBaseBlock(entry); });
        el.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          selectBaseBlock(entry);
          togglePinBlock('charbase', entry.id);
          renderCharBlocks();
          if (blockBus.refreshBar) blockBus.refreshBar();
        });
        inner.appendChild(el);
      }

      // --- BLOQUE 🚶 CAMINO (recorrido con waypoints) ---
      // El camino es UNA tira larga que pasa POR DEBAJO de los cuadros: para
      // elegirla por pedazos visibles (y no enmarcarla entera), se dibuja por
      // TRAMOS (huecos entre cuadros). Cada tramo elige el camino completo.
      const info = charLaneBus.pathInfo(entry.id);
      if (info) {
        renderCaminoSegments(inner, entry, info, pps);
      }

      // --- BLOQUES de acciones del personaje ---
      charBlocks
        .filter(b => b.actions && b.actions[entry.id])
        .sort((a, b) => a.start - b.start)
        .forEach(b => {
          const a = b.actions[entry.id];
          const isSel = b === selectedBlock;
          // Azul = viaja (desplazamiento o caminar/correr); verde = quieto
          const moves = !!(a && (a.move || a.action === 'walk' || a.action === 'run'));
          const el = document.createElement('div');
          el.className = 'tl-sub tl-charblock'
            + (isSel ? ' selected' : '')
            + (moves ? ' tl-charmove' : '')
            + (pinMatches('char', b) ? ' pinned' : '');
          el.style.left = (LANE_LABEL_W + b.start * pps) + 'px';
          el.style.width = Math.max(18, b.duration * pps) + 'px';
          const lab = document.createElement('span');
          lab.className = 'tl-shot-label';
          lab.textContent = charBlockLabel(b, entry.id);
          el.appendChild(lab);

          const left = document.createElement('div');
          left.className = 'tl-handle tl-handle-l';
          const right = document.createElement('div');
          right.className = 'tl-handle tl-handle-r';
          el.appendChild(left);
          el.appendChild(right);

          el.title = `${entry.name}: ${charBlockLabel(b, entry.id)} · ${b.start.toFixed(1)}s → ${(b.start + b.duration).toFixed(1)}s (click para editar, doble clic para fijar)`;
          el.addEventListener('pointerdown', (e) => beginCharBlockDrag(e, b, el));
          el.addEventListener('click', () => {
            if (el.dataset.dragged === '1') { el.dataset.dragged = ''; return; }
            openCharBlockEditor(b);
          });
          el.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            openCharBlockEditor(b);
            togglePinBlock('char', b);
            renderCharBlocks();
            renderCharBlockEditor();
            if (blockBus.refreshBar) blockBus.refreshBar();
          });
          inner.appendChild(el);
        });

      lane.appendChild(inner);
    }
    host.appendChild(lane);
  });
  renderCharBlockEditor();
  updateMoveMarkers();
}

// Duplica un bloque al FINAL de su lane: copia idéntica (acción, ánimo,
// lugar, movimiento) ubicada donde termina el último bloque del personaje.
// Vale esté el original último o más adelante; nunca se superpone.
export function duplicateCharBlock(b, charId) {
  if (!b || !charBlocks.includes(b)) return null;
  const endOfLast = charBlocks
    .filter(o => o.actions && charId && o.actions[charId])
    .reduce((m, o) => Math.max(m, o.start + o.duration), 0);
  const copy = {
    id: 'cb' + (++blockCounter),
    start: Math.round(Math.max(endOfLast, 0) * 10) / 10,
    duration: b.duration,
    actions: JSON.parse(JSON.stringify(b.actions || {}))
  };
  charBlocks.push(copy);
  return copy;
}

function laneContentCount(charId) {
  let n = charFullRange[charId] ? 1 : 0;
  charBlocks.forEach(b => { if (b.actions && b.actions[charId]) n++; });
  if (charLaneBus.pathInfo(charId)) n++;
  return n;
}

function actionLabel(act) {
  const found = CHAR_ACTIONS.find(a => a.id === act);
  return found ? found.label : act;
}

// ---------- Editor del bloque (panel Personajes) ----------
const CHAR_ACTIONS = [
  { id: 'idle', label: '🧍 De pie' },
  { id: 'talk', label: '🗣️ Hablando' },
  { id: 'sit', label: '🪑 Sentado' },
  { id: 'sit_talk', label: '🗣️🪑 Hablando sentado' },
  { id: 'sit_typing', label: '💻 Tecleando (sentado)' },
  { id: 'type_standing', label: '⌨️ Tecleando de pie' },
  { id: 'lay', label: '🛌 Tirado en el piso' },
  { id: 'walk', label: '🚶 Caminar' },
  { id: 'run', label: '🏃 Correr' },
  { id: 'wave', label: '👋 Saludar' },
  { id: 'clap', label: '👏 Aplaudir' },
  { id: 'point', label: '👉 Señalar' },
  { id: 'hold', label: '📦 Llevar objeto' }
];
const PET_ACTIONS = CHAR_ACTIONS.filter(a =>
  ['idle', 'sit', 'lay', 'walk', 'run'].includes(a.id));
const CHAR_MOODS = [
  { id: '', label: '— igual —' },
  { id: 'neutral', label: '😐 Neutral' },
  { id: 'happy', label: '😊 Contento' },
  { id: 'angry', label: '😠 Enojado' },
  { id: 'sad', label: '😢 Triste' },
  { id: 'worried', label: '😰 Preocupado' }
];

// Editar la acción BASE (toda la escena) de un personaje. Lo llama
// selectBaseBlock (la selección ya está hecha); solo arma el panel.
function editFullRange(entry) {
  const base = charFullRange[entry.id];
  if (!base) return;
  // Panel de Personajes con el editor de base
  window.dispatchEvent(new CustomEvent('edit-mode-request', { detail: { mode: 'personajes' } }));
  const panel = byId('charBlockEditPanel');
  if (!panel) return;
  panel.style.display = 'block';
  const title = byId('charBlockTitle');
  if (title) title.textContent = `${entry.name} — acción de TODA la escena`;
  const list = byId('charBlockList');
  if (!list) return;
  list.innerHTML = '';

  const row = document.createElement('div');
  row.className = 'char-block-row';
  row.style.cssText = 'display:flex; gap:4px; align-items:center; flex-wrap:wrap;';

  const name = document.createElement('span');
  name.style.cssText = 'flex:1; min-width:70px; font-size:11px; font-weight:600;';
  name.textContent = (entry.type === 'human' ? '🧍 ' : '🐾 ') + entry.name;
  row.appendChild(name);

  const actSel = document.createElement('select');
  actSel.className = 'tl-input';
  actSel.style.cssText = 'flex:1; min-width:110px;';
  (entry.type === 'pet' ? PET_ACTIONS : CHAR_ACTIONS).forEach(op => {
    const o = document.createElement('option');
    o.value = op.id; o.textContent = op.label;
    actSel.appendChild(o);
  });
  actSel.value = base.action || 'idle';
  actSel.addEventListener('change', () => {
    base.action = actSel.value;
    renderCharBlocks();
    pushHistory();
  });
  row.appendChild(actSel);

  const moodSel = document.createElement('select');
  moodSel.className = 'tl-input';
  moodSel.style.cssText = 'min-width:80px;';
  CHAR_MOODS.forEach(op => {
    const o = document.createElement('option');
    o.value = op.id; o.textContent = op.label;
    moodSel.appendChild(o);
  });
  moodSel.value = base.mood || '';
  moodSel.addEventListener('change', () => {
    base.mood = moodSel.value || undefined;
    pushHistory();
  });
  row.appendChild(moodSel);

  // Quitar la acción base (vuelve a lo que digan sus bloques/initialState)
  const del = document.createElement('button');
  del.className = 'blender-btn';
  del.style.cssText = 'color:#ff7a7a; padding:2px 6px;';
  del.textContent = '✕';
  del.title = 'Quitar la acción de toda la escena';
  del.addEventListener('click', () => {
    delete charFullRange[entry.id];
    renderCharBlocks();
    pushHistory();
    setStatus(`Acción base de ${entry.name} quitada.`);
  });
  row.appendChild(del);

  list.appendChild(row);
  setStatus(`${entry.name}: acción de TODA la escena. Elegí qué hace durante toda la cinemática.`);
}

export function openCharBlockEditor(b) {
  if (!b || !charBlocks.includes(b)) return;
  if (blockSelectionBlocked('char', b)) {
    setStatus('Bloque fijado con 📌: soltalo (doble clic o 📌) para elegir otro.');
    return;
  }
  // Exclusividad total: un solo bloque a la vez. Soltar la selección de
  // base (bloque ⏳), cualquier otra pista (tomas/subtítulos/cartels por el
  // mismo evento) y cerrar el editor de recorrido si estaba abierto.
  if (baseSelectionId) clearBaseSelection();
  chooserFor = null;
  clearCaminoSelection();
  charLaneBus.closeEditor();
  window.dispatchEvent(new CustomEvent('char-block-selected'));
  selectedBlock = b;
  blockSnapshot = JSON.parse(JSON.stringify({ start: b.start, duration: b.duration, actions: b.actions }));
  blockEdit.set('charblock');
  renderCharBlocks();
  const soloA = b.actions ? b.actions[Object.keys(b.actions)[0]] : null;
  setStatus(soloA && soloA.move
    ? 'Bloque de movimiento: marcá inicio/fin y elegí caminar o correr.'
    : 'Editando el cuadro: acción, ánimo y lugar quedan guardados en él.');
  window.dispatchEvent(new CustomEvent('edit-mode-request', { detail: { mode: 'personajes' } }));
  if (blockBus.refreshBar) blockBus.refreshBar();
}

// Restaurar el bloque a su snapshot (↻: descarta cambios, sigue editando)
export function resetCharBlock() {
  if (!selectedBlock) return false;
  if (blockSnapshot) {
    Object.assign(selectedBlock, JSON.parse(JSON.stringify(blockSnapshot)));
  }
  renderCharBlocks();
  renderCharBlockEditor();
  pushHistory();
  setStatus('Bloque restablecido.');
  return true;
}

// Borrar el bloque seleccionado (🗑)
export function deleteCharBlock() {
  if (!selectedBlock) return false;
  const idx = charBlocks.indexOf(selectedBlock);
  if (idx >= 0) charBlocks.splice(idx, 1);
  selectedBlock = null;
  blockSnapshot = null;
  blockEdit.set(null);
  if (blockPin.kind === 'char') { blockPin.kind = null; blockPin.ref = null; }
  renderCharBlocks();
  renderCharBlockEditor();
  pushHistory();
  if (timelineBus.refreshDuration) timelineBus.refreshDuration();
  if (blockBus.refreshBar) blockBus.refreshBar();
  setStatus('Bloque eliminado.');
  return true;
}

// Guardar lugar+acción del bloque (lo que hacía su 💾): captura la pose actual
export function commitCharBlock() {
  if (!selectedBlock) return false;
  if (!moveBlockReady(selectedBlock)) {
    setStatus('Falta definir el movimiento: animación (caminar/correr) + inicio verde y fin rojo.');
    return false;
  }
  captureBlockPose(selectedBlock);
  pushHistory();
  setStatus('Bloque guardado (lugar + acción + ánimo).');
  return true;
}

function renderCharBlockEditor() {
  const panel = byId('charBlockEditPanel');
  if (!panel) return;
  // Sin bloque ni chooser no hay nada que mostrar
  if (!selectedBlock && !chooserFor) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  const list = byId('charBlockList');
  if (!list) return;
  list.innerHTML = '';

  // Chooser de tipo (tras el ＋): estático o desplazamiento.
  if (chooserFor && !selectedBlock) {
    renderBlockChooser(list, chooserFor);
    return;
  }

  // El bloque es de UN SOLO personaje: el título lo nombra.
  const solo = Object.keys(selectedBlock.actions || {})[0];
  const soloEntry = solo ? interactiveRegistry.get(solo) : null;
  const title = byId('charBlockTitle');
  if (title) {
    title.textContent = soloEntry
      ? `${soloEntry.name} (${selectedBlock.start.toFixed(1)}s → ${(selectedBlock.start + selectedBlock.duration).toFixed(1)}s)`
      : `(bloque vacío — eliminalo con 🗑)`;
  }
  list.innerHTML = '';

  // Chooser de tipo (tras el ＋): estático o desplazamiento.
  if (chooserFor && !selectedBlock) {
    renderBlockChooser(list, chooserFor);
    return;
  }

  Object.keys(selectedBlock.actions || {}).forEach(charId => {
    const entry = interactiveRegistry.get(charId);
    const a = selectedBlock.actions[charId];
    if (a && a.move) {
      renderMoveEditorRow(list, entry, charId, a);
      return;
    }
    const row = document.createElement('div');
    row.className = 'char-block-row';
    row.style.cssText = 'display:flex; gap:4px; align-items:center; flex-wrap:wrap;';

    const name = document.createElement('span');
    name.style.cssText = 'flex:1; min-width:70px; font-size:11px; font-weight:600;';
    name.textContent = (entry ? ((entry.type === 'human' ? '🧍 ' : '🐾 ') + entry.name) : charId);
    row.appendChild(name);

    const actSel = document.createElement('select');
    actSel.className = 'tl-input';
    actSel.style.cssText = 'flex:1; min-width:110px;';
    const actions = entry && entry.type === 'pet' ? PET_ACTIONS : CHAR_ACTIONS;
    actions.forEach(op => {
      const o = document.createElement('option');
      o.value = op.id; o.textContent = op.label;
      actSel.appendChild(o);
    });
    actSel.value = a.action || 'idle';
    actSel.addEventListener('change', () => {
      a.action = actSel.value;
      // Definir en el cuadro también fija DÓNDE está: el lugar actual queda
      // guardado junto a la acción (no hace falta 💾 solo por moverlo).
      captureBlockPose(selectedBlock);
      renderCharBlocks();
      pushHistory();
    });
    row.appendChild(actSel);

    const moodSel = document.createElement('select');
    moodSel.className = 'tl-input';
    moodSel.style.cssText = 'min-width:80px;';
    CHAR_MOODS.forEach(op => {
      const o = document.createElement('option');
      o.value = op.id; o.textContent = op.label;
      moodSel.appendChild(o);
    });
    moodSel.value = a.mood || '';
    moodSel.addEventListener('change', () => {
      a.mood = moodSel.value || undefined;
      captureBlockPose(selectedBlock);
      pushHistory();
    });
    row.appendChild(moodSel);
    list.appendChild(row);
  });

  // Bloques de UN personaje: sin botón de añadir más.
  const addBtn = byId('charBlockAddChar');
  if (addBtn) addBtn.style.display = 'none';

  // ⤵ Llevar el bloque hasta que termine el clip (quieto ahí hasta el final).
  const endBtn = document.createElement('button');
  endBtn.className = 'blender-btn';
  endBtn.style.cssText = 'width:100%; margin-top:4px;';
  endBtn.textContent = `⤵ Hasta el final (${timeline.duration.toFixed(1)}s)`;
  endBtn.title = 'Estira el bloque hasta que termine el clip';
  endBtn.addEventListener('click', extendSelectedToEnd);
  list.appendChild(endBtn);
}

// ---------- Chooser estático / desplazamiento (tras el ＋) ----------
function renderBlockChooser(list, entry) {
  const title = byId('charBlockTitle');
  if (title) title.textContent = `Nuevo bloque para ${entry.name}`;
  const mkBtn = (label, hint, fn) => {
    const b = document.createElement('button');
    b.className = 'blender-btn';
    b.style.cssText = 'width:100%; margin-top:4px;';
    b.textContent = label;
    b.title = hint;
    b.addEventListener('click', fn);
    list.appendChild(b);
  };
  mkBtn('🧍 Estático', 'Dura lo que le pongas: acción, lugar, mirada y ánimo fijos.', () => {
    chooserFor = null;
    addStaticBlockFor(entry);
  });
  mkBtn('🚶 Desplazamiento', 'Marca inicio (verde) y fin (rojo) en el piso: la duración sale sola.', () => {
    chooserFor = null;
    addMoveBlockFor(entry);
  });
  mkBtn('← Volver', 'Sin bloque nuevo.', () => closeBlockChooser());
}

// ---------- Editor del bloque de desplazamiento ----------
function movePointText(m, end) {
  const p = m[end];
  return p ? `(${p.x.toFixed(1)}, ${p.z.toFixed(1)})` : '— sin marcar —';
}

function renderMoveEditorRow(list, entry, charId, a) {
  const m = a.move;
  const row = document.createElement('div');
  row.className = 'char-block-row';
  row.style.cssText = 'display:flex; gap:4px; align-items:center; flex-wrap:wrap;';

  const name = document.createElement('span');
  name.style.cssText = 'flex:1; min-width:70px; font-size:11px; font-weight:600;';
  name.textContent = '🚶 ' + (entry ? entry.name : charId);
  row.appendChild(name);

  // Animación de movimiento OBLIGATORIA (caminar/correr): sin ella no guarda.
  const animSel = document.createElement('select');
  animSel.className = 'tl-input';
  animSel.style.cssText = 'flex:1; min-width:110px;';
  [['', '—elegir: caminar/correr—'], ...MOVE_ACTIONS.map(m => [m.id, m.label])].forEach(([v, label]) => {
    const o = document.createElement('option');
    o.value = v; o.textContent = label;
    animSel.appendChild(o);
  });
  animSel.value = a.action || '';
  animSel.addEventListener('change', () => {
    a.action = animSel.value || null;
    renderCharBlocks();
    pushHistory();
  });
  row.appendChild(animSel);
  list.appendChild(row);

  const info = document.createElement('div');
  info.className = 'cinema-hint';
  const dist = moveDist(m);
  info.textContent = dist > 0
    ? `De ${movePointText(m, 'from')} → a ${movePointText(m, 'to')} · ${dist.toFixed(1)} m`
    : 'Marcá inicio (verde) y fin (rojo) en el piso.';
  list.appendChild(info);

  const row2 = document.createElement('div');
  row2.className = 'char-block-row';
  row2.style.cssText = 'display:flex; gap:4px; align-items:center; flex-wrap:wrap;';

  const pickFrom = document.createElement('button');
  pickFrom.className = 'blender-btn';
  pickFrom.style.cssText = 'flex:1;';
  pickFrom.textContent = '🟢 Inicio';
  pickFrom.title = 'Marcar el punto verde en el piso';
  pickFrom.addEventListener('click', () => startMovePick(selectedBlock, charId, 'from'));
  row2.appendChild(pickFrom);

  const pickTo = document.createElement('button');
  pickTo.className = 'blender-btn';
  pickTo.style.cssText = 'flex:1;';
  pickTo.textContent = '🔴 Fin';
  pickTo.title = 'Marcar el punto rojo en el piso';
  pickTo.addEventListener('click', () => startMovePick(selectedBlock, charId, 'to'));
  row2.appendChild(pickTo);
  list.appendChild(row2);

  const row3 = document.createElement('div');
  row3.className = 'char-block-row';
  row3.style.cssText = 'display:flex; gap:4px; align-items:center; flex-wrap:wrap;';

  const speedLab = document.createElement('span');
  speedLab.style.cssText = 'font-size:10px;';
  speedLab.textContent = 'Vel.';
  row3.appendChild(speedLab);
  const speedIn = document.createElement('input');
  speedIn.type = 'number'; speedIn.min = '0.2'; speedIn.step = '0.1';
  speedIn.className = 'tl-input';
  speedIn.style.cssText = 'width:56px;';
  speedIn.title = 'Velocidad (m/s): recalcula la duración';
  speedIn.value = String(m.speed || DEFAULT_MOVE_SPEED);
  speedIn.addEventListener('change', () => {
    m.speed = Math.max(0.2, +speedIn.value || DEFAULT_MOVE_SPEED);
    selectedBlock.duration = Math.max(0.5, Math.round(calcMoveDuration(m) * 10) / 10);
    renderCharBlocks();
    pushHistory();
    if (timelineBus.refreshDuration) timelineBus.refreshDuration();
  });
  row3.appendChild(speedIn);
  const sLab = document.createElement('span');
  sLab.style.cssText = 'font-size:10px; color:var(--text-muted);';
  sLab.textContent = 'm/s';
  row3.appendChild(sLab);

  const durLab = document.createElement('span');
  durLab.style.cssText = 'font-size:10px;';
  durLab.textContent = 'Dur.';
  row3.appendChild(durLab);
  const durIn = document.createElement('input');
  durIn.type = 'number'; durIn.min = '0.5'; durIn.step = '0.1';
  durIn.className = 'tl-input';
  durIn.style.cssText = 'width:56px;';
  durIn.title = 'Duración (s): la velocidad se adapta para cumplirla';
  durIn.value = String(selectedBlock.duration);
  durIn.addEventListener('change', () => {
    selectedBlock.duration = Math.max(0.5, +durIn.value || selectedBlock.duration);
    // La velocidad se adapta para cumplir el tiempo con los mismos puntos
    if (moveDist(m) > 0.05) m.speed = Math.round(calcMoveSpeed(m, selectedBlock.duration) * 100) / 100;
    renderCharBlocks();
    pushHistory();
    if (timelineBus.refreshDuration) timelineBus.refreshDuration();
  });
  row3.appendChild(durIn);
  const dLab = document.createElement('span');
  dLab.style.cssText = 'font-size:10px; color:var(--text-muted);';
  dLab.textContent = 's';
  row3.appendChild(dLab);
  list.appendChild(row3);

  const moodRow = document.createElement('div');
  moodRow.className = 'char-block-row';
  moodRow.style.cssText = 'display:flex; gap:4px; align-items:center; flex-wrap:wrap;';
  const moodSel = document.createElement('select');
  moodSel.className = 'tl-input';
  moodSel.style.cssText = 'flex:1; min-width:80px;';
  CHAR_MOODS.forEach(op => {
    const o = document.createElement('option');
    o.value = op.id; o.textContent = op.label;
    moodSel.appendChild(o);
  });
  moodSel.value = a.mood || '';
  moodSel.addEventListener('change', () => {
    a.mood = moodSel.value || undefined;
    pushHistory();
  });
  moodRow.appendChild(moodSel);
  list.appendChild(moodRow);
}

// Estira el bloque hasta `end` (puro/testeable): en move adapta la
// velocidad para cumplir el tiempo con los mismos puntos. Devuelve si cambió.
export function extendBlockDataTo(b, end) {
  if (!b) return false;
  const target = Math.max(0.5, Math.round((end - b.start) * 10) / 10);
  if (target <= b.duration) return false;
  b.duration = target;
  const solo = Object.keys(b.actions || {})[0];
  const a = solo && b.actions[solo];
  if (a && a.move && moveDist(a.move) > 0.05) {
    a.move.speed = Math.round(calcMoveSpeed(a.move, target) * 100) / 100;
  }
  return true;
}

function extendSelectedToEnd() {
  if (!selectedBlock) return;
  if (!extendBlockDataTo(selectedBlock, timeline.duration)) {
    setStatus('El bloque ya llega hasta el final.');
    return;
  }
  renderCharBlocks();
  pushHistory();
  if (timelineBus.refreshDuration) timelineBus.refreshDuration();
  setStatus(`Bloque extendido hasta el final (${timeline.duration.toFixed(1)}s).`);
}

// ---------- Acción base rápida (desde el panel Personajes) ----------
// Darle a un personaje una acción de TODA la escena (charFullRange). Lo usa el
// botón del panel: sin bloques que lo cambien, hace eso todo el tiempo.
export function setCharFullAction(charId, action) {
  if (!interactiveRegistry.has(charId)) return;
  if (action) charFullRange[charId] = { action };
  else delete charFullRange[charId];
  renderCharBlocks();
  pushHistory();
}

// ---------- Arrastre (mover / estirar bordes) ----------
let dragState = null;

function beginCharBlockDrag(e, b, el) {
  if (timeline.playing) return;
  e.preventDefault();
  e.stopPropagation();
  const rect = el.getBoundingClientRect();
  const edge = 8;
  const mode = (e.clientX - rect.left <= edge) ? 'l'
    : (rect.right - e.clientX <= edge) ? 'r'
    : 'move';
  dragState = { b, mode, startX: e.clientX, origStart: b.start, origDur: b.duration, moved: false };
  const pps = pxPerSec();
  // IMÁN entre pistas: los bordes del bloque se alinean solos con los bordes
  // de las demás pistas (tomas, subtítulos, cartels, otros bloques).
  const snapTol = TL_SNAP_PX / pps;
  const onMove = (ev) => {
    if (!dragState) return;
    if (!dragState.moved) {
      if (Math.abs(ev.clientX - dragState.startX) <= 3) return;
      dragState.moved = true;
      el.dataset.dragged = '1';
    }
    const dSec = (ev.clientX - dragState.startX) / pps;
    const ds = Math.round(dSec * 10) / 10;
    const refs = collectTimelineSnapTimes(b);
    let minStart = 0, maxEnd = Infinity;
    charBlocks.forEach(o => {
      if (o === b) return;
      if (o.start >= b.start + b.duration) maxEnd = Math.min(maxEnd, o.start);
      else if (o.start + o.duration <= b.start) minStart = Math.max(minStart, o.start + o.duration);
    });
    if (dragState.mode === 'move') {
      // Imán por el INICIO del bloque (mantiene la duración)
      let ns = Math.max(0, dragState.origStart + ds);
      ns = snapTimeToRefs(ns, snapTol, refs);
      b.start = ns;
      b.start = Math.max(minStart, Math.min(b.start, Math.max(0, maxEnd - b.duration)));
    } else if (dragState.mode === 'l') {
      let ns = Math.min(dragState.origStart + ds, dragState.origStart + dragState.origDur - 0.5);
      ns = Math.max(Math.max(0, minStart), ns);
      ns = snapTimeToRefs(ns, snapTol, refs);
      b.start = ns;
      b.duration = Math.round((dragState.origStart + dragState.origDur - b.start) * 10) / 10;
    } else {
      let nd = Math.max(0.5, dragState.origDur + ds);
      // Imán sobre el FIN del bloque
      const end = snapTimeToRefs(dragState.origStart + nd, snapTol, refs);
      nd = Math.max(0.5, end - dragState.origStart);
      b.duration = Math.round(nd * 10) / 10;
      if (b.start + b.duration > maxEnd) {
        b.duration = Math.max(0.5, Math.round((maxEnd - b.start) * 10) / 10);
      }
    }
    b.start = Math.round(b.start * 10) / 10;
    renderCharBlocks();
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (dragState && dragState.moved) {
      pushHistory();
      if (timelineBus.refreshDuration) timelineBus.refreshDuration();
    }
    dragState = null;
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

// ---------- Bloque inicial al agregar un personaje ----------
// Dura INITIAL_CHAR_BLOCK_DURATION (3 s): la acción mínima con la que el
// personaje arranca en la cinemática. Desde ahí se estira (toda la escena o
// lo que dure la secuencia) o se agregan más bloques para que haga varias
// cosas en la línea.
export const INITIAL_CHAR_BLOCK_DURATION = 3;

// ---------- Bloques de DESPLAZAMIENTO (vs estáticos) ----------
// Un bloque es de UN personaje y de UN tipo:
//   - estático (lo de siempre): dura `duration`, el personaje hace `action`
//     con `mood` en su `pos`/`rotY`.
//   - desplazamiento: va de `move.from` (verde) a `move.to` (rojo) con
//     `move.speed` (m/s) y animación obligatoria (`walk`/`run`). La duración
//     sale sola (distancia/velocidad); si se edita, la velocidad se adapta.
// actions = { [charId]: { action, mood?, pos?, rotY?, move? } }
export const MOVE_ACTIONS = [
  { id: 'walk', label: '🚶 Caminar' },
  { id: 'run', label: '🏃 Correr' }
];
export const DEFAULT_MOVE_SPEED = 2; // m/s (igual que la cinemática)

export function moveDist(m) {
  if (!m || !m.from || !m.to) return 0;
  return Math.hypot(m.to.x - m.from.x, m.to.z - m.from.z);
}

export function calcMoveDuration(m) {
  const d = moveDist(m);
  if (d < 1e-6) return 0;
  return d / Math.max(0.1, m.speed || DEFAULT_MOVE_SPEED);
}

export function calcMoveSpeed(m, duration) {
  const d = moveDist(m);
  if (!(duration > 0)) return m.speed || DEFAULT_MOVE_SPEED;
  return d / duration;
}

// ¿El bloque de desplazamiento está completo (se puede guardar)?
export function moveBlockReady(b) {
  const a = b && b.actions ? Object.values(b.actions).find(v => v && v.move) : null;
  if (!a) return true; // no es de desplazamiento
  return !!(a.action && a.move.from && a.move.to && moveDist(a.move) > 0.05);
}

// Pose actual de un personaje en la escena (para guardar en su bloque).
function currentPoseOf(charId) {
  const entry = interactiveRegistry.get(charId);
  if (!entry || !entry.group) return null;
  return {
    pos: [entry.group.position.x, entry.group.position.y, entry.group.position.z],
    rotY: entry.group.rotation.y
  };
}

export function createInitialCharBlock(charId, action = 'idle', duration = INITIAL_CHAR_BLOCK_DURATION) {
  const b = {
    id: 'cb' + (++blockCounter),
    start: 0,
    duration: Math.max(0.5, duration),
    actions: { [charId]: { action } }
  };
  // El bloque nace con el lugar donde apareció el personaje.
  const pose = currentPoseOf(charId);
  if (pose) Object.assign(b.actions[charId], pose);
  charBlocks.push(b);
  renderCharBlocks();
  if (timelineBus.refreshDuration) timelineBus.refreshDuration();
  return b;
}

// Guardar en el cuadro DÓNDE está cada personaje ahora (posición +
// rotación): junto a la acción y el ánimo que define el panel.
export function captureBlockPose(b) {
  if (!b) return;
  Object.keys(b.actions || {}).forEach(charId => {
    const a = b.actions[charId];
    if (!a || a.move) return;   // desplazamiento: mandan los puntos verde/rojo
    const pose = currentPoseOf(charId);
    if (pose) Object.assign(a, pose);
  });
}

// Pose vigente por personaje en el instante t: la del ÚLTIMO bloque que ya
// arrancó (aunque haya terminado — el personaje conserva su último lugar
// hasta que otro cuadro lo mueva, incluso de un salto). Antes del primer
// bloque no hay pose (vale el estado inicial).
export function charPoseAt(t) {
  const pose = new Map();
  charBlocks
    .slice()
    .sort((a, b) => a.start - b.start)
    .forEach(b => {
      if (b.start > t) return;
      Object.keys(b.actions || {}).forEach(charId => {
        const a = b.actions[charId];
        if (a && Array.isArray(a.pos)) pose.set(charId, { pos: a.pos, rotY: a.rotY });
      });
    });
  return pose;
}

// ---------- Botón ＋ de la pista ----------
// Primero se elige el TIPO de bloque: estático (acción en un lugar) o
// desplazamiento (verde→rojo con duración automática).
let chooserFor = null; // entry del personaje mientras se elige el tipo

export function openBlockChooser(entry) {
  if (!entry || (entry.type !== 'human' && entry.type !== 'pet')) {
    setStatus('Elegí un personaje primero (su lane o la lista): el bloque nuevo es de UN personaje.');
    return;
  }
  if (blockPin.kind) {
    setStatus('Bloque fijado con 📌: soltalo (doble clic o 📌) para crear otro.');
    return;
  }
  if (baseSelectionId) clearBaseSelection();
  clearCaminoSelection();
  charLaneBus.closeEditor();
  window.dispatchEvent(new CustomEvent('char-block-selected'));
  chooserFor = entry;
  renderCharBlocks();
  window.dispatchEvent(new CustomEvent('edit-mode-request', { detail: { mode: 'personajes' } }));
}

function closeBlockChooser() {
  if (!chooserFor) return;
  chooserFor = null;
  renderCharBlocks();
}

// Crea un bloque NUEVO ESTÁTICO para un personaje, al final de sus bloques
// (un bloque = un personaje), seleccionado para editar directo.
function addStaticBlockFor(entry) {
  // Fin del último bloque de ESTE personaje (sin superponerse)
  const endOfLast = charBlocks
    .filter(b => b.actions && b.actions[entry.id])
    .reduce((m, b) => Math.max(m, b.start + b.duration), 0);
  const base = entry.initialState && entry.initialState.action ? entry.initialState.action : 'idle';
  const b = {
    id: 'cb' + (++blockCounter),
    start: Math.round(Math.max(endOfLast, 0) * 10) / 10,
    duration: 2,
    actions: { [entry.id]: { action: base } }
  };
  // El bloque nace con el lugar donde está el personaje ahora.
  const pose = currentPoseOf(entry.id);
  if (pose) Object.assign(b.actions[entry.id], pose);
  charBlocks.push(b);
  openCharBlockEditor(b);
  pushHistory();
  if (timelineBus.refreshDuration) timelineBus.refreshDuration();
  setStatus(`Bloque nuevo de ${entry.name}: elegí qué hace y hasta cuándo.`);
}

// Crea un bloque NUEVO DE DESPLAZAMIENTO: arranca en modo de marcado
// (clic = inicio verde, clic = fin rojo) y la duración sale sola.
function addMoveBlockFor(entry) {
  const endOfLast = charBlocks
    .filter(b => b.actions && b.actions[entry.id])
    .reduce((m, b) => Math.max(m, b.start + b.duration), 0);
  const b = {
    id: 'cb' + (++blockCounter),
    start: Math.round(Math.max(endOfLast, 0) * 10) / 10,
    duration: 2,
    actions: { [entry.id]: { action: null, mood: undefined, move: { from: null, to: null, speed: DEFAULT_MOVE_SPEED } } }
  };
  charBlocks.push(b);
  openCharBlockEditor(b);
  pushHistory();
  if (timelineBus.refreshDuration) timelineBus.refreshDuration();
  startMovePick(b, entry.id, 'from');
}

byId('btnAddCharBlock')?.addEventListener('pointerdown', (e) => e.stopPropagation());
byId('btnAddCharBlock')?.addEventListener('click', (e) => {
  e.stopPropagation();
  openBlockChooser(interactiveRegistry.get(store.activeTarget));
});

// ---------- Marcado de inicio/fin en el viewport ----------
// Modo de marcado: clic en el piso = punto VERDE (inicio), clic = punto ROJO
// (fin). La duración del bloque sale sola (distancia/velocidad).
let movePick = null; // { block, charId, end: 'from'|'to' }

const pickRay = new THREE.Raycaster();
const pickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const pickHit = new THREE.Vector3();
let markFrom = null;   // esfera verde (inicio)
let markTo = null;     // esfera roja (fin)
let markLine = null;   // línea entre ambas

function ensureMoveMarkers() {
  if (markFrom) return;
  const mat = (c) => new THREE.MeshBasicMaterial({ color: c, depthTest: false, transparent: true, opacity: 0.95 });
  markFrom = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 14), mat(0x35d03a));
  markTo = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 14), mat(0xe04040));
  markLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color: 0xffd24d, depthTest: false, transparent: true, opacity: 0.9 })
  );
  markFrom.renderOrder = 998;
  markTo.renderOrder = 998;
  markLine.renderOrder = 997;
  markFrom.visible = markTo.visible = markLine.visible = false;
  scene.add(markFrom, markTo, markLine);
}

// Muestra los puntos del bloque en edición (o los que se están marcando).
function updateMoveMarkers() {
  ensureMoveMarkers();
  let from = movePick && movePick.block.actions[movePick.charId].move.from;
  let to = movePick && movePick.block.actions[movePick.charId].move.to;
  if (!movePick && selectedBlock) {
    const solo = Object.keys(selectedBlock.actions || {})[0];
    const mv = solo && selectedBlock.actions[solo].move;
    if (mv) { from = mv.from; to = mv.to; }
  }
  markFrom.visible = !!from;
  markTo.visible = !!to;
  markLine.visible = !!(from && to);
  if (from) markFrom.position.set(from.x, 0.12, from.z);
  if (to) markTo.position.set(to.x, 0.12, to.z);
  if (from && to) {
    markLine.geometry.setFromPoints([
      new THREE.Vector3(from.x, 0.12, from.z),
      new THREE.Vector3(to.x, 0.12, to.z)
    ]);
  }
}

function floorPointAt(e) {
  const rect = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
  pickRay.setFromCamera(ndc, camera);
  if (!pickRay.ray.intersectPlane(pickPlane, pickHit)) return null;
  return { x: Math.round(pickHit.x * 20) / 20, z: Math.round(pickHit.z * 20) / 20 };
}

export function startMovePick(block, charId, end) {
  if (!block || !charBlocks.includes(block)) return;
  const a = block.actions[charId];
  if (!a || !a.move) return;
  movePick = { block, charId, end: end === 'to' ? 'to' : 'from' };
  store.pickMovePoints = true;
  updateMoveMarkers();
  showViewportHint(
    end === 'to' ? 'Clic en el piso: punto ROJO de llegada' : 'Clic en el piso: punto VERDE de inicio',
    { sticky: true }
  );
  setStatus(end === 'to' ? 'Marcá el punto ROJO (fin) en el piso. ESC cancela.' : 'Marcá el punto VERDE (inicio) en el piso. ESC cancela.');
}

export function cancelMovePick() {
  if (!movePick) return;
  movePick = null;
  store.pickMovePoints = false;
  showViewportHint('');
  updateMoveMarkers();
}

// Fija el punto marcado y, al completar el fin, calcula la duración.
function commitMovePoint(pt) {
  const pick = movePick;
  if (!pick) return;
  const a = pick.block.actions[pick.charId];
  if (!a || !a.move) { cancelMovePick(); return; }
  a.move[pick.end] = pt;
  if (pick.end === 'from') {
    startMovePick(pick.block, pick.charId, 'to');
  } else {
    const d = calcMoveDuration(a.move);
    pick.block.duration = Math.max(0.5, Math.round(d * 10) / 10);
    // La pose de fin queda guardada (al terminar, conserva lugar y acción)
    const entry = interactiveRegistry.get(pick.charId);
    a.pos = [pt.x, (entry && entry.rig && entry.rig.groundY) || 0, pt.z];
    a.rotY = Math.atan2(pt.x - a.move.from.x, pt.z - a.move.from.z);
    cancelMovePick();
    renderCharBlocks();
    pushHistory();
    if (timelineBus.refreshDuration) timelineBus.refreshDuration();
    setStatus(`Recorrido de ${pick.block.duration.toFixed(1)}s: elegí la animación (caminar/correr). 💾 guarda.`);
  }
  updateMoveMarkers();
}

canvas.addEventListener('pointerdown', (e) => {
  if (!movePick || e.button !== 0) return;
  e.stopPropagation();
  const pt = floorPointAt(e);
  if (pt) commitMovePoint(pt);
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && movePick) {
    cancelMovePick();
    renderCharBlocks();
    setStatus('Marcado cancelado (se conserva lo marcado hasta ahora).');
  }
});

// Exclusividad entre pistas: un solo bloque seleccionado en TODA la línea
// de tiempo. El propio 'char-block-selected' también nos llega cuando lo
// disparan los demás (ej. abrir un camino 🚶): soltar el bloque de acciones
// y/o la base ⏳ en edición. (Los disparadores internos emiten el evento
// ANTES de setear su nueva selección, así este listener nunca se pisa solo.)
window.addEventListener('shot-selected', clearCharBlockSelection);
window.addEventListener('sub-selected', clearCharBlockSelection);
window.addEventListener('quiz-block-selected', clearCharBlockSelection);
window.addEventListener('char-block-selected', () => {
  if (selectedBlock || baseSelectionId) clearCharBlockSelection();
});

// Carga desde el JSON (projectFiles.js)
export function setCharBlocks(blocks, full) {
  charBlocks.length = 0;
  (blocks || []).forEach((b, i) => {
    charBlocks.push({
      id: b.id || ('cb' + (i + 1)),
      start: b.start || 0,
      duration: Math.max(0.5, b.duration || 1),
      actions: b.actions || {}
    });
  });
  bumpCharBlockCounter(charBlocks.length);
  // charFullRange: acción de toda la escena por personaje
  Object.keys(charFullRange).forEach(k => delete charFullRange[k]);
  Object.keys(full || {}).forEach(charId => {
    charFullRange[charId] = { action: full[charId].action, mood: full[charId].mood || undefined };
  });
  selectedBlock = null;
  blockSnapshot = null;
  renderCharBlocks();
}

// El bus de cinematics llama esto cuando cambia un recorrido (bloque 🚶)
charLaneBus.refresh = () => renderCharBlocks();

// ---------- Botón "acción de toda la escena" (panel Personajes) ----------
// Con un personaje seleccionado, le asigna su acción base (fullRange): un
// bloque que cubre TODA la línea — y queda SELECCIONADO como cualquier
// bloque (💾 guarda, 🗑 quita, ✕ descarta).
byId('charFullActionBtn')?.addEventListener('click', () => {
  const e = interactiveRegistry.get(store.activeTarget);
  if (!e || (e.type !== 'human' && e.type !== 'pet')) {
    setStatus('Elegí un personaje primero.');
    return;
  }
  const base = e.initialState && e.initialState.action ? e.initialState.action : 'idle';
  charFullRange[e.id] = { action: base };
  renderCharBlocks();
  pushHistory();
  selectBaseBlock(e);
  setStatus(`${e.name}: acción de TODA la escena (${actionLabel(base)}). Ajustala en el panel.`);
});

void interactiveRegistry;
