import * as THREE from 'three';
import { byId, qs, qsa } from '../dom.js';
import { scene } from '../core.js';
import { store, cinema, view, interactiveRegistry } from '../state.js';

import {
  cinemaStorePath, cinemaLoadTarget, updateCameraViewVisibility,
  refreshCinemaUI, setCamView
} from '../cinema/cinematics.js';
// P5: los paneles de UI se actualizan vía onTargetSelected (registrado en ui.js),
// en vez de que selection.js importe ui.js (rompe el ciclo selection → ui).

// ==========================================
// OBJECT REGISTRY & SELECTION SYSTEM
// ==========================================
export function registerSelectable(id, name, group, type, rig = null) {
  group.userData = { id, name, type };
  // Recursively mark children
  group.traverse((child) => {
    child.userData.selectableRoot = group;
  });
  interactiveRegistry.set(id, { id, name, group, type, rig });
}

// Quita un objeto del registro de seleccionables (lo usa la capa de
// construcción al recrearse desde el JSON: borra las piezas viejas primero).
export function unregisterSelectable(id) {
  const entry = interactiveRegistry.get(id);
  if (!entry) return;
  if (store.activeTarget === id) store.activeTarget = null;
  entry.group.traverse((child) => { delete child.userData.selectableRoot; });
  interactiveRegistry.delete(id);
}

function createSelectionRing() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.65, 32),
    new THREE.MeshBasicMaterial({
      color: 0x5685cf,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    })
  );
  ring.rotation.x = Math.PI / 2;
  g.add(ring);

  const inner = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 32),
    new THREE.MeshBasicMaterial({
      color: 0x5685cf,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.15
    })
  );
  inner.rotation.x = Math.PI / 2;
  g.add(inner);

  g.position.y = 0.02;
  scene.add(g);
  return g;
}
export const selectionRing = createSelectionRing();

export function getActiveEntry() {
  return interactiveRegistry.get(store.activeTarget) || null;
}

// Hooks que se notifican cuando cambia el objeto activo (ej. para mostrar
// botones de propiedades dependientes del tipo, como la puerta del mini rack).
const targetListeners = [];
export function onTargetSelected(cb) {
  targetListeners.push(cb);
}
function notifyTargetSelected(id) {
  targetListeners.forEach(cb => cb(id));
}

export function getActiveObject() {
  const entry = getActiveEntry();
  return entry ? entry.group : null;
}

export function setActiveTarget(id) {
  if (!interactiveRegistry.has(id)) return;
  const entry = interactiveRegistry.get(id);
  // Los objetos borrados (soft-delete del catálogo) no son seleccionables
  if (entry.deleted) return;
  // Paredes, puertas y ventanas SOLO seleccionables en modo "Editar Edificio".
  if ((entry.type === 'wall' || entry.type === 'door' || entry.type === 'window' || entry.type === 'floor') && !store.editBuilding) return;
  store.activeTarget = id;

  // Update Buttons & Outliner
  qsa('.target-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-target') === id);
  });
  qsa('.outliner-item').forEach(item => {
    item.classList.toggle('selected', item.getAttribute('data-id') === id);
  });

  const humanActions = byId('humanActionsGrid');
  const petActions = byId('petActionsGrid');
  const propControls = byId('propControlsGrid');
  const moodGrid = byId('humanMoodGrid');
  const humanGestures = byId('humanGesturesGrid');
  const humanGesturesLabel = byId('humanGesturesLabel');
  const gestureSearchInput = byId('gestureSearch');
  const actionsTitle = byId('actionsSectionTitle');
  const transformTitle = byId('transformSectionTitle');
  const badge = byId('hudSelectedBadge');

  if (entry.type === 'human') {
    if (humanActions) humanActions.style.display = 'grid';
    if (petActions) petActions.style.display = 'none';
    if (propControls) propControls.style.display = 'none';
    if (moodGrid) moodGrid.style.display = 'grid';
    if (humanGestures) humanGestures.style.display = '';
    if (gestureSearchInput) gestureSearchInput.style.display = '';
    if (humanGesturesLabel) humanGesturesLabel.style.display = '';
    if (actionsTitle) actionsTitle.textContent = `Animaciones (${entry.name})`;
    if (transformTitle) transformTitle.textContent = `Posición 3D (${entry.name})`;
    if (badge) badge.textContent = `🧍 Enfocado: ${entry.name}`;
  } else if (entry.type === 'pet') {
    if (humanActions) humanActions.style.display = 'none';
    if (petActions) petActions.style.display = 'grid';
    if (propControls) propControls.style.display = 'none';
    if (moodGrid) moodGrid.style.display = 'none';
    if (humanGestures) humanGestures.style.display = 'none';
  if (gestureSearchInput) gestureSearchInput.style.display = 'none';
    if (humanGesturesLabel) humanGesturesLabel.style.display = 'none';
    if (actionsTitle) actionsTitle.textContent = `Animaciones (${entry.name})`;
    if (transformTitle) transformTitle.textContent = `Posición 3D (${entry.name})`;
    if (badge) badge.textContent = `🐾 Enfocado: ${entry.name}`;
  } else {
    if (humanActions) humanActions.style.display = 'none';
    if (petActions) petActions.style.display = 'none';
    if (propControls) propControls.style.display = 'flex';
    if (moodGrid) moodGrid.style.display = 'none';
    if (humanGestures) humanGestures.style.display = 'none';
  if (gestureSearchInput) gestureSearchInput.style.display = 'none';
    if (humanGesturesLabel) humanGesturesLabel.style.display = 'none';
    if (actionsTitle) actionsTitle.textContent = `Objeto (${entry.name})`;
    if (transformTitle) transformTitle.textContent = `Posición 3D (${entry.name})`;
    if (badge) badge.textContent = `📦 Enfocado: ${entry.name}`;
  }

  updateSelectionRing();

  // Guardar el recorrido del objetivo anterior si la cinemática está activa
  if (cinema.active && cinema.targetId && cinema.targetId !== id) {
    cinemaStorePath(cinema.targetId);
  }
  updateCameraViewVisibility();
  if (cinema.active) {
    cinemaLoadTarget(id);
  } else {
    const e = interactiveRegistry.get(id);
    if (e && e.type !== 'human' && e.type !== 'pet' && view.mode !== 'orbit') {
      setCamView('orbit');
    }
  }
  refreshCinemaUI();
  notifyTargetSelected(id);
}

// Deseleccionar el objeto activo (personaje / objeto / pared). Por defecto, al
// hacer click fuera del objeto en el viewport, éste deja de estar seleccionado.
export function clearActiveTarget() {
  const had = !!store.activeTarget;
  store.activeTarget = null;

  // Guardar el recorrido del objetivo si la cinemática está activa
  if (cinema.active && cinema.targetId) {
    cinemaStorePath(cinema.targetId);
  }

  selectionRing.visible = false;

  qsa('.target-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  qsa('.outliner-item').forEach(item => {
    item.classList.remove('selected');
  });

  const humanActions = byId('humanActionsGrid');
  const petActions = byId('petActionsGrid');
  const propControls = byId('propControlsGrid');
  const moodGrid = byId('humanMoodGrid');
  const humanGestures = byId('humanGesturesGrid');
  const humanGesturesLabel = byId('humanGesturesLabel');
  const gestureSearchInput = byId('gestureSearch');
  const actionsTitle = byId('actionsSectionTitle');
  const transformTitle = byId('transformSectionTitle');
  const badge = byId('hudSelectedBadge');
  if (humanActions) humanActions.style.display = 'none';
  if (petActions) petActions.style.display = 'none';
  if (propControls) propControls.style.display = 'none';
  if (moodGrid) moodGrid.style.display = 'none';
  if (humanGestures) humanGestures.style.display = 'none';
  if (gestureSearchInput) gestureSearchInput.style.display = 'none';
  if (humanGesturesLabel) humanGesturesLabel.style.display = 'none';
  if (actionsTitle) actionsTitle.textContent = 'Animaciones';
  if (transformTitle) transformTitle.textContent = 'Posición 3D';
  if (badge) badge.textContent = '';

  updateCameraViewVisibility();
  refreshCinemaUI();
  notifyTargetSelected(null);
  return had;
}

export function updateSelectionRing() {
  const entry = getActiveEntry();
  if (entry && entry.group && entry.group.parent) {
    selectionRing.visible = true;
    selectionRing.position.x = entry.group.position.x;
    selectionRing.position.z = entry.group.position.z;
    selectionRing.position.y = entry.group.position.y + 0.02;

    if (entry.type === 'human') selectionRing.scale.set(1.0, 1.0, 1.0);
    else if (entry.type === 'pet') selectionRing.scale.set(0.9, 0.9, 0.9);
    else if (entry.id.includes('desk') || entry.id.includes('Table')) selectionRing.scale.set(2.4, 2.4, 2.4);
    else selectionRing.scale.set(0.8, 0.8, 0.8);

    // El anillo acompaña el tamaño actual del objeto
    const s = entry.group.scale.x;
    if (s !== 1) selectionRing.scale.multiplyScalar(s);
  } else {
    selectionRing.visible = false;
  }
}