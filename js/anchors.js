// js/anchors.js — anclas nombradas de mobiliario (P4, ver mejoras_glm.md).
// Los objetos (sillas, escritorios) registran anclas con su posición+rotación;
// los personajes se colocan desde esas anclas en vez de números hardcodeados
// acoplados al layout. Así, si se mueve un mueble en el código, el personaje
// lo sigue sin tocar sus coordenadas a mano (el famoso "bug de sillas").
//
// La ancla es el propio THREE.Group del mueble: se lee su posición/rotación
// en el momento de colocar al personaje (luego del build del entorno).

const anchors = new Map();

export function registerAnchor(name, group) {
  anchors.set(name, group);
}

export function getAnchor(name) {
  return anchors.get(name);
}

// Devuelve { x, y, z, rotY } de la ancla, o null si no existe.
export function anchorPose(name) {
  const g = anchors.get(name);
  if (!g) return null;
  return { x: g.position.x, y: g.position.y, z: g.position.z, rotY: g.rotation.y };
}

// Solo para depuración / inspección.
export function listAnchorNames() {
  return [...anchors.keys()];
}