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
// `offset` (opcional): desplazamiento local [dx, dz] en el marco del mueble —
// lo usan los asientos múltiples (p.ej. un sillón de 2 cuerpos con un lugar a
// cada extremo: seat_<id> con [0,-0.5] y seat_<id> con [0,+0.5]).
export function anchorPose(name, offset) {
  const g = anchors.get(name);
  if (!g) return null;
  let x = g.position.x, z = g.position.z;
  if (offset) {
    const c = Math.cos(g.rotation.y), s = Math.sin(g.rotation.y);
    x += offset[0] * c + offset[1] * s;
    z += -offset[0] * s + offset[1] * c;
  }
  return { x, y: g.position.y, z, rotY: g.rotation.y };
}

// Asientos que ofrece una pieza: lista de poses { x, z, rotY } (mundo).
// Las sillas comunes tienen 1; los sillones de 2 cuerpos, 2 (un cuerpo
// cada uno). Se calcula desde las anclas registradas por la pieza.
export function anchorSeats(name) {
  const g = anchors.get(name);
  if (!g) return [];
  const seats = g.userData.seatSpots || [{ dx: 0, dz: 0 }];
  return seats.map(s => {
    const pose = anchorPose(name, [s.dx, s.dz]);
    return { x: pose.x, z: pose.z, rotY: pose.rotY };
  });
}

// Registra los lugares de asiento de una pieza multi-cuerpo.
// spots: [{ dx, dz }] en coordenadas LOCALES del mueble (x lateral, z profundo).
export function setSeatSpots(group, spots) {
  group.userData.seatSpots = spots;
}

// Solo para depuración / inspección.
export function listAnchorNames() {
  return [...anchors.keys()];
}