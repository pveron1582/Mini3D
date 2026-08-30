// Loader de prueba: stubs de WebGL/DOM para poder evaluar el grafo de módulos
// de MiniStudio en Node y testear la lógica del catálogo (P7) sin navegador.
const fileUrl = (p) => 'file:///' + process.cwd().replace(/\\/g, '/') + '/' + p;

export async function resolve(specifier, context, next) {
  if (specifier === 'three') return next(fileUrl('vendor/three.module.js'), context);
  if (specifier.startsWith('three/addons/')) {
    return next(fileUrl('vendor/jsm/' + specifier.slice('three/addons/'.length)), context);
  }
  return next(specifier, context);
}

// Contexto 2D stub: cualquier método es un no-op, cualquier propiedad numérica devuelve 0
function makeCtx() {
  const gradient = { addColorStop: () => {} };
  return new Proxy({}, {
    get(t, p) {
      if (p === 'measureText') return () => ({ width: 10 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => gradient;
      if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (typeof p === 'string') return t[p] !== undefined ? t[p] : () => {};
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

function makeCanvas() {
  const listeners = {};
  return {
    width: 300, height: 150, clientWidth: 1280, clientHeight: 720,
    style: {}, classList: { add() {}, remove() {}, toggle() {} },
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    getContext: (kind) => (kind === '2d' ? makeCtx() : null),
    captureStream: () => ({ getVideoTracks: () => [{ stop() {} }] }),
    ownerDocument: null, // se completa en makeDocument
  };
}

function makeElement() {
  const el = makeCanvas();
  el.innerHTML = '';
  el.textContent = '';
  el.setAttribute = () => {};
  el.getAttribute = () => null;
  el.appendChild = () => {};
  el.removeChild = () => {};
  el.click = () => {};
  el.focus = () => {};
  el.disabled = false;
  el.value = '';
  return el;
}

function makeDocument() {
  const view = makeCanvas();
  const doc = {
    getElementById: (id) => (id === 'view' ? view : makeElement()),
    querySelectorAll: () => [],
    createElement: (tag) => makeCanvas(),
    addEventListener: () => {},
    removeEventListener: () => {},
    body: makeElement(),
    activeElement: null,
  };
  view.ownerDocument = doc;
  doc.ownerDocument = doc;
  return doc;
}

export async function load(url, context, next) {
  // Stub de WebGLRenderer/PMREMGenerator para poder importar core.js en Node
  if (url.endsWith('/js/core.js')) {
    const r = await next(url, context);
    let src = r.source;
    if (typeof src !== 'string') src = new TextDecoder().decode(src);
    src = src
      .replace('new THREE.WebGLRenderer(', 'new (globalThis.__makeStubRenderer())(')
      .replace(/new THREE\.PMREMGenerator\([^)]*\)/, 'new globalThis.__StubPMREM()');
    return { format: 'module', shortCircuit: true, source: src };
  }
  if (url.includes('/jsm/environments/RoomEnvironment.js')) {
    return { format: 'module', shortCircuit: true, source: 'export class RoomEnvironment {}' };
  }
  return next(url, context);
}
