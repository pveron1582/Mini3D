import * as THREE from 'three';
import { scene } from './core.js';
import { lampLights, lampMeshes } from './state.js';

// ==========================================
// PARK ENVIRONMENT
// ==========================================
export const parkGroup = new THREE.Group();
scene.add(parkGroup);
parkGroup.visible = false;

function buildPark() {
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x427532, roughness: 0.9 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(65, 65, 32, 32), grassMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  parkGroup.add(ground);

  const pathMat = new THREE.MeshStandardMaterial({ color: 0xd2b788, roughness: 0.85 });
  const path = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 45, 1, 30), pathMat);
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.001, 0);
  path.receiveShadow = true;
  parkGroup.add(path);

  function createTree(x, z, scale = 1, foliageHue = 0x2e8540) {
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    tree.scale.set(scale, scale, scale);

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 2.2, 7), trunkMat);
    trunk.position.y = 1.1;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    const leafMat = new THREE.MeshStandardMaterial({ color: foliageHue, roughness: 0.8 });
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.2, 7), leafMat);
    c1.position.y = 2.4;
    c1.castShadow = true;
    tree.add(c1);

    const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.8, 7), leafMat);
    c2.position.y = 3.3;
    c2.castShadow = true;
    tree.add(c2);

    const c3 = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.4, 7), leafMat);
    c3.position.y = 4.1;
    c3.castShadow = true;
    tree.add(c3);

    parkGroup.add(tree);
  }

  function createStreetLamp(x, z) {
    const lamp = new THREE.Group();
    lamp.position.set(x, 0, z);

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.4, metalness: 0.8 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 3.4, 8), metalMat);
    pole.position.y = 1.7;
    pole.castShadow = true;
    lamp.add(pole);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), metalMat);
    arm.position.set(-0.25, 3.4, 0);
    arm.castShadow = true;
    lamp.add(arm);

    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.14, 0.35, 6), metalMat);
    lantern.position.set(-0.55, 3.25, 0);
    lamp.add(lantern);

    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffe49e,
      emissive: 0xffaa22,
      emissiveIntensity: 1.5,
      roughness: 0.2
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), bulbMat);
    bulb.position.set(-0.55, 3.12, 0);
    lamp.add(bulb);
    lampMeshes.push(bulb);

    const pLight = new THREE.PointLight(0xffd57e, 0, 14, 1.4);
    pLight.position.set(-0.55, 3.0, 0);
    pLight.castShadow = true;
    lamp.add(pLight);
    lampLights.push(pLight);

    parkGroup.add(lamp);
  }

  function createBench(x, z, rotY = 0) {
    const bench = new THREE.Group();
    bench.position.set(x, 0, z);
    bench.rotation.y = rotY;

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a5229, roughness: 0.7 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1f2329, roughness: 0.5, metalness: 0.8 });

    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.6), metalMat);
    legL.position.set(-0.8, 0.27, 0);
    legL.castShadow = true;
    bench.add(legL);

    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.6), metalMat);
    legR.position.set(0.8, 0.27, 0);
    legR.castShadow = true;
    bench.add(legR);

    for (let i = -0.2; i <= 0.2; i += 0.12) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.04, 0.09), woodMat);
      slat.position.set(0, 0.5, i);
      slat.castShadow = true;
      bench.add(slat);
    }
    for (let i = 0.6; i <= 0.9; i += 0.12) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.09, 0.04), woodMat);
      slat.position.set(0, i, -0.25);
      slat.castShadow = true;
      bench.add(slat);
    }

    parkGroup.add(bench);
  }

  createTree(-4.5, -4, 1.2, 0x2e8540);
  createTree(-6.0, 3, 1.4, 0x3b9b4f);
  createTree(-3.5, 9, 1.0, 0x277437);
  createTree(4.5, -6, 1.3, 0x338f46);
  createTree(5.5, 2, 1.1, 0x256e34);
  createTree(4.0, 8, 1.4, 0x3d9e52);
  createTree(-8.0, -9, 1.6, 0x1f5c2b);

  createStreetLamp(-2.0, -3.5);
  createStreetLamp(2.0, 4.0);
  createStreetLamp(-2.0, 11.0);

  createBench(2.1, -1.5, -Math.PI / 2);
  createBench(-2.1, 6.0, Math.PI / 2);
}

buildPark();
