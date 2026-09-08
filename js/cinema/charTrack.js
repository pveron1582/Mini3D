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

import { charBlocks, timeline, interactiveRegistry, blockEdit, charLaneBus, charFullRange, store, timelineBus } from '../state.js';
import { byId } from '../dom.js';
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

export function clearCharBlockSelection() {
  if (selectedBlock) {
    selectedBlock = null;
    blockSnapshot = null;
    renderCharBlockEditor();
    renderCharBlocks();
    blockEdit.set(null);
  }
  if (baseSelectionId) clearBaseSelection();
}

// ---------- Selección del bloque base ⏳ (acción de toda la escena) ----------
function selectBaseBlock(entry) {
  const base = charFullRange[entry.id];
  if (!base) return;
  // Exclusividad total: un solo bloque a la vez (suelta el de acciones y
  // cierra el editor de recorrido).
  if (selectedBlock) clearCharBlockSelection();
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
}

function clearBaseSelection() {
  if (baseSelectionId) {
    baseSelectionId = null;
    baseSnapshot = null;
    blockEdit.set(null);
    renderCharBlocks();
    const panel = byId('charBlockEditPanel');
    if (panel) panel.style.display = 'none';
  }
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
    if (a) state.set(charId, { action: a.action, mood: a.mood || null, t0: 0 });
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
        if (!a) return;
        if (expired && TALK_ACTIONS.has(a.action)) return;  // hablar expira con el tramo
        state.set(charId, { action: a.action, mood: a.mood || null, t0: b.start });
      });
    });
  return state;
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

function blockLabel(b) {
  const names = Object.keys(b.actions || {}).map(id => {
    const e = interactiveRegistry.get(id);
    const act = (b.actions[id] && b.actions[id].action) || 'idle';
    return act;
  });
  return names.length ? names.join(' + ') : '(vacío)';
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
      addBlockFor(entry);
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
        el.className = 'tl-sub tl-charblock tl-charbase' + (isSel ? ' selected' : '');
        el.style.left = (LANE_LABEL_W + 0) + 'px';
        el.style.width = Math.max(18, Math.max(timeline.duration, 20) * pps) + 'px';
        const lab = document.createElement('span');
        lab.className = 'tl-shot-label';
        lab.textContent = '⏳ ' + actionLabel(base.action);
        el.appendChild(lab);

        if (isSel) {
          const save = document.createElement('div');
          save.className = 'tl-shot-save';
          save.textContent = '💾';
          save.title = 'Guardar la acción de toda la escena';
          save.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); });
          save.addEventListener('click', (ev) => {
            ev.stopPropagation();
            // Guardar también DÓNDE está el personaje ahora: su posición y
            // rotación actuales pasan a ser su estado de toda la escena
            // (initialState) — ej. el perro movido quedó junto a la heladera.
            if (entry.initialState) {
              entry.initialState.pos = [
                entry.group.position.x,
                entry.group.position.y,
                entry.group.position.z
              ];
              entry.initialState.rotY = entry.group.rotation.y;
            } else {
              entry.initialState = {
                pos: [entry.group.position.x, entry.group.position.y, entry.group.position.z],
                rotY: entry.group.rotation.y,
                action: base.action
              };
            }
            clearBaseSelection();
            pushHistory();
            setStatus(`Acción + lugar de ${entry.name} guardados.`);
          });
          el.appendChild(save);

          // 🗑 quitar la acción base (el bloque desaparece de la lane)
          const trash = document.createElement('div');
          trash.className = 'tl-shot-del';
          trash.textContent = '🗑';
          trash.title = `Quitar la acción de toda la escena de ${entry.name}`;
          trash.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); });
          trash.addEventListener('click', (ev) => {
            ev.stopPropagation();
            delete charFullRange[entry.id];
            clearBaseSelection();
            renderCharBlocks();
            pushHistory();
            setStatus(`Acción base de ${entry.name} quitada.`);
          });
          el.appendChild(trash);

          const close = document.createElement('div');
          close.className = 'tl-shot-close';
          close.textContent = '✕';
          close.title = 'Descartar cambios de la acción base';
          close.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); });
          close.addEventListener('click', (ev) => {
            ev.stopPropagation();
            // Restaurar al snapshot tomado al seleccionar
            if (baseSnapshot && charFullRange[entry.id]) {
              charFullRange[entry.id] = JSON.parse(JSON.stringify(baseSnapshot));
            }
            clearBaseSelection();
            renderCharBlocks();
            setStatus('Cambios de la acción base descartados.');
          });
          el.appendChild(close);
        }

        el.title = `${entry.name}: ${actionLabel(base.action)} durante TODA la escena (click para editar)`;
        el.addEventListener('pointerdown', (e) => e.stopPropagation());
        el.addEventListener('click', (e) => { e.stopPropagation(); selectBaseBlock(entry); });
        inner.appendChild(el);
      }

      // --- BLOQUE 🚶 CAMINO (recorrido con waypoints) ---
      const info = charLaneBus.pathInfo(entry.id);
      if (info) {
        const el = document.createElement('div');
        el.className = 'tl-sub tl-charblock tl-charpath';
        el.style.left = (LANE_LABEL_W + 0) + 'px';
        const wSec = Math.min(info.duration > 0 ? info.duration : 1, Math.max(timeline.duration, 20));
        el.style.width = Math.max(24, wSec * pps) + 'px';
        const lab = document.createElement('span');
        lab.className = 'tl-shot-label';
        lab.textContent = `🚶 camino${info.loop ? ' 🔁' : ''}`;
        el.appendChild(lab);

        // Editar los waypoints sobre el piso (🎬/🎥). El camino NO se borra
        // desde acá: se borra vaciando sus waypoints en el editor.
        const editBtn = document.createElement('div');
        editBtn.className = 'tl-shot-save';
        editBtn.textContent = charLaneBus.isEditing(entry.id) ? '🎥' : '🎬';
        editBtn.title = charLaneBus.isEditing(entry.id)
          ? `Terminar la edición del recorrido de ${entry.name}`
          : `Editar el recorrido de ${entry.name} (waypoints sobre el piso)`;
        editBtn.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); });
        editBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          charLaneBus.toggleEditor(entry.id);
        });
        el.appendChild(editBtn);

        el.title = `Recorrido de ${entry.name}: ${info.duration.toFixed(1)}s · ${info.speed} m/s${info.loop ? ' · en bucle' : ''} — 🎬 edita los waypoints sobre el piso`;
        el.addEventListener('pointerdown', (e) => e.stopPropagation());
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          charLaneBus.toggleEditor(entry.id);
        });
        inner.appendChild(el);
      }

      // --- BLOQUES de acciones del personaje ---
      charBlocks
        .filter(b => b.actions && b.actions[entry.id])
        .sort((a, b) => a.start - b.start)
        .forEach(b => {
          const a = b.actions[entry.id];
          const isSel = b === selectedBlock;
          const el = document.createElement('div');
          el.className = 'tl-sub tl-charblock' + (isSel ? ' selected' : '');
          el.style.left = (LANE_LABEL_W + b.start * pps) + 'px';
          el.style.width = Math.max(18, b.duration * pps) + 'px';
          const lab = document.createElement('span');
          lab.className = 'tl-shot-label';
          lab.textContent = actionLabel(a.action);
          el.appendChild(lab);

          const left = document.createElement('div');
          left.className = 'tl-handle tl-handle-l';
          const right = document.createElement('div');
          right.className = 'tl-handle tl-handle-r';
          el.appendChild(left);
          el.appendChild(right);

          if (isSel) {
            const save = document.createElement('div');
            save.className = 'tl-shot-save';
            save.textContent = '💾';
            save.title = 'Guardar las acciones del bloque';
            save.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); });
            save.addEventListener('click', (ev) => {
              ev.stopPropagation();
              // Guardar también DÓNDE está cada personaje del bloque ahora:
              // su posición y rotación actuales quedan en el cuadro — en
              // reproducción aparece ahí (lugar + acción + ánimo).
              captureBlockPose(b);
              clearCharBlockSelection();
              pushHistory();
              setStatus('Bloque de personajes guardado (lugar + acción + ánimo).');
            });
            el.appendChild(save);

            // 🗑 Eliminar el bloque entero (entre 💾 y ✕)
            const trash = document.createElement('div');
            trash.className = 'tl-shot-del';
            trash.textContent = '🗑';
            trash.title = `Eliminar este bloque de ${entry.name} (de ${b.start.toFixed(1)}s a ${(b.start + b.duration).toFixed(1)}s)`;
            trash.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); });
            trash.addEventListener('click', (ev) => {
              ev.stopPropagation();
              const idx = charBlocks.indexOf(b);
              if (idx >= 0) charBlocks.splice(idx, 1);
              selectedBlock = null;
              blockSnapshot = null;
              blockEdit.set(null);
              renderCharBlocks();
              pushHistory();
              if (timelineBus.refreshDuration) timelineBus.refreshDuration();
              setStatus(`Bloque de ${entry.name} eliminado.`);
            });
            el.appendChild(trash);

            const close = document.createElement('div');
            close.className = 'tl-shot-close';
            close.textContent = '✕';
            close.title = 'Descartar cambios del bloque';
            close.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); });
            close.addEventListener('click', (ev) => {
              ev.stopPropagation();
              if (blockSnapshot && selectedBlock) {
                Object.assign(selectedBlock, JSON.parse(JSON.stringify(blockSnapshot)));
              }
              clearCharBlockSelection();
              setStatus('Cambios del bloque descartados.');
            });
            el.appendChild(close);
          }

          el.title = `${entry.name}: ${actionLabel(a.action)} · ${b.start.toFixed(1)}s → ${(b.start + b.duration).toFixed(1)}s`;
          el.addEventListener('pointerdown', (e) => beginCharBlockDrag(e, b, el));
          el.addEventListener('click', () => {
            if (el.dataset.dragged === '1') { el.dataset.dragged = ''; return; }
            openCharBlockEditor(b);
          });
          inner.appendChild(el);
        });

      lane.appendChild(inner);
    }
    host.appendChild(lane);
  });
  renderCharBlockEditor();
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

function openCharBlockEditor(b) {
  if (!b || !charBlocks.includes(b)) return;
  // Exclusividad total: un solo bloque a la vez. Soltar la selección de
  // base (bloque ⏳), cualquier otra pista (tomas/subtítulos/cartels por el
  // mismo evento) y cerrar el editor de recorrido si estaba abierto.
  if (baseSelectionId) clearBaseSelection();
  charLaneBus.closeEditor();
  window.dispatchEvent(new CustomEvent('char-block-selected'));
  selectedBlock = b;
  blockSnapshot = JSON.parse(JSON.stringify({ start: b.start, duration: b.duration, actions: b.actions }));
  blockEdit.set('charblock');
  renderCharBlocks();
  setStatus('Editando el cuadro: acción, ánimo y lugar quedan guardados en él (💾 confirma, ✕ descarta).');
  window.dispatchEvent(new CustomEvent('edit-mode-request', { detail: { mode: 'personajes' } }));
}

function renderCharBlockEditor() {
  const panel = byId('charBlockEditPanel');
  if (!panel) return;
  if (!selectedBlock) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  // El bloque es de UN SOLO personaje: el título lo nombra.
  const solo = Object.keys(selectedBlock.actions || {})[0];
  const soloEntry = solo ? interactiveRegistry.get(solo) : null;
  const title = byId('charBlockTitle');
  if (title) {
    title.textContent = soloEntry
      ? `${soloEntry.name} (${selectedBlock.start.toFixed(1)}s → ${(selectedBlock.start + selectedBlock.duration).toFixed(1)}s)`
      : `(bloque vacío — eliminalo con 🗑)`;
  }
  const list = byId('charBlockList');
  if (!list) return;
  list.innerHTML = '';

  Object.keys(selectedBlock.actions || {}).forEach(charId => {
    const entry = interactiveRegistry.get(charId);
    const a = selectedBlock.actions[charId];
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
    const pose = currentPoseOf(charId);
    if (pose) Object.assign(b.actions[charId], pose);
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
// Crea un bloque NUEVO de ACCIÓN para un personaje, al final de sus bloques
// (un bloque = un personaje), seleccionado para editar directo.
function addBlockFor(entry) {
  if (!entry || (entry.type !== 'human' && entry.type !== 'pet')) {
    setStatus('Elegí un personaje primero (su lane o la lista): el bloque nuevo es de UN personaje.');
    return;
  }
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
  setStatus(`Bloque nuevo de ${entry.name}: elegí qué hace y hasta cuándo. 💾 guarda, ✕ descarta.`);
}

byId('btnAddCharBlock')?.addEventListener('pointerdown', (e) => e.stopPropagation());
byId('btnAddCharBlock')?.addEventListener('click', (e) => {
  e.stopPropagation();
  addBlockFor(interactiveRegistry.get(store.activeTarget));
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
