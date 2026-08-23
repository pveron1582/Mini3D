import * as THREE from 'three';
import { scene } from './core.js';

// ==========================================
// LIGHTING & ENVIRONMENT SYSTEM
// ==========================================
export const hemiLight = new THREE.HemisphereLight(0xffffff, 0x222630, 0.7);
scene.add(hemiLight);

export const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
dirLight.position.set(8, 16, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 50;
dirLight.shadow.camera.left = -16;
dirLight.shadow.camera.right = 16;
dirLight.shadow.camera.top = 16;
dirLight.shadow.camera.bottom = -16;
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);

export const fillLight = new THREE.DirectionalLight(0x7090b0, 0.5);
fillLight.position.set(-8, 6, -8);
scene.add(fillLight);

// Studio Grid Group
export const studioGroup = new THREE.Group();
scene.add(studioGroup);

export const gridHelper = new THREE.GridHelper(30, 30, 0x4f5d75, 0x2b2e38);
gridHelper.position.y = -0.001;
studioGroup.add(gridHelper);

export const subGrid = new THREE.GridHelper(30, 150, 0x333842, 0x22252c);
subGrid.position.y = -0.002;
studioGroup.add(subGrid);

export const studioFloor = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.ShadowMaterial({ opacity: 0.3 })
);
studioFloor.rotation.x = -Math.PI / 2;
studioFloor.position.y = -0.003;
studioFloor.receiveShadow = true;
studioGroup.add(studioFloor);

// Colored Axis Lines
export const axesGroup = new THREE.Group();
studioGroup.add(axesGroup);

function createAxisLine(start, end, colorHex) {
  const geom = new THREE.BufferGeometry().setFromPoints([start, end]);
  const mat = new THREE.LineBasicMaterial({ color: colorHex, linewidth: 2 });
  return new THREE.Line(geom, mat);
}
axesGroup.add(createAxisLine(new THREE.Vector3(-15, 0, 0), new THREE.Vector3(15, 0, 0), 0xe04d4d)); // X
axesGroup.add(createAxisLine(new THREE.Vector3(0, 0, -15), new THREE.Vector3(0, 0, 15), 0x437ee8)); // Z
axesGroup.add(createAxisLine(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 4, 0), 0x48bb78));     // Y

// 3D Origin Cursor
function create3DCursor() {
  const cursor = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.2, 32),
    new THREE.MeshBasicMaterial({ color: 0xe04d4d, side: THREE.DoubleSide })
  );
  ring.rotation.x = Math.PI / 2;
  cursor.add(ring);
  const crosshairMat = new THREE.LineBasicMaterial({ color: 0xffffff });
  cursor.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.25, 0, 0), new THREE.Vector3(0.25, 0, 0)]), crosshairMat));
  cursor.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -0.25), new THREE.Vector3(0, 0, 0.25)]), crosshairMat));
  cursor.position.y = 0.005;
  return cursor;
}
export const cursor3D = create3DCursor();
studioGroup.add(cursor3D);
