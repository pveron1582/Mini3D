import * as THREE from 'three';
import { scene } from '../core.js';
import { registerSelectable } from '../ui/selection.js';
import { stepLadder } from '../office/group.js';
import { updateActionButtonsState, updateMoodButtonsState } from '../ui/ui.js';
import { setStatus } from '../media/recorder.js';
import { store, interactiveRegistry } from '../state.js';
import { registerTicker, unregisterTicker } from '../tickers.js';
import { anchorPose, anchorSeats } from './anchors.js';

// ==========================================
// 3D CHARACTERS (3 HUMANS, DOG, CAT)
// ==========================================
export const characterGroup = new THREE.Group();
scene.add(characterGroup);

// ==========================================
// GESTOS DE UN DISPARO (one-shot): se reproducen una vez y vuelven a la acción
// base. Se activan con setAction('gesture:<nombre>') o rig.playGesture(<nombre>).
// Cada gesto usa tiempo local (e desde que empezó) y una envolvente que sube y
// baja para entrar y salir suave de la pose.
// ==========================================
const mix = (a, b, k) => a + (b - a) * k;
const genv = (e, duration) => Math.sin(Math.PI * Math.max(0, Math.min(1, e / duration)));

// ==========================================
// TRANSICIONES SUAVES ENTRE ACCIONES (backlog #5)
// ==========================================
// Al cambiar de acción, la pose no salta en seco: se interpola cada
// articulación desde la pose anterior hasta la nueva durante BLEND_DUR.
// Genérico (sirve para humanos, perro y gato): foto de transforms al cambiar
// + lerp/slerp al final de cada frame de animación. Solo cuesta traversar el
// rig mientras dura la mezcla (0.3 s). La raíz (posición en el mundo) queda
// afuera: la manejan la escena (caminos, gizmo, asientos).
const BLEND_DUR = 0.3;
const _bq1 = new THREE.Quaternion();
const _bq2 = new THREE.Quaternion();

function snapshotRigPose(rig) {
  const snap = new Map();
  rig.root.traverse(o => {
    if (o === rig.root) return;
    snap.set(o, { p: o.position.clone(), e: o.rotation.clone(), s: o.scale.clone() });
  });
  return snap;
}

function beginRigBlend(rig) {
  rig._blendFrom = snapshotRigPose(rig);
  rig._blendT0 = rig._now || 0;
}

function applyRigBlend(rig, now) {
  const from = rig._blendFrom;
  if (!from) return;
  const k = (now - rig._blendT0) / BLEND_DUR;
  // Fuera de la ventana (o tiempo hacia atrás): se termina sin mezclar.
  if (!(k >= 0) || k >= 1) { rig._blendFrom = null; return; }
  const e = k * k * (3 - 2 * k); // smoothstep: arranca y frena suave
  rig.root.traverse(o => {
    if (o === rig.root) return;
    const f = from.get(o);
    if (!f) return;
    o.position.lerpVectors(f.p, o.position, e);
    o.quaternion.slerpQuaternions(_bq1.setFromEuler(f.e), _bq2.setFromEuler(o.rotation), e);
    o.scale.lerpVectors(f.s, o.scale, e);
  });
}

export const GESTURE_DEFS = {
  point: { duration: 2.0, label: '👉 Señalar', animate: (e, p) => {
    const k = genv(e, 2.0);
    p.h_armR.position.set(mix(0.38, 0.30, k), mix(1.4, 1.38, k), mix(0, 0.1, k));
    p.h_armR.rotation.set(mix(0, -1.4, k), mix(0, 0.4, k), mix(-0.08, -0.1, k));
    p.h_elbowR.rotation.x = mix(-0.15, -0.05, k);
    p.h_head.rotation.y = mix(0, 0.3, k);
    p.h_torso.rotation.y = mix(0, 0.3, k);
    p.h_torso.rotation.x = mix(0, 0.04, k);
  } },
  wave: { duration: 2.2, label: '👋 Saludar', animate: (e, p) => {
    const k = genv(e, 2.2);
    // El brazo cuelga en -y desde el pivote (±0.38). Para la mano DERECHA que
    // sube hacia AFUERA (+x, lado derecho) la rotación en z debe ser POSITIVA
    // (antes negativa → el brazo se balanceaba hacia adentro y chocaba con la
    // cara/cuerpo). z≈2.4 deja la mano arriba-afuera del hombro, oscilando.
    const osc = Math.sin(e * 7) * 0.12 * k;
    p.h_armR.rotation.set(mix(0, 0.1, k), mix(0, 0.12, k), mix(-0.08, 2.4, k) + osc);
    p.h_elbowR.rotation.x = mix(-0.15, -0.35, k); // brazo casi recto, mano afuera
    p.h_head.rotation.y = mix(0, 0.22, k);
    p.h_torso.rotation.y = mix(0, -0.13, k);
  } },
  shrug: { duration: 1.8, label: '🤷 Encogerse de hombros', animate: (e, p) => {
    const k = genv(e, 1.8);
    // Encogerse abre los brazos hacia AFUERA (derecho +z, izquierdo -z), con
    // los codos doblados, de modo que las manos quedan a los lados del cuerpo
    // sin atravesar el torso ni la cabeza. Hombros suben con el torso.
    const wobble = Math.sin(e * 5) * 0.1 * k;   // vaivén de "no sé"
    p.h_armL.rotation.set(mix(0, -0.25, k), mix(0, -0.2, k), mix(0.08, -0.8, k) + wobble);
    p.h_armR.rotation.set(mix(0, -0.25, k), mix(0, 0.2, k), mix(-0.08, 0.8, k) - wobble);
    p.h_elbowL.rotation.x = mix(-0.15, -0.85, k);
    p.h_elbowR.rotation.x = mix(-0.15, -0.85, k);
    p.h_head.rotation.z = mix(0, 0.15, k) + wobble;
    p.h_head.rotation.y = mix(0, 0.1, k);
    p.h_torso.position.y = mix(1.1, 1.15, k);
    p.h_head.position.y = mix(1.76, 1.8, k);
  } },
  no: { duration: 1.8, label: '🙅 Negar con la cabeza', animate: (e, p) => {
    const k = genv(e, 1.8);
    p.h_head.rotation.y = Math.sin(e * 9) * 0.4 * k;
  } },
  yes: { duration: 1.6, label: '✅ Asentir con la cabeza', animate: (e, p) => {
    const k = genv(e, 1.6);
    // cabeceo afirmativo: dos golpes de cabeza hacia abajo, torso acompaña
    p.h_head.rotation.x = Math.sin(e * 8) * 0.22 * k;
    p.h_torso.rotation.x = Math.sin(e * 8) * 0.04 * k;
  } },
  clap: { duration: 2.6, label: '👏 Aplaudir', animate: (e, p) => {
    const k = genv(e, 2.6);
    // ALTURA FIJA: pivot.x y codo se mantienen constantes (el brazo queda
    // adelante, antebrazo a la altura del pecho). El movimiento de aplaudir es
    // LATERAL: el beat abre y cierra las palmas variando únicamente pivot.y
    // (derecho -/izquierdo +). Cerca (beat) = palmas juntas frente al pecho;
    // lejos (off-beat) = abiertas. Así se chocan sin subir ni bajar.
    const beat = Math.abs(Math.sin(e * 9));
    // cerrado en el beat (±0.5), abierto fuera de él (±1.0)
    const close = 0.5 + (1 - beat) * 0.5;
    p.h_armL.rotation.set(mix(0, -1.15, k), mix(0, close, k), mix(0.08, 0.14, k));
    p.h_armR.rotation.set(mix(0, -1.15, k), mix(0, -close, k), mix(-0.08, -0.14, k));
    // codo fijo: levanta el antebrazo a la altura del pecho (no varía con beat)
    p.h_elbowL.rotation.x = mix(-0.15, -0.95, k);
    p.h_elbowR.rotation.x = mix(-0.15, -0.95, k);
    p.h_torso.rotation.x = mix(0, 0.04, k);
    p.h_head.rotation.x = mix(0, 0.06, k);
  } },
  watch: { duration: 2.6, label: '⌚ Mirar el reloj', animate: (e, p) => {
    const k = genv(e, 2.6);
    // antebrazo izquierdo horizontal cruzando el pecho para ver la muñeca
    p.h_armL.position.set(mix(-0.38, -0.14, k), mix(1.4, 1.36, k), mix(0, 0.18, k));
    p.h_armL.rotation.set(mix(0, -1.35, k), 0, mix(0.08, 0.15, k));
    p.h_elbowL.rotation.x = mix(-0.15, -1.95, k);
    // cabeza inclinada hacia la muñeca, con dos pasadas de mirada
    p.h_head.rotation.x = mix(0, 0.34, k);
    p.h_head.rotation.y = mix(0, -0.3, k) + Math.sin(e * 3.2) * 0.08 * k;
    // peso del cuerpo ladeado + pie derecho tamborileando (impaciencia)
    p.h_torso.rotation.z = mix(0, 0.06, k);
    p.h_legR.rotation.x = Math.sin(e * 5) * 0.06 * k;
  } },
  facepalm: { duration: 2.6, label: '🤦 Facepalm', animate: (e, p) => {
    const k = genv(e, 2.6);
    const lift = Math.min(1, e / 0.6) * k; // sube rápido a la cara
    // SUBE el brazo: pivot.x más negativo lleva el brazo derecho hacia
    // adelante/arriba (mano a la altura de la cara, no del centro del cuerpo).
    // pivot.y (negativo) lo acerca al centro; el codo flexiona (elbow.x) para
    // que la PALMA apoye en la frente y rot.z orienta la palma hacia la cara.
    p.h_armR.rotation.set(mix(0, -1.5, lift), mix(0, -0.25, lift), mix(-0.08, -0.55, lift));
    p.h_elbowR.rotation.x = mix(-0.15, -1.8, lift);  // antebrazo encogido: la mano llega a la cara
    p.h_elbowR.rotation.z = mix(0, -0.35, lift);      // palma hacia la frente
    p.h_head.rotation.x = mix(0, 0.3, k);
    p.h_head.rotation.y = mix(0, 0.15, k);
    p.h_torso.rotation.x = mix(0, 0.08, k);
  } },
  celebrate: { duration: 2.8, label: '🎉 Festejo', animate: (e, p) => {
    const k = genv(e, 2.8);
    // saltitos con los puños arriba: los brazos rotan hacia ADELANTE (x -2.7)
    // y se abren/cierran con rotation.y moderado, manteniendo los hombros en
    // su sitio (±0.38) para que no entren ni atraviesen el cuerpo ni la cabeza.
    const hop = Math.abs(Math.sin(e * 6.5)) * 0.12 * k;
    const pump = Math.sin(e * 6.5) * 0.15 * k;   // bamboleo de apertura (suave)
    p.h_root.position.y = 0.17 + hop;
    p.h_armL.rotation.set(mix(0, -2.7, k), mix(0, 0.45, k) + pump, mix(0.08, 0.1, k));
    p.h_armR.rotation.set(mix(0, -2.7, k), mix(0, -0.45, k) - pump, mix(-0.08, -0.1, k));
    p.h_elbowL.rotation.x = mix(-0.15, -0.9, k);
    p.h_elbowR.rotation.x = mix(-0.15, -0.9, k);
    p.h_head.rotation.x = mix(0, -0.2, k);   // mira arriba
    p.h_torso.rotation.x = mix(0, -0.06, k); // pecho afuera
  } }
};

// ==========================================
// UTILIDAD DE ORIENTACIÓN (convención única del proyecto)
// ==========================================
// El rig "mira" hacia la dirección (sin(rotY), cos(rotY)) en el plano XZ:
//   rotY = 0    → mira al SUR (+z)      [human5: rotY=0 "mira al sur"]
//   rotY = π    → mira al NORTE (-z)    [human2: rotY=π "mira al norte"]
//   rotY = -π/2 → mira al OESTE (-x)    [human1: rotY=-π/2 "mira al oeste"]
//   rotY = +π/2 → mira al ESTE (+x)
// VERIFICADO contra todos los casos del código (human1–9, perro, gato).
// Esta función ES la única forma correcta de calcular "mirá hacia allá".
// Evita el error sistemático de invertir la fórmula a mano (personajes y
// sillas quedaban de espaldas). USAR SIEMPRE ESTA; no inventar atan2 propio.
export function rotYToLookAt(fromX, fromZ, toX, toZ) {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  return Math.atan2(dx, dz);
}
// Resuelve el error repetido de "personajes mal parados cerca de mesas/muebles":
// `standInFrontOf(rig, anchorName)` coloca al personaje pegado a la cara de
// USO del mueble (su frente, local +z) mirándolo. Los muebles registran esa
// cara con su ancla (ej. mesada, escritorio, heladera, mini rack). Así, sin
// adivinar coordenadas a mano, quien está de pie frente a una mesa la usa.
// Posiciona al personaje de pie junto a un mueble/objeto, mirándolo.
// El "frente de uso" del mueble es su lado +z local (convención de este
// proyecto — los que lo registran llevan esa cara al usuario).
export function standInFrontOf(rig, anchorOrEntryName, dist = 0.55) {
  // Soporta anclas registradas ('seat_xxx') o el nombre id del objeto en el
  // registro (furniture/props): así se puede usar con cualquier cosa del
  // editor, no solo con anclas.
  let pose = anchorPose(anchorOrEntryName);
  if (!pose) {
    const e = interactiveRegistry.get(anchorOrEntryName);
    if (e && e.group) {
      pose = { x: e.group.position.x, z: e.group.position.z, rotY: e.group.rotation.y };
      // Alerta: este mueble no tenía ancla, uso su posición/rotación directa)
    }
  }
  if (!rig || !rig.root || !pose) return false;
  const g = rig.root;
  const c = Math.cos(pose.rotY), s = Math.sin(pose.rotY);
  // Punto a `dist` del mueble hacia su cara de uso (mismo lado que quien lo usa).
  const px = pose.x + dist * s;
  const pz = pose.z + dist * c;
  g.position.set(px, 0, pz);
  g.rotation.y = rotYToLookAt(px, pz, pose.x, pose.z);
  return true;
}

// Posicionar al personaje de pie mirando un punto arbitrario (sin ancla):
// se para a 'dist' de ese punto, del lado indicado por 'side' (en radianes,
// 0 = desde el sur). Usado cuando no hay mueble ancla y el objetivo es otro
// punto libre (ej. junto a la pared, cerca de una ventana).
export function standFacing(rig, targetX, targetZ, dist = 0.55, side = 0) {
  const g = rig.root;
  if (!g) return false;
  const px = targetX - dist * Math.cos(side);
  const pz = targetZ - dist * Math.sin(side);
  g.position.set(px, 0, pz);
  g.rotation.y = rotYToLookAt(px, pz, targetX, targetZ);
  return true;
}

// Universal Humanoid Rig Builder
function createHumanoidModel(id, name, posX, posZ, colors, opts = {}) {
  const g = new THREE.Group();
  // +0.17: los pies llegan a y = -0.14 con la pierna extendida; margen extra
  // para que el calzado no se hunda visualmente en el piso
  g.position.set(posX, 0.17, posZ);

  const matSkin = new THREE.MeshStandardMaterial({ color: colors.skin || 0xffd1a4, roughness: 0.5 });
  const matHair = new THREE.MeshStandardMaterial({ color: colors.hair || 0x2b1d14, roughness: 0.8 });
  const matShirt = new THREE.MeshStandardMaterial({ color: colors.shirt || 0x2e64d8, roughness: 0.6 });
  const matPants = new THREE.MeshStandardMaterial({ color: colors.pants || 0x232733, roughness: 0.7 });
  const matShoes = new THREE.MeshStandardMaterial({ color: colors.shoes || 0x111111, roughness: 0.4 });
  const matWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const matEyes = new THREE.MeshBasicMaterial({ color: 0x111111 });

  // 1. Torso
  const torso = new THREE.Group();
  torso.position.y = 1.1;

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.7, 0.32), matShirt);
  chest.castShadow = true;
  torso.add(chest);

  if (colors.hasTie) {
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.38, 0.04), new THREE.MeshStandardMaterial({ color: 0xc0392b }));
    tie.position.set(0, 0.1, 0.17);
    torso.add(tie);
  }

  if (colors.hoodie) {
    // Bolsillo canguro de la sudadera
    const pocketMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.shirt || 0x141414).multiplyScalar(0.55).getHex(), roughness: 0.7
    });
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.05), pocketMat);
    pocket.position.set(0, -0.16, 0.17);
    torso.add(pocket);
    // Cordones de la capucha
    const strMat = new THREE.MeshBasicMaterial({ color: 0xbfbfbf });
    const strL = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.16, 0.02), strMat);
    strL.position.set(-0.08, 0.2, 0.17);
    torso.add(strL);
    const strR = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.16, 0.02), strMat);
    strR.position.set(0.08, 0.2, 0.17);
    torso.add(strR);
  }

  const waist = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.12, 0.3), matPants);
  waist.position.y = -0.38;
  torso.add(waist);

  // Vestimentas de trabajo (outfits): piezas extra sobre el torso para dar
  // oficios reconocibles con el mismo rig low-poly.
  if (colors.outfit === 'overall') {
    // MAMELUCO: pechera con tirantes cruzando los hombros, del color del pantalón
    const bib = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.34, 0.05), matPants);
    bib.position.set(0, 0.12, 0.175);
    torso.add(bib);
    const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.05), matPants);
    strapL.position.set(-0.14, 0.42, 0.1);
    strapL.rotation.z = 0.12;
    torso.add(strapL);
    const strapR = strapL.clone();
    strapR.position.x = 0.14;
    strapR.rotation.z = -0.12;
    torso.add(strapR);
  } else if (colors.outfit === 'cleaner') {
    // LIMPIEZA: delantal sobre la ropa y un parche con logo al pecho
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.5, 0.04), new THREE.MeshStandardMaterial({ color: 0x4aa3df, roughness: 0.8 }));
    apron.position.set(0, -0.05, 0.18);
    torso.add(apron);
    const patch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.02), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    patch.position.set(0.14, 0.16, 0.21);
    torso.add(patch);
  } else if (colors.outfit === 'chef') {
    // COCINERO: chaqueta blanca doble fila de botones + pañuelo al cuello
    const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.56, 0.36), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.65 }));
    jacket.position.set(0, 0.06, 0.01);
    torso.add(jacket);
    for (let i = 0; i < 4; i++) {
      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), new THREE.MeshStandardMaterial({ color: 0xd9d9d9, metalness: 0.3 }));
      btn.position.set(-0.1 + (i % 2) * 0.2, 0.22 - Math.floor(i / 2) * 0.24, 0.2);
      torso.add(btn);
    }
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.34), new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.7 }));
    neck.position.set(0, 0.4, 0);
    torso.add(neck);
  }
  g.add(torso);

  // 2. Head
  const head = new THREE.Group();
  head.position.y = 1.76;

  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.42, 0.38), matSkin);
  headMesh.castShadow = true;
  head.add(headMesh);

  // Hair style / capucha
  if (colors.hoodie) {
    // Capucha de la sudadera: envuelve la cabeza dejando la cara descubierta
    const hoodTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.48), matShirt);
    hoodTop.position.set(0, 0.27, -0.05);
    hoodTop.castShadow = true;
    head.add(hoodTop);
    const hoodBack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.44, 0.14), matShirt);
    hoodBack.position.set(0, 0.04, -0.25);
    hoodBack.castShadow = true;
    head.add(hoodBack);
    const hoodL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.44), matShirt);
    hoodL.position.set(-0.23, 0.06, -0.04);
    head.add(hoodL);
    const hoodR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.44), matShirt);
    hoodR.position.set(0.23, 0.06, -0.04);
    head.add(hoodR);
  } else if (colors.femaleHair) {
    // z = -0.04 para que la cara frontal del pelo no quede coplanar con la
    // frente (z-fighting: parpadeo tipo "TV sin señal")
    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.42), matHair);
    hairTop.position.set(0, 0.16, -0.04);
    head.add(hairTop);

    const ponytail = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.5, 8), matHair);
    ponytail.position.set(0, -0.05, -0.24);
    ponytail.rotation.x = -0.3;
    head.add(ponytail);
  } else {
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.42), matHair);
    hair.position.set(0, 0.16, -0.04);
    head.add(hair);

    if (colors.cap) {
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.2), matHair);
      visor.position.set(0, 0.1, 0.26);
      head.add(visor);
    }
  }

  // Accesorios de cabeza (combinables con cualquier peinado)
  if (colors.sunglasses) {
    // Anteojos de sol: banda oscura + patillas
    const glass = new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.25, metalness: 0.6 });
    const lensL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.02), glass);
    lensL.position.set(-0.1, 0.04, 0.21);
    head.add(lensL);
    const lensR = lensL.clone();
    lensR.position.x = 0.1;
    head.add(lensR);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.02), glass);
    bridge.position.set(0, 0.04, 0.215);
    head.add(bridge);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.14), glass);
    armL.position.set(-0.205, 0.04, 0.12);
    head.add(armL);
    const armR = armL.clone();
    armR.position.x = 0.205;
    head.add(armR);
  }
  if (colors.hat) {
    // Sombrero: copa + ala ancha
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x3a3025, roughness: 0.85 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.025, 14), hatMat);
    brim.position.set(0, 0.28, 0);
    head.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.17, 14), hatMat);
    crown.position.set(0, 0.37, 0);
    head.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.195, 0.04, 14), new THREE.MeshStandardMaterial({ color: 0x7d5a3c, roughness: 0.8 }));
    band.position.set(0, 0.325, 0);
    head.add(band);
  }
  if (colors.headCap) {
    // Gorra como accesorio (independiente del peinado "Gorra")
    const capMat = new THREE.MeshStandardMaterial({ color: colors.capColor || 0xb03a2e, roughness: 0.7 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
    dome.position.set(0, 0.14, -0.02);
    head.add(dome);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.18), capMat);
    visor.position.set(0, 0.16, 0.24);
    head.add(visor);
  }

  function createEye(pX) {
    const eye = new THREE.Group();
    eye.position.set(pX, 0.03, 0.195);
    const sclera = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.09), matWhite);
    const pupil = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.05), matEyes);
    pupil.position.z = 0.002;
    eye.add(sclera);
    eye.add(pupil);
    return eye;
  }
  head.add(createEye(-0.1));
  head.add(createEye(0.1));

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.08), matSkin);
  nose.position.set(0, -0.04, 0.22);
  head.add(nose);

  // Cejas articulables: le dan vida a la cara y expresan el estado de ánimo
  function createBrow(side) {
    const brow = new THREE.Group();
    brow.position.set(side * 0.07, 0.17, 0.18);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.028, 0.035), matHair);
    brow.add(mesh);
    return brow;
  }
  const browL = createBrow(-1);
  const browR = createBrow(1);
  head.add(browL);
  head.add(browR);

  // Boca delgada articulable (se deforma según la emoción)
  const matMouth = new THREE.MeshStandardMaterial({ color: 0x8a4b4b, roughness: 0.4 });
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.028, 0.02), matMouth);
  mouth.position.set(0, -0.1, 0.19);
  head.add(mouth);

  g.add(head);

  // 3. Arms
  function createArm(side) {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.38, 1.4, 0);

    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), matShirt);
    armPivot.add(shoulder);

    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.36, 10), matShirt);
    upperArm.position.y = -0.18;
    upperArm.castShadow = true;
    armPivot.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.36, 0);

    const foreArm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.32, 10), colors.hoodie ? matShirt : matSkin);
    foreArm.position.y = -0.16;
    foreArm.castShadow = true;
    elbow.add(foreArm);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.08), matSkin);
    hand.position.y = -0.34;
    hand.castShadow = true;
    elbow.add(hand);

    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.04), matSkin);
    thumb.position.set(-side * 0.05, -0.32, 0.04);
    elbow.add(thumb);

    armPivot.add(elbow);
    g.add(armPivot);
    return { pivot: armPivot, elbow };
  }

  const armL = createArm(-1);
  const armR = createArm(1);

  // 4. Legs
  function createLeg(side) {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.16, 0.72, 0);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.42, 10), matPants);
    thigh.position.y = -0.21;
    thigh.castShadow = true;
    legPivot.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.42, 0);

    const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.38, 10), matPants);
    calf.position.y = -0.19;
    calf.castShadow = true;
    knee.add(calf);

    const foot = new THREE.Group();
    foot.position.set(0, -0.38, 0.06);

    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.28), matShoes);
    upper.castShadow = true;
    foot.add(upper);

    knee.add(foot);
    legPivot.add(knee);
    g.add(legPivot);
    return { pivot: legPivot, knee, foot };
  }

  const legL = createLeg(-1);
  const legR = createLeg(1);

  // Objeto que el personaje puede AGARRAR/LLEVAR (ej. carpeta / caja). Oculto
  // salvo en la acción "hold"; los brazos se curvan alrededor al portearlo.
  const heldObject = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.14, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xb5893a, roughness: 0.65 })
  );
  heldObject.position.set(0, 0.98, 0.22);
  heldObject.visible = false;
  g.add(heldObject);

  // Escalera RECTA (~1.7 m, la altura de Alex) para llevar al hombro en
  // HORIZONTAL: dos largueros + 5 peldaños con huecos entre ellos. Se lleva
  // colgada del hombro pasando por uno de los huecos (como una escalera
  // larga de verdad); la mano la sujeta por el larguero. Oculta salvo en
  // las acciones de escalera; la real (stepLadder) se oculta mientras la
  // lleva y vuelve al piso al "soltarla".
  const heldLadder = new THREE.Group();
  const hlMat = new THREE.MeshStandardMaterial({ color: 0xb8bfc9, roughness: 0.35, metalness: 0.7 });
  const hlTreadMat = new THREE.MeshStandardMaterial({ color: 0x8d95a0, roughness: 0.5, metalness: 0.6 });
  const HL = 1.7;
  [1, -1].forEach(sx => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, HL, 0.06), hlMat);
    rail.position.set(sx * 0.20, 0, 0);
    rail.castShadow = true;
    heldLadder.add(rail);
  });
  [-0.6, -0.3, 0, 0.3, 0.6].forEach(sy => {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.035, 0.07), hlTreadMat);
    st.position.set(0, sy, 0);
    st.castShadow = true;
    heldLadder.add(st);
  });
  heldLadder.visible = false;
  g.add(heldLadder);

  if (opts.parent) opts.parent.add(g);
  else characterGroup.add(g);

  const parts = {
    h_root: g, h_torso: torso, h_head: head,
    h_browL: browL, h_browR: browR, h_mouth: mouth, h_held: heldObject,
    h_ladder: heldLadder,
    h_armL: armL.pivot, h_elbowL: armL.elbow,
    h_armR: armR.pivot, h_elbowR: armR.elbow,
    h_legL: legL.pivot, h_kneeL: legL.knee,
    h_legR: legR.pivot, h_kneeR: legR.knee
  };

  let currentAction = 'idle';

  function resetHumanPose() {
    // Restaurar la altura base (Y) del grupo raíz SIN pisar su X/Z: los
    // personajes g (estg.root === g) ya fueron posicionados por la escena
    // (applyProject) o el gizmo, y resetear X/Z a 0 los mandaría al origen
    // ("los tres personajes en el centro"). Solo la cuota vertical se
    // normaliza; el plano XZ se conserva.
    const rx = parts.h_root.position.x;
    const rz = parts.h_root.position.z;
    parts.h_root.position.set(rx, 0.17, rz);
    parts.h_torso.position.set(0, 1.1, 0);
    parts.h_torso.rotation.set(0, 0, 0);
    parts.h_head.position.set(0, 1.76, 0);
    parts.h_head.rotation.set(0, 0, 0);

    // Devolver expresión a postura neutra (se sobreescribe según el ánimo)
    if (parts.h_browL) {
      parts.h_browL.position.set(-0.07, 0.17, 0.18);
      parts.h_browL.rotation.set(0, 0, 0);
    }
    if (parts.h_browR) {
      parts.h_browR.position.set(0.07, 0.17, 0.18);
      parts.h_browR.rotation.set(0, 0, 0);
    }
    if (parts.h_mouth) {
      parts.h_mouth.position.set(0, -0.1, 0.19);
      parts.h_mouth.rotation.set(0, 0, 0);
      parts.h_mouth.scale.set(1, 1, 1);
    }
    if (parts.h_held) parts.h_held.visible = false;

    parts.h_armL.position.set(-0.38, 1.4, 0);
    parts.h_armL.rotation.set(0, 0, 0.08);
    parts.h_elbowL.rotation.set(-0.15, 0, 0);

    parts.h_armR.position.set(0.38, 1.4, 0);
    parts.h_armR.rotation.set(0, 0, -0.08);
    parts.h_elbowR.rotation.set(-0.15, 0, 0);

    parts.h_legL.position.set(-0.16, 0.72, 0);
    parts.h_legL.rotation.set(0, 0, 0);
    parts.h_kneeL.rotation.set(0, 0, 0);

    parts.h_legR.position.set(0.16, 0.72, 0);
    parts.h_legR.rotation.set(0, 0, 0);
    parts.h_kneeR.rotation.set(0, 0, 0);
  }

  // Al cambiar de acción, sincroniza la escalera (la mini en mano vs la real)
  function onLadderActionChange() {
    const a = rig.currentAction;
    const LADDER = ['grab_ladder', 'carry_ladder', 'drop_ladder',
      'shoulder_lift', 'shoulder_carry', 'shoulder_drop'];
    const isLadder = LADDER.includes(a);
    // Acciones que dejan la escalera en el piso (la mini desaparece y aparece
    // la real frente al personaje). Las de "hombro" también aplican.
    const onFloor = a === 'drop_ladder' || a === 'shoulder_drop';
    if (rig.id === 'human1') {
      if (onFloor) {
        // Dejar la escalera real en el piso, frente a Alex
        parts.h_ladder.visible = false;
        stepLadder.position.set(parts.h_root.position.x, 0, parts.h_root.position.z + 0.5);
        stepLadder.visible = true;
      } else if (isLadder) {
        parts.h_ladder.visible = true;   // la lleva: se ve la mini escalera
        stepLadder.visible = false;
      } else {
        parts.h_ladder.visible = false;
        stepLadder.visible = true;
      }
    } else {
      // Otros personajes: no mueven la escalera real, solo la mini visible
      parts.h_ladder.visible = isLadder && !onFloor;
    }
  }

  const animateHuman = (t) => {
    rig._now = t;
    resetHumanPose();

    // Gesto de un disparo en curso: se reproduce una vez con tiempo local y,
    // al terminar, cae a la acción base (que sigue intacta en currentAction).
    if (rig.gesture) {
      const def = GESTURE_DEFS[rig.gesture];
      const elapsed = t - rig.gestureStart;
      if (def && elapsed < def.duration) {
        def.animate(elapsed, parts);
        applyMood();
        applyRigBlend(rig, t);
        return;
      }
      rig.gesture = null; // terminado: continúa la acción base más abajo
    }

    if (rig.currentAction !== rig._prevAction) {
      onLadderActionChange();
      rig._prevAction = rig.currentAction;
    }

    // Postura de llevar la escalera colgada del hombro derecho EN HORIZONTAL
    // (como una escalera larga de verdad): el hombro pasa por un hueco entre
    // peldaños y la mano derecha sujeta el larguero. Vale para agarrarla
    // (phase null: piernas en estocada leve de esfuerzo) y para caminar con
    // ella (phase = fase de zancada: mismo torso y brazos, piernas caminando).
    function poseShoulderCarry(phase) {
      // Escalera horizontal sobre el hombro derecho, largo a lo largo del
      // cuerpo (punta adelante): el hombro queda en un hueco entre peldaños.
      parts.h_ladder.position.set(0.32, 1.40, 0.10);
      parts.h_ladder.rotation.set(1.5, 0.06, 0.04);

      // Leve inclinación hacia la carga + agachada mínima por el peso
      parts.h_torso.rotation.x = 0.08;
      parts.h_torso.rotation.z = -0.05;
      parts.h_torso.rotation.y = 0;
      parts.h_head.position.y = 1.74;
      parts.h_head.rotation.set(-0.06, 0, 0);

      // Mano derecha arriba sujetando el larguero junto al hombro
      parts.h_armR.position.set(0.40, 1.42, 0.05);
      parts.h_armR.rotation.set(-0.35, 0, 0.5);
      parts.h_elbowR.rotation.x = -1.15;
      // Brazo izquierdo suelto, apenas abierto para equilibrar
      parts.h_armL.position.set(-0.40, 1.38, 0.02);
      parts.h_armL.rotation.set(-0.15, 0, -0.25);
      parts.h_elbowL.rotation.x = -0.35;

      if (phase === null || phase === undefined) {
        // Agarrando: estocada leve (una pierna adelante flexionada)
        parts.h_torso.position.y = 1.04;
        parts.h_legL.rotation.x = 0.25;  parts.h_kneeL.rotation.x = -0.35;
        parts.h_legR.rotation.x = -0.15; parts.h_kneeR.rotation.x = -0.1;
      } else {
        // Caminando: ciclo de piernas del walk + rebote y balanceo suaves
        parts.h_torso.position.y = 1.08 + Math.abs(Math.sin(phase)) * 0.03;
        parts.h_legL.rotation.x = Math.sin(phase) * 0.45;
        parts.h_kneeL.rotation.x = Math.max(0, -Math.sin(phase) * 0.6);
        parts.h_legR.rotation.x = Math.sin(phase + Math.PI) * 0.45;
        parts.h_kneeR.rotation.x = Math.max(0, -Math.sin(phase + Math.PI) * 0.6);
        parts.h_armL.rotation.x += Math.sin(phase + Math.PI) * 0.06;
      }
    }

    if (rig.currentAction === 'idle') {
      parts.h_torso.position.y = 1.1 + Math.sin(t * 2.0) * 0.015;
      parts.h_head.position.y = 1.76 + Math.sin(t * 2.0) * 0.015;
      parts.h_head.rotation.y = Math.sin(t * 0.8) * 0.12;
      parts.h_armL.rotation.z = 0.08 + Math.sin(t * 2.0) * 0.02;
      parts.h_armR.rotation.z = -0.08 - Math.sin(t * 2.0) * 0.02;
      parts.h_elbowL.rotation.x = -0.15 + Math.sin(t * 2.0) * 0.03;
      parts.h_elbowR.rotation.x = -0.15 + Math.sin(t * 2.0) * 0.03;
    } else if (rig.currentAction === 'talk') {
      parts.h_head.rotation.x = Math.sin(t * 3.5) * 0.12 + 0.04;
      parts.h_head.rotation.y = Math.sin(t * 1.6) * 0.18;
      parts.h_torso.rotation.x = 0.05 + Math.sin(t * 2.0) * 0.03;
      parts.h_torso.rotation.y = Math.sin(t * 1.5) * 0.08;

      parts.h_armL.rotation.x = -0.4 + Math.sin(t * 3.0) * 0.25;
      parts.h_armL.rotation.z = 0.25 + Math.cos(t * 2.5) * 0.1;
      parts.h_elbowL.rotation.x = -0.9 + Math.cos(t * 3.0) * 0.35;

      parts.h_armR.rotation.x = -0.3 + Math.cos(t * 2.6) * 0.2;
      parts.h_armR.rotation.z = -0.2 - Math.sin(t * 2.0) * 0.1;
      parts.h_elbowR.rotation.x = -0.8 + Math.sin(t * 2.6) * 0.3;
    } else if (rig.currentAction === 'sit') {
      const seatH = 0.48;
      parts.h_legL.position.set(-0.16, seatH, 0);
      parts.h_legR.position.set(0.16, seatH, 0);
      parts.h_legL.rotation.x = -Math.PI / 2;
      parts.h_legR.rotation.x = -Math.PI / 2;
      parts.h_kneeL.rotation.x = Math.PI / 2;
      parts.h_kneeR.rotation.x = Math.PI / 2;

      parts.h_torso.position.y = seatH + 0.38 + Math.sin(t * 1.8) * 0.008;
      parts.h_head.position.y = seatH + 1.04 + Math.sin(t * 1.8) * 0.008;
      parts.h_head.rotation.y = Math.sin(t * 0.7) * 0.15;

      parts.h_armL.position.set(-0.38, seatH + 0.68, 0);
      parts.h_armR.position.set(0.38, seatH + 0.68, 0);
      parts.h_armL.rotation.set(-0.35, 0, 0.08);
      parts.h_elbowL.rotation.set(-0.75, 0, 0);
      parts.h_armR.rotation.set(-0.35, 0, -0.08);
      parts.h_elbowR.rotation.set(-0.75, 0, 0);
    } else if (rig.currentAction === 'sit_talk') {
      // HABLANDO SENTADO: piernas apoyadas como `sit`, pero las MANOS
      // gesticulan al ritmo del discurso y la cabeza acompaña — el personaje
      // no se para de la silla para hablar (el lip-sync corre igual, más
      // abajo, con las acciones de habla).
      const seatH = 0.48;
      parts.h_legL.position.set(-0.16, seatH, 0);
      parts.h_legR.position.set(0.16, seatH, 0);
      parts.h_legL.rotation.x = -Math.PI / 2;
      parts.h_legR.rotation.x = -Math.PI / 2;
      parts.h_kneeL.rotation.x = Math.PI / 2;
      parts.h_kneeR.rotation.x = Math.PI / 2;

      parts.h_torso.position.y = seatH + 0.38 + Math.sin(t * 1.8) * 0.01;
      parts.h_torso.rotation.x = 0.04 + Math.sin(t * 2.0) * 0.02;
      parts.h_torso.rotation.y = Math.sin(t * 1.5) * 0.05;
      parts.h_head.position.y = seatH + 1.04 + Math.sin(t * 1.8) * 0.01;
      parts.h_head.rotation.x = Math.sin(t * 3.5) * 0.1 + 0.03;
      parts.h_head.rotation.y = Math.sin(t * 1.6) * 0.15;

      parts.h_armL.position.set(-0.38, seatH + 0.68, 0);
      parts.h_armR.position.set(0.38, seatH + 0.68, 0);
      // Gesticular al ritmo del habla: antebrazos que suben/bajan y las
      // manos se abren/cierran acompañando el acento de las frases
      parts.h_armL.rotation.set(-0.4 + Math.sin(t * 3.0) * 0.18, 0, 0.14 + Math.sin(t * 2.2) * 0.06);
      parts.h_elbowL.rotation.set(-0.85 + Math.cos(t * 3.0) * 0.22, 0, 0);
      parts.h_armR.rotation.set(-0.4 + Math.cos(t * 2.6) * 0.16, 0, -0.14 - Math.sin(t * 2.0) * 0.06);
      parts.h_elbowR.rotation.set(-0.85 + Math.sin(t * 2.6) * 0.22, 0, 0);
    } else if (rig.currentAction === 'sit_typing') {
      const seatH = 0.48;
      parts.h_legL.position.set(-0.16, seatH, 0);
      parts.h_legR.position.set(0.16, seatH, 0);
      parts.h_legL.rotation.x = -Math.PI / 2;
      parts.h_legR.rotation.x = -Math.PI / 2;
      parts.h_kneeL.rotation.x = Math.PI / 2;
      parts.h_kneeR.rotation.x = Math.PI / 2;

      parts.h_torso.position.y = seatH + 0.38;
      parts.h_head.position.y = seatH + 1.04;
      parts.h_head.rotation.x = 0.22;
      parts.h_head.rotation.y = Math.sin(t * 1.2) * 0.05;

      parts.h_armL.position.set(-0.38, seatH + 0.68, 0);
      parts.h_armR.position.set(0.38, seatH + 0.68, 0);
      parts.h_armL.rotation.set(-0.55, 0, 0.15);
      parts.h_elbowL.rotation.set(-1.25 + Math.sin(t * 22) * 0.06, 0, 0);

      parts.h_armR.rotation.set(-0.55, 0, -0.15);
      parts.h_elbowR.rotation.set(-1.25 + Math.cos(t * 25) * 0.06, 0, 0);
    } else if (rig.currentAction === 'type_standing') {
      // Tecleando DE PIE: parado frente a una máquina/mesa alta, brazos al
      // frente tecleando y mirada levemente hacia abajo (hermana de
      // sit_typing, sin flexionar piernas).
      parts.h_head.rotation.x = 0.18;
      parts.h_head.rotation.y = Math.sin(t * 1.2) * 0.05;
      parts.h_torso.rotation.x = 0.08;

      parts.h_armL.position.set(-0.38, 1.06, 0);
      parts.h_armR.position.set(0.38, 1.06, 0);
      parts.h_armL.rotation.set(-0.55, 0, 0.15);
      parts.h_elbowL.rotation.set(-1.25 + Math.sin(t * 22) * 0.06, 0, 0);

      parts.h_armR.rotation.set(-0.55, 0, -0.15);
      parts.h_elbowR.rotation.set(-1.25 + Math.cos(t * 25) * 0.06, 0, 0);
    } else if (rig.currentAction === 'lay') {
      parts.h_torso.position.set(0, 0.16, 0);
      parts.h_torso.rotation.x = -Math.PI / 2;
      parts.h_head.position.set(0, 0.2, -0.66);
      parts.h_head.rotation.set(-Math.PI / 2 + 0.12, 0, Math.sin(t * 0.8) * 0.1);

      parts.h_legL.position.set(-0.18, 0.14, 0.4);
      parts.h_legL.rotation.set(-Math.PI / 2, 0, 0.1);
      parts.h_legR.position.set(0.18, 0.14, 0.4);
      parts.h_legR.rotation.set(-Math.PI / 2, 0, -0.1);

      parts.h_armL.position.set(-0.38, 0.14, -0.2);
      parts.h_armL.rotation.set(-Math.PI / 2, 0, 0.35 + Math.sin(t * 1.5) * 0.03);
      parts.h_armR.position.set(0.38, 0.14, -0.2);
      parts.h_armR.rotation.set(-Math.PI / 2, 0, -0.35 - Math.sin(t * 1.5) * 0.03);
    } else if (rig.currentAction === 'walk') {
      const phase = t * Math.PI * 2 * 1.5 * rig.cadence;
      parts.h_legL.rotation.x = Math.sin(phase) * 0.45;
      parts.h_kneeL.rotation.x = Math.max(0, -Math.sin(phase) * 0.6);
      parts.h_legR.rotation.x = Math.sin(phase + Math.PI) * 0.45;
      parts.h_kneeR.rotation.x = Math.max(0, -Math.sin(phase + Math.PI) * 0.6);

      parts.h_armL.rotation.x = Math.sin(phase + Math.PI) * 0.4;
      parts.h_elbowL.rotation.x = -0.35 - Math.max(0, -parts.h_armL.rotation.x) * 0.4;
      parts.h_armR.rotation.x = Math.sin(phase) * 0.4;
      parts.h_elbowR.rotation.x = -0.35 - Math.max(0, -parts.h_armR.rotation.x) * 0.4;

      parts.h_torso.rotation.x = 0.05;
      parts.h_torso.position.y = 1.1 + Math.abs(Math.sin(phase)) * 0.03;
    } else if (rig.currentAction === 'run') {
      const phase = t * Math.PI * 2 * 2.4 * rig.cadence;
      parts.h_legL.rotation.x = Math.sin(phase) * 0.75;
      parts.h_kneeL.rotation.x = Math.max(0, -Math.sin(phase) * 1.1);
      parts.h_legR.rotation.x = Math.sin(phase + Math.PI) * 0.75;
      parts.h_kneeR.rotation.x = Math.max(0, -Math.sin(phase + Math.PI) * 1.1);

      parts.h_armL.rotation.x = Math.sin(phase + Math.PI) * 0.7;
      parts.h_elbowL.rotation.x = -1.1 - Math.abs(Math.sin(phase)) * 0.3;
      parts.h_armR.rotation.x = Math.sin(phase) * 0.7;
      parts.h_elbowR.rotation.x = -1.1 - Math.abs(Math.sin(phase + Math.PI)) * 0.3;

      parts.h_torso.rotation.x = 0.18;
      parts.h_head.rotation.x = -0.08;
      parts.h_torso.position.y = 1.1 + Math.abs(Math.sin(phase)) * 0.08;
    } else if (rig.currentAction === 'wave') {
      // Saludar: brazo derecho en alto, mecerse, cabeza ligeramente girada
      parts.h_armR.rotation.set(-0.2, 0, -2.3 + Math.sin(t * 1.6) * 0.25);
      parts.h_elbowR.rotation.set(-0.35, 0, 0);
      parts.h_head.rotation.x = 0.03;
      parts.h_head.rotation.y = 0.25 + Math.sin(t * 1.3) * 0.1;
      parts.h_torso.rotation.x = 0.03;
      parts.h_torso.rotation.y = -0.2;
    } else if (rig.currentAction === 'clap') {
      // Aplaudir: ambas manos al frente, chocándose con ritmo
      const clapX = Math.abs(Math.sin(t * 3.2)) * 0.22;
      parts.h_armL.position.set(-0.18 - clapX, 1.26, 0.22);
      parts.h_armR.position.set(0.18 + clapX, 1.26, 0.22);
      parts.h_armL.rotation.x = -0.9;
      parts.h_armR.rotation.x = -0.9;
      parts.h_elbowL.rotation.x = -0.5;
      parts.h_elbowR.rotation.x = -0.5;
      parts.h_torso.rotation.x = 0.06;
    } else if (rig.currentAction === 'point') {
      // Señalar: brazo derecho extendido hacia adelante, cuerpo girado
      parts.h_armR.position.set(0.3, 1.36, 0.12);
      parts.h_armR.rotation.set(-1.35, 0.45, -0.12);
      parts.h_elbowR.rotation.set(-0.15, 0, 0);
      parts.h_armL.position.set(-0.42, 1.34, 0);
      parts.h_armL.rotation.z = 0.12;
      parts.h_elbowL.rotation.x = -0.2;
      parts.h_torso.rotation.y = 0.35;
      parts.h_torso.rotation.x = 0.04;
      parts.h_head.rotation.y = 0.35;
    } else if (rig.currentAction === 'hold') {
      // Llevar/agarrar un objeto: brazos al frente sostenido una caja
      parts.h_held.visible = true;
      parts.h_armL.position.set(-0.24, 1.08, 0.24);
      parts.h_armR.position.set(0.24, 1.08, 0.24);
      parts.h_armL.rotation.x = -0.5;
      parts.h_armR.rotation.x = -0.5;
      parts.h_armL.rotation.z = 0.14;
      parts.h_armR.rotation.z = -0.14;
      parts.h_elbowL.rotation.x = -0.9;
      parts.h_elbowR.rotation.x = -0.9;
      parts.h_torso.rotation.x = 0.02;
    } else if (rig.currentAction === 'grab_ladder' || rig.currentAction === 'shoulder_lift') {
      // AGARRAR la escalera y subirla al hombro: MISMA postura que caminando
      // con ella (la escalera en horizontal sobre el hombro derecho), pero con
      // las piernas en una estocada leve de esfuerzo en vez del ciclo de pasos.
      // (`grab_ladder` queda como alias de `shoulder_lift`.)
      poseShoulderCarry(null);
    } else if (rig.currentAction === 'carry_ladder' || rig.currentAction === 'shoulder_carry') {
      // CAMINAR llevando la escalera al hombro en horizontal: misma postura de
      // carga, con el ciclo de piernas del caminar (la zancada sigue la cadencia).
      poseShoulderCarry(t * Math.PI * 2 * 1.5 * rig.cadence);
    } else if (rig.currentAction === 'drop_ladder' || rig.currentAction === 'shoulder_drop') {
      // BAJAR la escalera del hombro y DEJARLA en el piso (la real aparece
      // frente a Alex vía onLadderActionChange; la mini desaparece).
      parts.h_torso.position.y = 0.78;
      parts.h_torso.rotation.x = 0.6;
      parts.h_head.position.y = 1.4;
      parts.h_head.rotation.x = 0.32;

      parts.h_legL.position.set(-0.16, 0.48, 0);
      parts.h_legL.rotation.x = 0.8; parts.h_kneeL.rotation.x = -1.3;
      parts.h_legR.position.set(0.16, 0.48, 0);
      parts.h_legR.rotation.x = 0.8; parts.h_kneeR.rotation.x = -1.3;

      parts.h_armL.position.set(-0.3, 0.5, 0.16);
      parts.h_armL.rotation.set(-1.3, 0, 0.12); parts.h_elbowL.rotation.x = -0.3;
      parts.h_armR.position.set(0.3, 0.5, 0.16);
      parts.h_armR.rotation.set(-1.3, 0, -0.12); parts.h_elbowR.rotation.x = -0.3;
    } else if (rig.currentAction === 'climb_ladder') {
      // Trepar: el cuerpo sube y baja mientras las piernas alternan y los
      // brazos se aferran arriba
      const ph = t * Math.PI * 2 * 1.2;
      parts.h_root.position.y = 0.17 + (0.5 + 0.5 * Math.sin(ph)) * 1.25;
      parts.h_torso.rotation.x = 0.1;
      parts.h_legL.rotation.x = Math.sin(ph) * 0.6 + 0.3;
      parts.h_kneeL.rotation.x = -Math.abs(Math.sin(ph)) * 0.8 - 0.4;
      parts.h_legR.rotation.x = Math.sin(ph + Math.PI) * 0.6 + 0.3;
      parts.h_kneeR.rotation.x = -Math.abs(Math.sin(ph + Math.PI)) * 0.8 - 0.4;
      parts.h_armL.position.set(-0.34, 1.5, 0.1);
      parts.h_armL.rotation.set(-2.4, 0, 0.1); parts.h_elbowL.rotation.x = -0.2;
      parts.h_armR.position.set(0.34, 1.5, 0.1);
      parts.h_armR.rotation.set(-2.4, 0, -0.1); parts.h_elbowR.rotation.x = -0.2;
    }
    applyMood();
    // LIP-SYNC (backlog #2): mientras habla (`talk` o `sit_talk`), la boca
    // se abre y cierra al ritmo del habla. Se aplica DESPUÉS de applyMood
    // (que fija la forma base de la boca) para que el habla se imponga.
    if ((rig.currentAction === 'talk' || rig.currentAction === 'sit_talk') && parts.h_mouth) {
      // Dos senos desfasados: el batido no queda metronómico (varía el "acento"
      // y a veces la boca queda un poco abierta entre sílabas).
      const flap = Math.abs(Math.sin(t * 9) * 0.75 + Math.sin(t * 23) * 0.25);
      const open = 1 + flap * 3.4;              // alto de la boca: 1x (cerrada) → ~4.4x
      parts.h_mouth.scale.y = open;
      parts.h_mouth.position.y = -0.1 - (open - 1) * 0.012; // baja un poco al abrirse
    }
    applyRigBlend(rig, t);
  };

  // Aplica el estado emocional a la cara (cejas y boca). Se llama cada frame
  // tras la pose, para que el cuerpo muestre el ánimo del personaje en vivo.
  const applyMood = () => {
    const mood = rig.mood || 'neutral';
    const browL = parts.h_browL, browR = parts.h_browR, mth = parts.h_mouth;
    if (!browL || !browR || !mth) return;

    // Valores base (neutral)
    let bLX = -0.07, bLY = 0.17, bLrz = 0;
    let bRX = 0.07,  bRY = 0.17, bRrz = 0;
    let mY = -0.1, mrz = 0, mSx = 1, mSy = 1;

    if (mood === 'happy') {
      bLrz = -0.24; bRrz = 0.24; mSx = 1.5; mSy = 0.55;
    } else if (mood === 'angry') {
      bLY = 0.145; bRY = 0.145; bLrz = -0.34; bRrz = 0.34;
      mSx = 0.7; mSy = 0.5; mY = -0.13; mrz = 0.12;
    } else if (mood === 'sad') {
      bLrz = 0.24; bRrz = -0.24; mSx = 0.62; mSy = 0.42; mY = -0.14; mrz = -0.4;
    } else if (mood === 'worried') {
      bLY = 0.2; bRY = 0.2; bLrz = -0.12; bRrz = 0.12; mSx = 0.85; mSy = 0.85; mY = -0.12;
    }

    browL.position.set(bLX, bLY, 0.18);
    browR.position.set(bRX, bRY, 0.18);
    browL.rotation.set(0, 0, bLrz);
    browR.rotation.set(0, 0, bRrz);
    mth.position.set(0, mY, 0.19);
    mth.rotation.set(0, 0, mrz);
    mth.scale.set(mSx, mSy, 1);
  };

  const rig = {
    root: g,
    parts,
    currentAction,
    // Cadencia de caminar/correr (1 = ritmo natural). La cinemática la ajusta
    // según la velocidad real en m/s para que las zancadas coincidan.
    cadence: 1,
    naturalWalk: 1.6,
    naturalRun: 4.5,
    // Altura mínima del grupo para que los pies apoyen en el piso (y=0)
    groundY: 0.17,
    setAction: (act) => {
      // Los gestos de un disparo se rutean a playGesture (se reproducen una vez
      // y vuelven solos a la acción base).
      if (typeof act === 'string' && act.startsWith('gesture:')) {
        rig.playGesture(act.slice('gesture:'.length));
        return;
      }
      rig.gesture = null; // una acción sostenida cancela cualquier gesto en curso
      if (rig.currentAction !== act) beginRigBlend(rig);
      rig.currentAction = act;
      rig.cadence = 1; // cadencia natural salvo que la cinemática la ajuste
      if (store.activeTarget === id) updateActionButtonsState(act);
      setStatus(`${name}: "${act}"`);
    },
    // Gestos de un disparo (one-shot): nombre del gesto en curso y tiempo de inicio.
    gesture: null,
    gestureStart: 0,
    _now: 0,
    playGesture: (gname) => {
      const def = GESTURE_DEFS[gname];
      if (!def) return;
      beginRigBlend(rig);
      rig.gesture = gname;
      rig.gestureStart = rig._now;
      setStatus(`${name}: ${def.label}`);
    },
    // Estado de ánimo (expresión facial): se aplica encima de la acción actual.
    mood: 'neutral',
    moodNames: { neutral: 'Neutral', happy: 'Contento', angry: 'Enojado', sad: 'Triste', worried: 'Preocupado' },
    id,
    _prevAction: 'idle',
    setMood: (m) => {
      if (!rig.moodNames[m]) m = 'neutral';
      rig.mood = m;
      if (store.activeTarget === id) updateMoodButtonsState(m);
      setStatus(`${name}: ${rig.moodNames[m]}`);
    },
    run: animateHuman
  };

  if (opts.register !== false) registerSelectable(id, name, g, 'human', rig);
  return rig;
}

// 1. Human 1: Alex (Casual) — espacio central, junto al escritorio 2
// ==========================================
// PERSONAJES POR DEFECTO (creación perezosa)
// ==========================================
// Ya NO se crean al importar el módulo: un proyecto nuevo arranca con la
// escena vacía y el panel de cinemáticas sin personajes. Se instancian al
// primer uso (restoreDefaultCharacters → cargar un proyecto viejo que los
// tenga visibles). Los nombres quedan como variables de módulo para no tocar
// el código de creación original.
let human1Rig, human2Rig, human3Rig, human4Rig, human5Rig,
    human6Rig, human7Rig, human8Rig, human9Rig, dogRig, catRig;
let defaultRigs = null;

function ensureDefaultCharacters() {
  if (defaultRigs) return defaultRigs;
human1Rig = createHumanoidModel('human1', 'Alex (Casual)', 2.7, 0.3, {
  shirt: 0x2e64d8, pants: 0x232733, hair: 0x2b1d14, shoes: 0xe84118, cap: true
});
human1Rig.root.rotation.y = -Math.PI / 2; // mira hacia el oeste (su escritorio)

// 2. Human 2: Carlos (Ejecutivo) — oficina del jefe, junto a su silla
human2Rig = createHumanoidModel('human2', 'Carlos (Ejecutivo)', -9.0, 6.4, {
  shirt: 0xf8f9fa, pants: 0x1a202c, hair: 0x111111, shoes: 0x1a1a1a, hasTie: true
});
human2Rig.root.rotation.y = Math.PI; // mira al norte, hacia sus monitores

// 3. Human 3: Elena (Gerente) — sala de juntas, frente a la mesa y la TV
human3Rig = createHumanoidModel('human3', 'Elena (Gerente)', 11.5, -5.2, {
  shirt: 0xe056fd, pants: 0x2f3640, hair: 0x833418, shoes: 0x111111, femaleHair: true
});
human3Rig.root.rotation.y = Math.PI; // mira al norte, hacia la mesa de juntas

// 4. Human 4: Mike (Hacker) — ciberdelincuente. Vive en la "casa del hacker"
// (afuera de la oficina). Sudadera negra con capucha.
human4Rig = createHumanoidModel('human4', 'Mike (Hacker)', 7.2, -26.8, {
  hoodie: true, shirt: 0x141414, pants: 0x1c2130, hair: 0x0a0a0a, shoes: 0x0a0a0a, skin: 0xe8b98a
});
human4Rig.root.rotation.y = Math.PI; // mira al norte, hacia su escritorio hacker

// 5. Human 5: Sofi (Diseño) — se sienta en la silla 1 (ancla, P4). Tipeando.
human5Rig = createHumanoidModel('human5', 'Sofi (Diseñadora)', (anchorPose('seat_chair1') || { x: -1.1, z: -1.7 }).x, (anchorPose('seat_chair1') || { x: -1.1, z: -1.7 }).z, {
  shirt: 0xff7f50, pants: 0x2f3640, hair: 0x8e44ad, shoes: 0xffffff, femaleHair: true
});
human5Rig.root.rotation.y = 0; // mira al sur, hacia su monitor
human5Rig.root.position.y = 0;  // sentada: el asiento queda a 0.48
human5Rig.currentAction = 'sit_typing';
human5Rig.mood = 'happy';

// 6. Human 6: Nico (Soporte IT) — se sienta en la silla 4 (ancla, P4).
const _s6 = anchorPose('seat_chair4') || { x: 1.1, z: 1.7 };
human6Rig = createHumanoidModel('human6', 'Nico (Soporte IT)', _s6.x, _s6.z, {
  shirt: 0x2980b9, pants: 0x232733, hair: 0x2c3e50, shoes: 0x111111, cap: true
});
human6Rig.root.rotation.y = Math.PI; // mira al norte, hacia su monitor
human6Rig.root.position.y = 0;
human6Rig.currentAction = 'sit_typing';
human6Rig.mood = 'neutral';

// 7. Human 7: Marta (Contabilidad) — se sienta en la silla E3 (ancla, P4).
const _s7 = anchorPose('seat_chairE3') || { x: 13.35, z: 2.65 };
human7Rig = createHumanoidModel('human7', 'Marta (Contabilidad)', _s7.x, _s7.z, {
  shirt: 0x95a5a6, pants: 0x34495e, hair: 0x6b4a2f, shoes: 0x2c2c2c, femaleHair: true
});
human7Rig.root.rotation.y = Math.PI; // mira al norte, hacia su monitor
human7Rig.root.position.y = 0;
human7Rig.currentAction = 'sit_typing';
human7Rig.mood = 'worried';

// 8. Human 8: Leo (Ventas) — se sienta en la silla N2 (ancla, P4).
const _s8 = anchorPose('seat_chairN2') || { x: -3.3, z: -8.5 };
human8Rig = createHumanoidModel('human8', 'Leo (Ventas)', _s8.x, _s8.z, {
  shirt: 0xe74c3c, pants: 0x1a202c, hair: 0x111111, shoes: 0x333333, hasTie: true
});
human8Rig.root.rotation.y = -Math.PI / 2; // mira al oeste, hacia su monitor
human8Rig.root.position.y = 0;
human8Rig.currentAction = 'sit_typing';
human8Rig.mood = 'happy';

// 9. Human 9: Valen (RR.HH.) — se sienta en la silla 6 (ancla, P4).
const _s9 = anchorPose('seat_chair6') || { x: -2.7, z: 1.6 };
human9Rig = createHumanoidModel('human9', 'Valen (RR.HH.)', _s9.x, _s9.z, {
  shirt: 0x27ae60, pants: 0x2c3e50, hair: 0x2b1d14, shoes: 0x111111, femaleHair: true
});
human9Rig.root.rotation.y = -Math.PI / 2; // mira al oeste, hacia su monitor
human9Rig.root.position.y = 0;
human9Rig.currentAction = 'sit_typing';
human9Rig.mood = 'neutral';

// --- DOG PRO ---
function buildDog(posX, posZ, opts = {}) {
  const { id = 'dog', name = 'Perro Pro', colors = {}, register = true, parent = null } = opts;
  const fur = colors.fur ?? 0xd98236;
  const patch = colors.patch ?? 0xffeedd;
  const collarColor = colors.collar ?? 0xd63031;
  const g = new THREE.Group();
  // +0.05: margen para que las patas no se hundan visualmente en el piso
  g.position.set(posX, 0.05, posZ);

  const matFur = new THREE.MeshStandardMaterial({ color: fur, roughness: 0.75 });
  const matWhiteFur = new THREE.MeshStandardMaterial({ color: patch, roughness: 0.7 });
  const matNose = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.2, metalness: 0.1 });
  const matCollar = new THREE.MeshStandardMaterial({ color: collarColor, roughness: 0.4 });
  const matEyes = new THREE.MeshBasicMaterial({ color: 0x111111 });

  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 0.65;

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.46, 0.55), matFur);
  chest.position.z = 0.15;
  chest.castShadow = true;
  bodyGroup.add(chest);

  const flank = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.4, 0.5), matFur);
  flank.position.z = -0.28;
  flank.castShadow = true;
  bodyGroup.add(flank);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.08, 14), matCollar);
  collar.rotation.x = Math.PI / 4;
  collar.position.set(0, 0.2, 0.45);
  bodyGroup.add(collar);

  g.add(bodyGroup);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.88, 0.65);

  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.4, 0.42), matFur);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.25), matWhiteFur);
  snout.position.set(0, -0.06, 0.28);
  headGroup.add(snout);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.08), matNose);
  nose.position.set(0, 0.02, 0.41);
  headGroup.add(nose);

  function createDogEye(xPos) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), matEyes);
    eye.position.set(xPos, 0.08, 0.18);
    return eye;
  }
  headGroup.add(createDogEye(0.15));
  headGroup.add(createDogEye(-0.15));

  function createEar(xPos, angle) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.24, 4), matFur);
    ear.position.set(xPos, 0.28, -0.05);
    ear.rotation.set(0, 0, angle);
    return ear;
  }
  headGroup.add(createEar(0.14, -0.2));
  headGroup.add(createEar(-0.14, 0.2));
  g.add(headGroup);

  function createDogLeg(posX, posZ) {
    const legPivot = new THREE.Group();
    legPivot.position.set(posX, 0.52, posZ);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.14), matFur);
    upper.position.y = -0.14;
    upper.castShadow = true;
    legPivot.add(upper);

    const lower = new THREE.Group();
    lower.position.y = -0.28;
    const lowerMesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.28, 0.11), matWhiteFur);
    lowerMesh.position.y = -0.12;
    lower.add(lowerMesh);

    legPivot.add(lower);
    g.add(legPivot);
    return { pivot: legPivot, lower };
  }

  const legFR = createDogLeg(0.17, 0.35);
  const legFL = createDogLeg(-0.17, 0.35);
  const legBR = createDogLeg(0.17, -0.35);
  const legBL = createDogLeg(-0.17, -0.35);

  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.18, -0.52);
  const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.24), matFur);
  t1.position.set(0, 0.06, -0.1);
  t1.rotation.x = Math.PI / 6;
  tailGroup.add(t1);
  bodyGroup.add(tailGroup);

  (parent || characterGroup).add(g);

  const parts = {
    d_root: g, d_body: bodyGroup, d_head: headGroup, d_tail: tailGroup,
    d_legFR: legFR.pivot, d_lowerFR: legFR.lower,
    d_legFL: legFL.pivot, d_lowerFL: legFL.lower,
    d_legBR: legBR.pivot, d_lowerBR: legBR.lower,
    d_legBL: legBL.pivot, d_lowerBL: legBL.lower
  };

  let currentAction = 'idle';

  function resetDogPose() {
    parts.d_body.position.set(0, 0.65, 0);
    parts.d_body.rotation.set(0, 0, 0);
    parts.d_head.position.set(0, 0.88, 0.65);
    parts.d_head.rotation.set(0, 0, 0);
    parts.d_tail.rotation.set(0, 0, 0);

    parts.d_legFR.position.set(0.17, 0.52, 0.35);
    parts.d_legFR.rotation.set(0, 0, 0);
    parts.d_lowerFR.rotation.set(0, 0, 0);

    parts.d_legFL.position.set(-0.17, 0.52, 0.35);
    parts.d_legFL.rotation.set(0, 0, 0);
    parts.d_lowerFL.rotation.set(0, 0, 0);

    parts.d_legBR.position.set(0.17, 0.52, -0.35);
    parts.d_legBR.rotation.set(0, 0, 0);
    parts.d_lowerBR.rotation.set(0, 0, 0);

    parts.d_legBL.position.set(-0.17, 0.52, -0.35);
    parts.d_legBL.rotation.set(0, 0, 0);
    parts.d_lowerBL.rotation.set(0, 0, 0);
  }

  const animateDog = (t) => {
    rig._now = t;
    resetDogPose();

    if (rig.currentAction === 'idle') {
      parts.d_tail.rotation.y = Math.sin(t * 3.0) * 0.35;
      parts.d_head.rotation.x = Math.sin(t * 1.5) * 0.05;
      parts.d_body.position.y = 0.65 + Math.sin(t * 2) * 0.01;
    } else if (rig.currentAction === 'sit') {
      parts.d_body.position.set(0, 0.44, -0.05);
      parts.d_body.rotation.x = -0.45;
      parts.d_head.position.set(0, 0.85, 0.45);
      parts.d_head.rotation.x = 0.35;

      parts.d_legFR.position.set(0.17, 0.52, 0.28);
      parts.d_legFL.position.set(-0.17, 0.52, 0.28);
      parts.d_legFR.rotation.x = 0.42;
      parts.d_legFL.rotation.x = 0.42;

      parts.d_legBR.position.set(0.2, 0.25, -0.32);
      parts.d_legBL.position.set(-0.2, 0.25, -0.32);
      parts.d_legBR.rotation.x = -1.2;
      parts.d_lowerBR.rotation.x = 1.3;
      parts.d_legBL.rotation.x = -1.2;
      parts.d_lowerBL.rotation.x = 1.3;

      parts.d_tail.rotation.x = 0.4;
      parts.d_tail.rotation.y = Math.sin(t * 6.0) * 0.45;
    } else if (rig.currentAction === 'lay') {
      parts.d_body.position.set(0, 0.26, 0);
      parts.d_head.position.set(0, 0.35, 0.62);
      parts.d_head.rotation.x = -0.08;

      parts.d_legFR.position.set(0.18, 0.14, 0.35);
      parts.d_legFL.position.set(-0.18, 0.14, 0.35);
      parts.d_legFR.rotation.set(-1.4, 0, 0.2);
      parts.d_legFL.rotation.set(-1.4, 0, -0.2);

      parts.d_legBR.position.set(0.2, 0.14, -0.3);
      parts.d_legBL.position.set(-0.2, 0.14, -0.3);
      parts.d_legBR.rotation.set(-1.4, 0, 0.3);
      parts.d_legBL.rotation.set(-1.4, 0, -0.3);

      parts.d_tail.rotation.x = 0.2;
      parts.d_tail.rotation.y = Math.sin(t * 2.0) * 0.25;
    } else if (rig.currentAction === 'walk') {
      const phase = t * Math.PI * 2 * 1.8 * rig.cadence;
      parts.d_legFR.rotation.x = Math.sin(phase) * 0.45;
      parts.d_lowerFR.rotation.x = Math.max(0, -Math.sin(phase) * 0.5);
      parts.d_legBL.rotation.x = Math.sin(phase) * 0.4;
      parts.d_lowerBL.rotation.x = Math.max(0, Math.sin(phase) * 0.45);

      parts.d_legFL.rotation.x = Math.sin(phase + Math.PI) * 0.45;
      parts.d_lowerFL.rotation.x = Math.max(0, -Math.sin(phase + Math.PI) * 0.5);
      parts.d_legBR.rotation.x = Math.sin(phase + Math.PI) * 0.4;
      parts.d_lowerBR.rotation.x = Math.max(0, Math.sin(phase + Math.PI) * 0.45);

      parts.d_tail.rotation.y = Math.sin(phase * 2) * 0.4;
      parts.d_body.position.y = 0.65 + Math.abs(Math.sin(phase)) * 0.03;
    } else if (rig.currentAction === 'run') {
      const phase = t * Math.PI * 2 * 2.6 * rig.cadence;
      parts.d_legFR.rotation.x = Math.sin(phase) * 0.7;
      parts.d_lowerFR.rotation.x = Math.max(0, -Math.sin(phase) * 0.8);
      parts.d_legBL.rotation.x = Math.sin(phase) * 0.65;
      parts.d_lowerBL.rotation.x = Math.max(0, Math.sin(phase) * 0.7);

      parts.d_legFL.rotation.x = Math.sin(phase + Math.PI) * 0.7;
      parts.d_lowerFL.rotation.x = Math.max(0, -Math.sin(phase + Math.PI) * 0.8);
      parts.d_legBR.rotation.x = Math.sin(phase + Math.PI) * 0.65;
      parts.d_lowerBR.rotation.x = Math.max(0, Math.sin(phase + Math.PI) * 0.7);

      parts.d_tail.rotation.y = Math.sin(phase * 2.2) * 0.5;
      parts.d_tail.rotation.x = 0.3 + Math.abs(Math.sin(phase)) * 0.2;
      parts.d_head.rotation.x = Math.sin(phase) * 0.1;
      parts.d_body.position.y = 0.65 + Math.abs(Math.sin(phase)) * 0.07;
    }
    applyRigBlend(rig, t);
  };

  const rig = {
    root: g,
    parts,
    currentAction,
    cadence: 1,
    naturalWalk: 2.4,
    naturalRun: 5.0,
    groundY: 0.05,
    setAction: (act) => {
      if (rig.currentAction !== act) beginRigBlend(rig);
      rig.currentAction = act;
      rig.cadence = 1; // cadencia natural salvo que la cinemática la ajuste
      if (store.activeTarget === id) updateActionButtonsState(act);
      setStatus(`${name}: "${act}"`);
    },
    run: animateDog
  };

  if (register) registerSelectable(id, name, g, 'pet', rig);
  return rig;
}

dogRig = buildDog(1.4, 3.3);
dogRig.root.rotation.y = Math.PI; // mira al sur, hacia la entrada

// --- CAT PRO ---
function buildCat(posX, posZ, opts = {}) {
  const { id = 'cat', name = 'Gato Pro', colors = {}, register = true, parent = null } = opts;
  const fur = colors.fur ?? 0xf5f6fa;
  const patch = colors.patch ?? 0xe67e22;
  const g = new THREE.Group();
  // +0.02: margen para que las patas no se hundan visualmente en el piso
  g.position.set(posX, 0.02, posZ);

  const matCatFur = new THREE.MeshStandardMaterial({ color: fur, roughness: 0.6 });
  const matCatGinger = new THREE.MeshStandardMaterial({ color: patch, roughness: 0.6 });
  const matNose = new THREE.MeshStandardMaterial({ color: 0xff9ff3 });
  const matEyes = new THREE.MeshBasicMaterial({ color: 0x2ecc71 });

  const body = new THREE.Group();
  body.position.y = 0.42;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.55), matCatFur);
  torso.castShadow = true;
  body.add(torso);

  const gingerPatch = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.16, 0.25), matCatGinger);
  gingerPatch.position.set(0, 0.08, -0.05);
  body.add(gingerPatch);

  g.add(body);

  const head = new THREE.Group();
  head.position.set(0, 0.62, 0.42);

  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.28), matCatFur);
  headMesh.castShadow = true;
  head.add(headMesh);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.1), matCatFur);
  snout.position.set(0, -0.05, 0.16);
  head.add(snout);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.04), matNose);
  nose.position.set(0, -0.01, 0.21);
  head.add(nose);

  function createCatEye(xPos) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 10), matEyes);
    eye.position.set(xPos, 0.05, 0.13);
    return eye;
  }
  head.add(createCatEye(0.09));
  head.add(createCatEye(-0.09));

  function createCatEar(xPos, rotZ) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 3), matCatGinger);
    ear.position.set(xPos, 0.2, -0.02);
    ear.rotation.set(0, 0, rotZ);
    return ear;
  }
  head.add(createCatEar(0.1, -0.2));
  head.add(createCatEar(-0.1, 0.2));
  g.add(head);

  function createCatLeg(posX, posZ) {
    const legPivot = new THREE.Group();
    legPivot.position.set(posX, 0.32, posZ);
    const limb = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.32, 0.09), matCatFur);
    limb.position.y = -0.16;
    limb.castShadow = true;
    legPivot.add(limb);
    g.add(legPivot);
    return { pivot: legPivot };
  }

  const legFR = createCatLeg(0.11, 0.22);
  const legFL = createCatLeg(-0.11, 0.22);
  const legBR = createCatLeg(0.11, -0.22);
  const legBL = createCatLeg(-0.11, -0.22);

  const tail = new THREE.Group();
  tail.position.set(0, 0.12, -0.3);
  const tMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8), matCatGinger);
  tMesh.position.set(0, 0.2, -0.1);
  tMesh.rotation.x = -Math.PI / 4;
  tail.add(tMesh);
  body.add(tail);

  (parent || characterGroup).add(g);

  const parts = {
    c_root: g, c_body: body, c_head: head, c_tail: tail,
    c_legFR: legFR.pivot, c_legFL: legFL.pivot,
    c_legBR: legBR.pivot, c_legBL: legBL.pivot
  };

  let currentAction = 'idle';

  function resetCatPose() {
    parts.c_body.position.set(0, 0.42, 0);
    parts.c_body.rotation.set(0, 0, 0);
    parts.c_head.position.set(0, 0.62, 0.42);
    parts.c_head.rotation.set(0, 0, 0);
    parts.c_tail.rotation.set(0, 0, 0);

    parts.c_legFR.position.set(0.11, 0.32, 0.22);
    parts.c_legFR.rotation.set(0, 0, 0);
    parts.c_legFL.position.set(-0.11, 0.32, 0.22);
    parts.c_legFL.rotation.set(0, 0, 0);
    parts.c_legBR.position.set(0.11, 0.32, -0.22);
    parts.c_legBR.rotation.set(0, 0, 0);
    parts.c_legBL.position.set(-0.11, 0.32, -0.22);
    parts.c_legBL.rotation.set(0, 0, 0);
  }

  const animateCat = (t) => {
    rig._now = t;
    resetCatPose();

    if (rig.currentAction === 'idle') {
      parts.c_tail.rotation.z = Math.sin(t * 2.5) * 0.25;
      parts.c_head.rotation.y = Math.sin(t * 1.0) * 0.15;
      parts.c_body.position.y = 0.42 + Math.sin(t * 2.0) * 0.008;
    } else if (rig.currentAction === 'sit') {
      parts.c_body.position.set(0, 0.28, -0.05);
      parts.c_body.rotation.x = -0.45;
      parts.c_head.position.set(0, 0.56, 0.28);
      parts.c_head.rotation.x = 0.3;

      parts.c_legFR.position.set(0.11, 0.32, 0.18);
      parts.c_legFL.position.set(-0.11, 0.32, 0.18);
      parts.c_legFR.rotation.x = 0.4;
      parts.c_legFL.rotation.x = 0.4;

      parts.c_legBR.position.set(0.13, 0.16, -0.2);
      parts.c_legBL.position.set(-0.13, 0.16, -0.2);
      parts.c_legBR.rotation.x = -1.2;
      parts.c_legBL.rotation.x = -1.2;

      parts.c_tail.rotation.x = 0.3;
      parts.c_tail.rotation.y = Math.sin(t * 3.0) * 0.35;
    } else if (rig.currentAction === 'lay') {
      parts.c_body.position.set(0, 0.16, 0);
      parts.c_head.position.set(0, 0.24, 0.38);
      parts.c_legFR.position.set(0.12, 0.08, 0.22);
      parts.c_legFL.position.set(-0.12, 0.08, 0.22);
      parts.c_legFR.rotation.x = -1.4;
      parts.c_legFL.rotation.x = -1.4;

      parts.c_legBR.position.set(0.12, 0.08, -0.2);
      parts.c_legBL.position.set(-0.12, 0.08, -0.2);
      parts.c_legBR.rotation.x = -1.4;
      parts.c_legBL.rotation.x = -1.4;

      parts.c_tail.rotation.x = 0.1;
      parts.c_tail.rotation.z = Math.sin(t * 1.5) * 0.2;
    } else if (rig.currentAction === 'walk') {
      const phase = t * Math.PI * 2 * 1.6 * rig.cadence;
      parts.c_legFR.rotation.x = Math.sin(phase) * 0.45;
      parts.c_legBL.rotation.x = Math.sin(phase) * 0.4;
      parts.c_legFL.rotation.x = Math.sin(phase + Math.PI) * 0.45;
      parts.c_legBR.rotation.x = Math.sin(phase + Math.PI) * 0.4;

      parts.c_tail.rotation.y = Math.sin(phase * 1.8) * 0.3;
      parts.c_body.position.y = 0.42 + Math.abs(Math.sin(phase)) * 0.02;
    } else if (rig.currentAction === 'run') {
      const phase = t * Math.PI * 2 * 2.4 * rig.cadence;
      parts.c_legFR.rotation.x = Math.sin(phase) * 0.7;
      parts.c_legBL.rotation.x = Math.sin(phase) * 0.65;
      parts.c_legFL.rotation.x = Math.sin(phase + Math.PI) * 0.7;
      parts.c_legBR.rotation.x = Math.sin(phase + Math.PI) * 0.65;

      parts.c_tail.rotation.y = Math.sin(phase * 2.0) * 0.4;
      parts.c_body.position.y = 0.42 + Math.abs(Math.sin(phase)) * 0.05;
    }
    applyRigBlend(rig, t);
  };

  const rig = {
    root: g,
    parts,
    currentAction,
    cadence: 1,
    naturalWalk: 2.2,
    naturalRun: 4.5,
    groundY: 0.02,
    setAction: (act) => {
      if (rig.currentAction !== act) beginRigBlend(rig);
      rig.currentAction = act;
      rig.cadence = 1; // cadencia natural salvo que la cinemática la ajuste
      if (store.activeTarget === id) updateActionButtonsState(act);
      setStatus(`${name}: "${act}"`);
    },
    run: animateCat
  };

  if (register) registerSelectable(id, name, g, 'pet', rig);
  return rig;
}

catRig = buildCat(-3.2, 3.4);
catRig.root.rotation.y = -Math.PI / 2; // mira hacia el oeste

// Constructores de mascotas para el creador: viven anidados acá (los
// defaults son perezosos) y se exponen para las mascotas personalizadas.
dogBuilder = buildDog;
catBuilder = buildCat;

  const RIG_OFFSETS = [
    [human1Rig, 0], [human2Rig, 1.2], [human3Rig, 2.4], [human4Rig, 3.6],
    [human5Rig, 4.8], [human6Rig, 6.0], [human7Rig, 7.2], [human8Rig, 8.4],
    [human9Rig, 9.6], [dogRig, 0], [catRig, 0.8]
  ];
  RIG_OFFSETS.forEach(([rig, offset]) => {
    registerTicker((_simDt, globalTime) => rig.run(globalTime + offset));
  });

  defaultRigs = [
    human1Rig, human2Rig, human3Rig, human4Rig, human5Rig,
    human6Rig, human7Rig, human8Rig, human9Rig, dogRig, catRig
  ];
  return defaultRigs;
}

let defaultCharactersHidden = false;
let customAnimOffset = 12;
// Constructores de mascotas (los define ensureDefaultCharacters al crear los
// defaults; las altas personalizadas los piden vía ensurePetBuilders).
let dogBuilder = null;
let catBuilder = null;

function ensurePetBuilders() {
  if (!dogBuilder || !catBuilder) {
    ensureDefaultCharacters();
    // Si el proyecto arranca vacío, los defaults recién creados quedan
    // ocultos como corresponde (solo se quería el constructor).
    setDefaultCharactersVisible(!defaultCharactersHidden);
  }
}

function setDefaultCharactersVisible(visible) {
  // Si nunca se crearon, no hay nada que mostrar/ocultar.
  if (!defaultRigs) return;
  defaultRigs.forEach(rig => {
    const id = rig.id || (rig.root && rig.root.userData ? rig.root.userData.id : null);
    const entry = interactiveRegistry.get(id);
    if (!entry) return;
    entry.deleted = !visible;
    rig.root.visible = visible;
  });
}

export function clearDefaultCharacters() {
  // Proyecto nuevo: SOLO marca el flag. No crea los personajes (escena vacía).
  defaultCharactersHidden = true;
  setDefaultCharactersVisible(false);
}

export function restoreDefaultCharacters() {
  // Restaurar SÍ crea los personajes si todavía no existen (proyectos viejos
  // guardados con los personajes por defecto visibles).
  defaultCharactersHidden = false;
  ensureDefaultCharacters();
  setDefaultCharactersVisible(true);
}

export function areDefaultCharactersHidden() {
  return defaultCharactersHidden;
}

export function createHumanPreview(id, name, colors, parent) {
  return createHumanoidModel(id, name, 0, 0, colors, { register: false, parent });
}

export function addHumanCharacter(id, name, x, z, rotY = 0, colors = {}) {
  const rig = createHumanoidModel(id, name, x, z, colors);
  rig.root.rotation.y = rotY;
  rig.root.userData.customCharacter = { name, colors, kind: 'human' };
  const offset = customAnimOffset;
  customAnimOffset += 1.3;
  registerTicker((_simDt, globalTime) => rig.run(globalTime + offset));
  return rig;
}

// 3 variantes de perro y 3 de gato para el creador (colores de pelaje).
export const DOG_VARIANTS = [
  { id: 'marron', label: '🐕 Marrón', colors: { fur: 0xd98236, patch: 0xffeedd, collar: 0xd63031 } },
  { id: 'negro', label: '🐕‍🦺 Negro', colors: { fur: 0x2d2a32, patch: 0x8f8a9a, collar: 0xf5c518 } },
  { id: 'blanco', label: '🐩 Blanco', colors: { fur: 0xf2ede4, patch: 0xd9c9a8, collar: 0x2e86d8 } }
];
export const CAT_VARIANTS = [
  { id: 'blanco', label: '🐈 Blanco', colors: { fur: 0xf5f6fa, patch: 0xe67e22 } },
  { id: 'negro', label: '🐈‍⬛ Negro', colors: { fur: 0x23232e, patch: 0x4a4a5e } },
  { id: 'gris', label: '🐈 Gris', colors: { fur: 0x8d99ae, patch: 0x4a5568 } }
];

function addCustomPetTicker(rig) {
  const offset = customAnimOffset;
  customAnimOffset += 1.3;
  registerTicker((_simDt, globalTime) => rig.run(globalTime + offset));
}

export function addDogCharacter(id, name, x, z, rotY = 0, colors = {}) {
  ensurePetBuilders();
  const rig = dogBuilder(x, z, { id, name, colors });
  rig.root.rotation.y = rotY;
  rig.root.userData.customCharacter = { name, colors, kind: 'pet', pet: 'dog' };
  addCustomPetTicker(rig);
  return rig;
}

export function addCatCharacter(id, name, x, z, rotY = 0, colors = {}) {
  ensurePetBuilders();
  const rig = catBuilder(x, z, { id, name, colors });
  rig.root.rotation.y = rotY;
  rig.root.userData.customCharacter = { name, colors, kind: 'pet', pet: 'cat' };
  addCustomPetTicker(rig);
  return rig;
}

export function createDogPreview(id, name, colors, parent) {
  ensurePetBuilders();
  return dogBuilder(0, 0, { id, name, colors, register: false, parent });
}

export function createCatPreview(id, name, colors, parent) {
  ensurePetBuilders();
  return catBuilder(0, 0, { id, name, colors, register: false, parent });
}

export function syncCustomCharacters(list = []) {
  const wanted = new Set(list.map(c => c.id));
  interactiveRegistry.forEach(entry => {
    if (entry.group.userData.customCharacter && !wanted.has(entry.id)) {
      entry.deleted = true;
      entry.group.visible = false;
    }
  });
  list.forEach(c => {
    const existing = interactiveRegistry.get(c.id);
    if (existing) {
      existing.deleted = false;
      existing.group.visible = true;
      if (Array.isArray(c.pos)) existing.group.position.set(c.pos[0], c.pos[1] ?? 0.17, c.pos[2]);
      if (c.rotY !== undefined) existing.group.rotation.y = c.rotY;
      return;
    }
    // Mascotas personalizadas (perro/gato del creador) vs humanos.
    const groundY = c.pet === 'dog' ? 0.05 : (c.pet === 'cat' ? 0.02 : 0.17);
    const add = c.pet === 'dog' ? addDogCharacter : (c.pet === 'cat' ? addCatCharacter : addHumanCharacter);
    const rig = add(c.id, c.name, 0, 0, c.rotY || 0, c.colors || {});
    if (Array.isArray(c.pos)) rig.root.position.set(c.pos[0], c.pos[1] ?? groundY, c.pos[2]);
  });
}

export function clearCustomCharacters() {
  syncCustomCharacters([]);
}

// ==========================================
// SENTARSE EN UN ASIENTO (ancla) CON ANIMACIÓN SUAVE
// ==========================================
// Coloca al personaje en el asiento registrado con nombre `seat_<ancla>`
// (ver js/characters/anchors.js): camina/gira hasta el asiento en ~0.8 s
// (easing) y queda sentado (acción `sit`) MIRANDO HACIA ADELANTE de la silla
// (el personaje gira 180° respecto de la silla: el respaldo queda a su espalda).
// Lo usan los eventos de waypoint `sit_at` (cinemáticas) y el menú contextual.
// opts.instant = true lo posiciona DIRECTO (sin animación): para posar la
// escena (que el personaje arranque sentado o se quede durante una toma).
// opts.spot = índice del lugar de asiento (0 por defecto; los sillones de 2
// cuerpos registran 2 spots con setSeatSpots).
// La animación corre por ticker propio y se auto-limpia al terminar.
export function sitAtAnchor(rig, anchorName, opts = {}) {
  const seats = anchorSeats(anchorName);
  if (!rig || seats.length === 0) return false;
  const spot = seats[Math.min(opts.spot || 0, seats.length - 1)];
  // Orientación: el personaje mira HACIA EL FRENTE de la silla. El respaldo
  // de las sillas está en local +z, así que el personaje debe apuntar al
  // lado opuesto: rotY de la silla + 180°.
  const facingRot = spot.rotY + Math.PI;
  // Altura de asiento REAL de esta silla (cada tipo tiene la suya):
  // 0.48 (comedor), 0.54 (gerencia), 0.5 (invitado), 0.44 (sillón), 0.47
  // (chesterfield). Así el personaje apoya en la tapa correcta — nunca se
  // hunde ni flota.
  const seatY = spot.seatY !== undefined ? spot.seatY : 0.48;
  const root = rig.root;

  if (opts.instant) {
    // Posicionamiento inmediato: pose exacta (x, z y altura real) + sentado.
    root.position.set(spot.x, seatY - 0.48, spot.z);
    root.rotation.y = facingRot;
    rig.setAction('sit');
    return true;
  }

  const startX = root.position.x, startZ = root.position.z;
  const startY = root.position.y;
  const startRot = root.rotation.y;
  // Rotación más corta hacia la de sentado
  let dRot = facingRot - startRot;
  while (dRot > Math.PI) dRot -= Math.PI * 2;
  while (dRot < -Math.PI) dRot += Math.PI * 2;
  // La altura final es la del asiento de ESTA silla (menos el 0.48 base de
  // la pose sit), así el descenso exacto se ve tan natural.
  const targetY = seatY - 0.48;
  const DUR = 0.8;
  let t = 0;
  const ease = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  const tick = (simDt) => {
    t = Math.min(1, t + simDt / DUR);
    const k = ease(t);
    root.position.x = startX + (spot.x - startX) * k;
    root.position.z = startZ + (spot.z - startZ) * k;
    root.position.y = startY + (targetY - startY) * k;
    root.rotation.y = startRot + dRot * k;
    // A mitad de camino empieza a "doblarse" (acción sit): la pose sit baja
    // el torso a la altura del asiento, así el descenso se lee como sentarse.
    if (t >= 0.5) rig.setAction('sit');
    if (t >= 1) {
      // Fijo la pose final exacta y suelto el ticker
      root.position.set(spot.x, targetY, spot.z);
      root.rotation.y = facingRot;
      rig.setAction('sit');
      const i = sitTickers.indexOf(tick);
      if (i >= 0) { sitTickers.splice(i, 1); unregisterTicker(tick); }
    }
  };
  sitTickers.push(tick);
  registerTicker(tick);
  return true;
}
const sitTickers = [];

// TICKERS: los personajes por defecto registran los suyos en ensureDefaultCharacters();
// los agregados por el editor, en addHumanCharacter().