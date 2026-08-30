import * as THREE from 'three';
import { byId, qs, qsa } from '../dom.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { controls } from '../core.js';
import { interactiveRegistry } from '../state.js';
import { createHumanPreview, addHumanCharacter } from './characters.js';
import { setActiveTarget } from '../ui/selection.js';
import { populateOutliner } from '../ui/ui.js';
import { pushHistory } from '../undo.js';
import { setStatus } from '../media/recorder.js';

const modal = byId('charCreatorModal');
const previewBox = byId('ccPreview');
const ccName = byId('ccName');
const ccSkin = byId('ccSkin');
const ccHairStyle = byId('ccHairStyle');
const ccHairColor = byId('ccHairColor');
const ccShirt = byId('ccShirt');
const ccPants = byId('ccPants');
const ccShoes = byId('ccShoes');
const ccTie = byId('ccTie');
const ccOutfit = byId('ccOutfit');
const ccSunglasses = byId('ccSunglasses');
const ccHat = byId('ccHat');
const ccCapAcc = byId('ccCap');
const ccGenderF = byId('ccGenderF');

// Nombres al azar por género (listas del sistema). El botón ?? elige otro.
const MALE_NAMES = ['Alejandro', 'Bruno', 'Carlos', 'Diego', 'Emiliano', 'Facundo', 'Gonzalo', 'Hernán', 'Ignacio', 'Javier', 'Lucas', 'Martín', 'Nicolás', 'Óscar', 'Pablo', 'Ramiro', 'Santiago', 'Tomás', 'Valentín', 'Mateo'];
const FEMALE_NAMES = ['Ana', 'Bianca', 'Camila', 'Daniela', 'Elena', 'Florencia', 'Guadalupe', 'Hilda', 'Isabel', 'Julia', 'Lucía', 'Marta', 'Natalia', 'Olga', 'Paula', 'Rocío', 'Silvana', 'Tamara', 'Valentina', 'Micaela'];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
// Nombre aleatorio acorde al género, evitando los ya usados en la escena
// (si los 20 están tomados, cae en uno cualquiera y la validación avisa).
function randomName() {
  const isF = ccGenderF && ccGenderF.checked;
  const pool = (isF ? FEMALE_NAMES : MALE_NAMES).filter(n => !isNameTaken(n));
  return pick(pool.length ? pool : (isF ? FEMALE_NAMES : MALE_NAMES));
}

// Presets por género: al elegir Mujer el modelo viene YA configurado con un
// look femenino claramente distinto al del hombre (pelo largo castaño, ropa
// de colores, zapatillas claras); el hombre arranca con el look por defecto.
// Todo sigue editable después.
const FEMALE_PRESET = {
  hairStyle: 'long', skin: '#f5cfae', hairColor: '#6b3d1f',
  outfit: 'casual', shirt: '#e056fd', pants: '#2f3640', shoes: '#d94f70'
};
const MALE_PRESET = {
  hairStyle: 'short', skin: '#ffd1a4', hairColor: '#2b1d14',
  outfit: 'casual', shirt: '#2e64d8', pants: '#232733', shoes: '#111111'
};
// El "por defecto" del creador es el preset masculino (hombre marcado).
const CREATOR_DEFAULTS = { gender: 'm', ...MALE_PRESET };

function applyPreset(preset) {
  if (ccHairStyle) ccHairStyle.value = preset.hairStyle;
  if (ccSkin) ccSkin.value = preset.skin;
  if (ccHairColor) ccHairColor.value = preset.hairColor;
  if (ccOutfit) { ccOutfit.value = preset.outfit; lastOutfit = preset.outfit; }
  if (ccShirt) ccShirt.value = preset.shirt;
  if (ccPants) ccPants.value = preset.pants;
  if (ccShoes) ccShoes.value = preset.shoes;
  [ccTie, ccSunglasses, ccHat, ccCapAcc].forEach(cb => { if (cb) cb.checked = false; });
}

function resetCreator() {
  if (byId('ccGenderM')) byId('ccGenderM').checked = true;
  if (ccGenderF) ccGenderF.checked = false;
  applyPreset(MALE_PRESET);
}

let renderer = null;
let scene = null;
let camera = null;
let orbit = null;
let rig = null;
let raf = 0;

function hex(input) {
  return parseInt((input.value || '#000000').slice(1), 16);
}

function readColors() {
  const style = ccHairStyle ? ccHairStyle.value : 'short';
  const outfit = ccOutfit ? ccOutfit.value : 'casual';
  // Paletas sugeridas por vestimenta (colores de oficina/limpieza/cocina);
  // el usuario las puede cambiar después con los color-pickers.
  const OUTFIT_COLORS = {
    casual: { shirt: '#2e64d8', pants: '#232733', shoes: '#111111' },
    office: { shirt: '#f8f9fa', pants: '#1a202c', shoes: '#1a1a1a' },
    cleaner: { shirt: '#4aa3df', pants: '#34495e', shoes: '#2c2c2c' },
    chef: { shirt: '#f2f2f2', pants: '#3a3a3a', shoes: '#111111' },
    overall: { shirt: '#e8b02a', pants: '#46506b', shoes: '#3b2d22' }
  };
  return {
    skin: hex(ccSkin),
    hair: hex(ccHairColor),
    shirt: hex(ccShirt),
    pants: hex(ccPants),
    shoes: hex(ccShoes),
    outfit,
    outfitHint: OUTFIT_COLORS[outfit] || OUTFIT_COLORS.casual,
    femaleHair: (ccGenderF && ccGenderF.checked) || style === 'long',
    cap: style === 'cap',
    hoodie: style === 'hoodie',
    hasTie: !!(ccTie && ccTie.checked),
    sunglasses: !!(ccSunglasses && ccSunglasses.checked),
    hat: !!(ccHat && ccHat.checked),
    headCap: !!(ccCapAcc && ccCapAcc.checked)
  };
}

// Aplica la paleta sugerida de la vestimenta a los color-pickers (sin pisar
// lo que el usuario ya eligió a mano: solo al CAMBIAR el select de outfit).
let lastOutfit = 'casual';
function applyOutfitPalette() {
  const outfit = ccOutfit ? ccOutfit.value : 'casual';
  if (outfit === lastOutfit) return;
  lastOutfit = outfit;
  const pal = readColors().outfitHint;
  if (ccShirt) ccShirt.value = pal.shirt;
  if (ccPants) ccPants.value = pal.pants;
  if (ccShoes) ccShoes.value = pal.shoes;
  // El traje de oficina pide corbata; el resto la apaga (editable igual).
  if (ccTie) ccTie.checked = (outfit === 'office');
}

function disposeObject(root) {
  root.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => m.dispose());
    }
  });
}

function initPreview() {
  if (renderer || !previewBox) return;
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(460, 420);
  renderer.setPixelRatio((typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  previewBox.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14171d);

  camera = new THREE.PerspectiveCamera(45, 460 / 420, 0.1, 100);
  camera.position.set(2.8, 1.8, 3.4);

  orbit = new OrbitControls(camera, renderer.domElement);
  orbit.target.set(0, 1.0, 0);
  orbit.enableDamping = true;

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const dir = new THREE.DirectionalLight(0xffffff, 1.25);
  dir.position.set(3, 5, 2);
  scene.add(dir);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(1.7, 32),
    new THREE.MeshStandardMaterial({ color: 0x232833, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const grid = new THREE.GridHelper(3.4, 10, 0x39404d, 0x2a303a);
  grid.position.y = 0.001;
  scene.add(grid);
}

function rebuildPreview() {
  if (!scene) return;
  if (rig) {
    scene.remove(rig.root);
    disposeObject(rig.root);
    rig = null;
  }
  rig = createHumanPreview('ccPreview', 'Vista previa', readColors(), scene);
}

function loop(t) {
  if (!modal || modal.style.display === 'none') return;
  if (orbit) orbit.update();
  if (rig) rig.run((t || 0) / 1000);
  if (renderer && scene && camera) renderer.render(scene, camera);
  raf = requestAnimationFrame(loop);
}

function stopLoop() {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
  raf = 0;
}

function openCreator() {
  if (!modal) return;
  initPreview();
  // Arranca SIEMPRE con los valores por defecto (no conserva el último
  // configurado) + nombre aleatorio masculino (hombre marcado por defecto).
  resetCreator();
  if (ccName) ccName.value = randomName();
  rebuildPreview();
  modal.style.display = 'flex';
  stopLoop();
  raf = requestAnimationFrame(loop);
}

function closeCreator() {
  if (!modal) return;
  modal.style.display = 'none';
  stopLoop();
}

function nextCustomId() {
  let n = 1;
  while (interactiveRegistry.has('customChar' + n)) n++;
  return 'customChar' + n;
}

byId('btnAddCharacter')?.addEventListener('click', openCreator);
// Cerrar el creador PREGUNTA si quiere abandonar sin crear (así no se pierde
// una configuración a medias por un click afuera). Cancelar sigue editando.
byId('ccCancel')?.addEventListener('click', () => {
  const ok = window.confirm('¿Abandonar la creación del personaje sin guardar los cambios?');
  if (ok) closeCreator();
});
// Click en el fondo del modal: misma confirmación (no cierra por accidente).
modal?.addEventListener('click', (e) => {
  if (e.target !== modal) return;
  const ok = window.confirm('¿Abandonar la creación del personaje sin guardar los cambios?');
  if (ok) closeCreator();
});
byId('ccNameDice')?.addEventListener('click', () => { if (ccName) ccName.value = randomName(); });

// Cambiar género: aplica el PRESET de ese género (la mujer llega con look
// femenino ya configurado: pelo largo, ropa de colores, zapatillas claras),
// regenera el nombre acorde y refresca la vista previa. Todo editable.
[byId('ccGenderM'), ccGenderF].forEach(r => {
  r?.addEventListener('change', () => {
    const female = !!(ccGenderF && ccGenderF.checked);
    applyPreset(female ? FEMALE_PRESET : MALE_PRESET);
    if (ccName) ccName.value = randomName();
    rebuildPreview();
  });
});

// Cambiar de vestimenta aplica su paleta sugerida y refresca la vista previa.
[ccOutfit, ccSunglasses, ccHat, ccCapAcc, ccTie].forEach(el => {
  if (el) el.addEventListener('change', () => { applyOutfitPalette(); rebuildPreview(); });
});
[ccName, ccSkin, ccHairStyle, ccHairColor, ccShirt, ccPants, ccShoes].forEach(el => {
  if (el) el.addEventListener('input', rebuildPreview);
});

// ¿Ya existe un personaje/objeto con ese nombre en la escena? (los nombres
// son la etiqueta visible: no pueden repetirse para no confundir dos piezas).
function isNameTaken(name) {
  let taken = false;
  interactiveRegistry.forEach(entry => {
    if (entry.deleted) return;
    if ((entry.name || '').trim().toLowerCase() === name.toLowerCase()) taken = true;
  });
  return taken;
}

byId('ccAccept')?.addEventListener('click', () => {
  // La paleta sugerida no se serializa: solo los flags/colores finales.
  const { outfitHint, ...colors } = readColors(); // eslint-disable-line no-unused-vars
  let name = (ccName && ccName.value || '').trim();
  const id = nextCustomId();
  if (!name) name = 'Personaje ' + id.replace('customChar', '');
  // Nombre único: si ya existe en la escena, se pide otro (no se crea nada).
  if (isNameTaken(name)) {
    setStatus(`Ya existe "${name}" en la escena: elegí otro nombre.`);
    if (ccName) {
      ccName.focus();
      ccName.select();
    }
    return;
  }
  const t = controls.target;
  const x = Math.round(t.x * 2) / 2;
  const z = Math.round(t.z * 2) / 2;
  addHumanCharacter(id, name, x, z, 0, colors);
  populateOutliner();
  setActiveTarget(id);
  pushHistory();
  setStatus(`Personaje "${name}" agregado.`);
  // Crear ? reiniciar el formulario a los valores por defecto (queda listo
  // para el próximo personaje, sin arrastrar la config recién usada).
  resetCreator();
  closeCreator();
});