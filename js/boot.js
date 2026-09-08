// js/boot.js — arranque diferido del editor (solo pop-up de inicio)
//
// index.html carga ESTE módulo en vez de main.js. Al abrir la página se ve
// ÚNICAMENTE el modal de arranque (nuevo / cargar proyecto); el editor, la
// vista 3D y el resto de los módulos recién se cargan (import dinámico de
// main.js) cuando el usuario elige una opción.
//
// Una vez cargado el editor, este módulo sigue atendiendo los botones del
// modal: la reapertura desde Archivo ▸ Nuevo… / 📄 (startup.js) reutiliza el
// mismo flujo (import ya resuelto = sin recargar nada).

import { byId, qs, qsa } from './dom.js';

const modal = byId('startupModal');
const suHome = byId('suHome');
const suNewForm = byId('suNewForm');
const suName = byId('suName');

// Estado elegido en el formulario (antes de que exista el editor)
let pendingEnv = 'office';

export function showBoot(mode = 'home') {
  if (!modal) return;
  if (suHome) suHome.style.display = mode === 'home' ? 'block' : 'none';
  if (suNewForm) suNewForm.style.display = mode === 'new' ? 'block' : 'none';
  // En el form de proyecto nuevo el branding pasa ABAJO (compacto): el logo
  // grande no compite con el formulario (class en el card lo acomoda por CSS).
  const card = modal.querySelector('.startup-card');
  if (card) card.classList.toggle('branding-bottom', mode === 'new');
  if (mode === 'new' && suName) {
    // Nombre SUGERIDO escrito (no placeholder): "proyecto_nuevo" queda como
    // texto real, SELECCIONADO — si querés otro nombre, escribí directo y lo
    // reemplaza (o borrás con Backspace).
    suName.value = 'proyecto_nuevo';
    suName.focus();
    suName.select();
  }
  modal.style.display = 'flex';
}

function hideBoot() {
  if (modal) modal.style.display = 'none';
  document.body.classList.remove('booting');
}

// Carga el editor completo (una sola vez) y luego continúa el flujo elegido.
// `pendingOpen` = { handle } o { file }: proyecto ya elegido ANTES de cargar.
async function loadEditor(after, pendingOpen = null) {
  const createBtn = byId('suCreate');
  const loadBtn = byId('suLoad');
  if (createBtn) { createBtn.disabled = true; createBtn.textContent = '⏳ Cargando editor…'; }
  if (loadBtn) loadBtn.disabled = true;
  try {
    // Primera carga: construye renderer, escena, personajes, UI y listeners.
    await import('./main.js');
    // Módulos ya evaluados: los imports dinámicos devuelven las mismas
    // instancias, así que podemos llamar sus funciones con seguridad.
    const { setEnvironment } = await import('./environment.js');
    const { newProject, openProjectHandle, openProject } = await import('./projectFiles.js');
    const { initUndo } = await import('./undo.js');

    if (after === 'create') {
      setEnvironment(pendingEnv);
      const name = (suName?.value || '').trim() || ('proyecto_' + new Date().toISOString().slice(0, 10));
      newProject(name);
      initUndo();          // historial fresco para el proyecto nuevo
    }
    hideBoot();
    // El canvas se dimensionó a 0×1 mientras estaba oculto por body.booting:
    // al mostrarlo, forzar el recálculo de resolución del renderer (core.js
    // escucha 'resize'). Se repite a los 100ms por si el layout aún asienta.
    window.dispatchEvent(new Event('resize'));
    setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
    if (after === 'open' && pendingOpen) {
      if (pendingOpen.handle) await openProjectHandle(pendingOpen.handle);
      else if (pendingOpen.file) openProject(pendingOpen.file);
    }
  } catch (err) {
    const errBox = byId('err');
    if (errBox) errBox.textContent = 'Error al cargar el editor: ' + (err?.message || err);
    console.error(err);
  } finally {
    if (createBtn) { createBtn.disabled = false; createBtn.textContent = '✔ Crear proyecto'; }
    if (loadBtn) loadBtn.disabled = false;
  }
}

// Elegir el archivo ANTES de cargar el editor (sin recurrir a nada del sistema,
// que todavía no está cargado). Devuelve { handle } o { file }, o null si el
// usuario canceló.
async function pickProjectFirst() {
  if (typeof window.showOpenFilePicker === 'function') {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Escena MiniStudio 3D', accept: { 'application/json': ['.json'] } }],
        multiple: false
      });
      return { handle };
    } catch (err) {
      return null; // canceló: seguimos en la pantalla inicial
    }
  }
  // Fallback (Firefox/Safari): input de archivo temporal.
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.remove();
      resolve(file ? { file } : null);
    });
    document.body.appendChild(input);
    input.click();
  });
}

// --- Botones del modal (activos antes y después de cargar el editor) ---
byId('suNew')?.addEventListener('click', () => showBoot('new'));
byId('suBack')?.addEventListener('click', () => showBoot('home'));

// Selector de escenario del formulario (pre-editor: solo marca el activo;
// una vez cargado el editor, viewport.js además aplica el ambiente en vivo).
qsa('.startup-envs .env-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    qsa('.startup-envs .env-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    pendingEnv = btn.getAttribute('data-env') || 'office';
  });
});

byId('suCreate')?.addEventListener('click', () => loadEditor('create'));

byId('suLoad')?.addEventListener('click', async () => {
  // Primero el archivo; recién si se elige uno se carga el editor y se abre.
  const pending = await pickProjectFirst();
  if (!pending) return; // canceló: no se carga nada
  loadEditor('open', pending);
});

// Al abrir la página: solo el pop-up de inicio (el body ya trae class="booting").
showBoot('home');
