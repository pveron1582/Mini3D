import * as THREE from 'three';
import { scene } from './core.js';
import { registerSelectable } from './selection.js';
import { updateActionButtonsState } from './ui.js';
import { setStatus } from './recorder.js';
import { store } from './state.js';

// ==========================================
// 3D CHARACTERS (3 HUMANS, DOG, CAT)
// ==========================================
export const characterGroup = new THREE.Group();
scene.add(characterGroup);

// Universal Humanoid Rig Builder
function createHumanoidModel(id, name, posX, posZ, colors) {
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

  const waist = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.12, 0.3), matPants);
  waist.position.y = -0.38;
  torso.add(waist);
  g.add(torso);

  // 2. Head
  const head = new THREE.Group();
  head.position.y = 1.76;

  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.42, 0.38), matSkin);
  headMesh.castShadow = true;
  head.add(headMesh);

  // Hair style
  if (colors.femaleHair) {
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

    const foreArm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.32, 10), matSkin);
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

  characterGroup.add(g);

  const parts = {
    h_root: g, h_torso: torso, h_head: head,
    h_armL: armL.pivot, h_elbowL: armL.elbow,
    h_armR: armR.pivot, h_elbowR: armR.elbow,
    h_legL: legL.pivot, h_kneeL: legL.knee,
    h_legR: legR.pivot, h_kneeR: legR.knee
  };

  let currentAction = 'idle';

  function resetHumanPose() {
    parts.h_torso.position.set(0, 1.1, 0);
    parts.h_torso.rotation.set(0, 0, 0);
    parts.h_head.position.set(0, 1.76, 0);
    parts.h_head.rotation.set(0, 0, 0);

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

  const animateHuman = (t) => {
    resetHumanPose();

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
    }
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
      rig.currentAction = act;
      rig.cadence = 1; // cadencia natural salvo que la cinemática la ajuste
      if (store.activeTarget === id) updateActionButtonsState(act);
      setStatus(`${name}: "${act}"`);
    },
    run: animateHuman
  };

  registerSelectable(id, name, g, 'human', rig);
  return rig;
}

// 1. Human 1: Alex (Casual) — espacio central, junto al escritorio 2
export const human1Rig = createHumanoidModel('human1', 'Alex (Casual)', 2.7, 0.3, {
  shirt: 0x2e64d8, pants: 0x232733, hair: 0x2b1d14, shoes: 0xe84118, cap: true
});
human1Rig.root.rotation.y = -Math.PI / 2; // mira hacia el oeste (su escritorio)

// 2. Human 2: Carlos (Ejecutivo) — oficina del jefe, junto a su silla
export const human2Rig = createHumanoidModel('human2', 'Carlos (Ejecutivo)', -9.0, 6.4, {
  shirt: 0xf8f9fa, pants: 0x1a202c, hair: 0x111111, shoes: 0x1a1a1a, hasTie: true
});
human2Rig.root.rotation.y = Math.PI; // mira al norte, hacia sus monitores

// 3. Human 3: Elena (Gerente) — sala de juntas, frente a la mesa y la TV
export const human3Rig = createHumanoidModel('human3', 'Elena (Gerente)', 11.5, -5.2, {
  shirt: 0xe056fd, pants: 0x2f3640, hair: 0x833418, shoes: 0x111111, femaleHair: true
});
human3Rig.root.rotation.y = Math.PI; // mira al norte, hacia la mesa de juntas

// --- DOG PRO ---
function buildDog(posX, posZ) {
  const g = new THREE.Group();
  // +0.05: margen para que las patas no se hundan visualmente en el piso
  g.position.set(posX, 0.05, posZ);

  const matFur = new THREE.MeshStandardMaterial({ color: 0xd98236, roughness: 0.75 });
  const matWhiteFur = new THREE.MeshStandardMaterial({ color: 0xffeedd, roughness: 0.7 });
  const matNose = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.2, metalness: 0.1 });
  const matCollar = new THREE.MeshStandardMaterial({ color: 0xd63031, roughness: 0.4 });
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

  characterGroup.add(g);

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
      rig.currentAction = act;
      rig.cadence = 1; // cadencia natural salvo que la cinemática la ajuste
      if (store.activeTarget === 'dog') updateActionButtonsState(act);
      setStatus(`Perro: "${act}"`);
    },
    run: animateDog
  };

  registerSelectable('dog', 'Perro Pro', g, 'pet', rig);
  return rig;
}

export const dogRig = buildDog(1.4, 3.3);
dogRig.root.rotation.y = Math.PI; // mira al sur, hacia la entrada

// --- CAT PRO ---
function buildCat(posX, posZ) {
  const g = new THREE.Group();
  // +0.02: margen para que las patas no se hundan visualmente en el piso
  g.position.set(posX, 0.02, posZ);

  const matCatFur = new THREE.MeshStandardMaterial({ color: 0xf5f6fa, roughness: 0.6 });
  const matCatGinger = new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.6 });
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

  characterGroup.add(g);

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
      rig.currentAction = act;
      rig.cadence = 1; // cadencia natural salvo que la cinemática la ajuste
      if (store.activeTarget === 'cat') updateActionButtonsState(act);
      setStatus(`Gato: "${act}"`);
    },
    run: animateCat
  };

  registerSelectable('cat', 'Gato Pro', g, 'pet', rig);
  return rig;
}

export const catRig = buildCat(-3.2, 3.4);
catRig.root.rotation.y = -Math.PI / 2; // mira hacia el oeste
