import * as THREE from 'three';
import { scene } from './core.js';
import { store, cinema, view, interactiveRegistry } from './state.js';
import { updateGizmoPosition } from './gizmo.js';
import {
  cinemaStorePath, cinemaLoadTarget, updateCameraViewVisibility,
  refreshCinemaUI, setCamView
} from './cinematics.js';
import { updateActionButtonsState, syncSlidersFromTarget, refreshWallPanel } from './ui.js';

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

export function getActiveObject() {
  const entry = getActiveEntry();
  return entry ? entry.group : null;
}

export function setActiveTarget(id) {
  if (!interactiveRegistry.has(id)) return;
  store.activeTarget = id;
  const entry = interactiveRegistry.get(id);

  // Update Buttons & Outliner
  document.querySelectorAll('.target-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-target') === id);
  });
  document.querySelectorAll('.outliner-item').forEach(item => {
    item.classList.toggle('selected', item.getAttribute('data-id') === id);
  });

  const humanActions = document.getElementById('humanActionsGrid');
  const petActions = document.getElementById('petActionsGrid');
  const propControls = document.getElementById('propControlsGrid');
  const actionsTitle = document.getElementById('actionsSectionTitle');
  const transformTitle = document.getElementById('transformSectionTitle');
  const badge = document.getElementById('hudSelectedBadge');

  if (entry.type === 'human') {
    if (humanActions) humanActions.style.display = 'grid';
    if (petActions) petActions.style.display = 'none';
    if (propControls) propControls.style.display = 'none';
    if (actionsTitle) actionsTitle.textContent = `Animaciones (${entry.name})`;
    if (transformTitle) transformTitle.textContent = `Posición 3D (${entry.name})`;
    if (badge) badge.textContent = `🧍 Enfocado: ${entry.name}`;
    updateActionButtonsState(entry.rig ? entry.rig.currentAction : 'idle');
  } else if (entry.type === 'pet') {
    if (humanActions) humanActions.style.display = 'none';
    if (petActions) petActions.style.display = 'grid';
    if (propControls) propControls.style.display = 'none';
    if (actionsTitle) actionsTitle.textContent = `Animaciones (${entry.name})`;
    if (transformTitle) transformTitle.textContent = `Posición 3D (${entry.name})`;
    if (badge) badge.textContent = `🐾 Enfocado: ${entry.name}`;
    updateActionButtonsState(entry.rig ? entry.rig.currentAction : 'idle');
  } else {
    if (humanActions) humanActions.style.display = 'none';
    if (petActions) petActions.style.display = 'none';
    if (propControls) propControls.style.display = 'flex';
    if (actionsTitle) actionsTitle.textContent = `Objeto (${entry.name})`;
    if (transformTitle) transformTitle.textContent = `Posición 3D (${entry.name})`;
    if (badge) badge.textContent = `📦 Enfocado: ${entry.name}`;
  }

  updateSelectionRing();
  syncSlidersFromTarget();
  refreshWallPanel();

  // Guardar el recorrido del objetivo anterior si la cinemática está activa
  if (cinema.active && cinema.targetId && cinema.targetId !== id) {
    cinemaStorePath(cinema.targetId);
  }
  updateGizmoPosition();
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
