// Load-order test: importa exactamente main.js (entry point del navegador) para
// forzar el orden real de evaluacion de módulos y destapar TDZ/ciclos.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const noop = () => {};
function makeCtx() {
  const grad = { addColorStop: noop };
  return new Proxy({}, {
    get: (t, p) => {
      if (p === 'measureText') return () => ({ width: 10 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => grad;
      return (t[p] !== undefined ? t[p] : () => {});
    },
    set: (t, p, v) => { t[p] = v; return true; }
  });
}
function makeCanvas() {
  return {
    width: 300, height: 150, clientWidth: 1280, clientHeight: 720,
    style: {}, classList: { add: noop, remove: noop, toggle: noop },
    addEventListener: noop, removeEventListener: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    getContext: () => makeCtx(),
    captureStream: () => ({ getVideoTracks: () => [{ stop() {} }] }),
    getRootNode() { return this.ownerDocument || globalThis.document; },
    ownerDocument: null,
  };
}
function makeElement() {
  const el = makeCanvas();
  el.innerHTML = ''; el.value = ''; el.disabled = false;
  el.setAttribute = noop; el.getAttribute = () => null;
  el.querySelectorAll = () => []; el.querySelector = () => makeElement();
  el.appendChild = noop; el.removeChild = noop; el.click = noop; el.focus = noop;
  return el;
}
globalThis.document = (() => {
  const view = makeCanvas();
  const doc = {
    getElementById: (id) => (id === 'view' ? view : makeElement()),
    querySelector: () => makeElement(), querySelectorAll: () => [],
    createElement: () => makeElement(),
    addEventListener: noop, removeEventListener: noop,
    body: makeElement(), activeElement: null, ownerDocument: null,
  };
  view.ownerDocument = doc;
  return doc;
})();
globalThis.window = { addEventListener: noop, removeEventListener: noop, showSaveFilePicker: undefined, prompt: () => null, location: { href: '' }, devicePixelRatio: 1 };
globalThis.requestAnimationFrame = noop;
globalThis.addEventListener = noop;
globalThis.FileReader = class { readAsText() {} };
globalThis.__makeStubRenderer = () => new Proxy(function () {}, {
  construct() {
    const t = { domElement: globalThis.document.getElementById('view'), shadowMap: {}, capabilities: { getMaxAnisotropy: () => 8 } };
    return new Proxy(t, { get: (o, p) => (p in o ? o[p] : () => {}), set: (o, p, v) => { o[p] = v; return true; } });
  }
});
globalThis.__StubPMREM = class { constructor() {} fromScene() { return { texture: null }; } dispose() {} };

register('./p7-loader.mjs', pathToFileURL('./tools/'));

const t0 = Date.now();
try {
  await import(pathToFileURL('./js/main.js'));
  console.log(`✅ main.js (orden real del navegador) cargó OK en ${Date.now() - t0} ms`);

  // Ejercitar el flujo "cargar/crear proyecto vacío" (aplicar JSON mínimo + nuevo)
  const { applyProject, newProject } = await import(pathToFileURL('./js/projectFiles.js'));
  applyProject({ app: 'MiniStudio 3D' });           // cargar un proyecto sin objetos
  newProject('prueba_vacio');                        // nuevo proyecto en blanco
  console.log('✅ applyProject({}) + newProject() sin errores (flujo proyecto vacío)');
  process.exit(0);
} catch (e) {
  console.error('❌ ERROR en flujo de carga/creación de proyecto vacío:');
  console.error(e.stack || e.message);
  process.exit(1);
}