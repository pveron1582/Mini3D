import { sessionDirty } from './state.js';
import { byId } from './dom.js';
import { getProjectName, saveProject } from './projectFiles.js';

// ==========================================
// ARRANQUE Y GESTIÓN DE PROYECTOS
// ==========================================
// El modal de arranque lo atiende js/boot.js: al abrir la página se muestra
// solo el pop-up y el editor recién se carga al elegir una opción. Este módulo
// (que va dentro de main.js) mantiene los accesos rápidos de la barra
// superior, el menú Archivo ▸ Nuevo… y la reapertura del modal.
//
// Barra superior: 💾 guardar cambios · ✖ cerrar proyecto · 📄 proyecto nuevo
// (pregunta si hay sin guardar) · ↩ deshacer · ↪ rehacer (estos dos ya
// existían en undo.js). Atajos: Ctrl+S guardar, Ctrl+N nuevo, Ctrl+Q cerrar.

const modal = byId('startupModal');
const suHome = byId('suHome');
const suNewForm = byId('suNewForm');
const suName = byId('suName');

export function showStartup(mode = 'home') {
  if (!modal) return;
  if (suHome) suHome.style.display = mode === 'home' ? 'block' : 'none';
  if (suNewForm) suNewForm.style.display = mode === 'new' ? 'block' : 'none';
  // Branding abajo cuando se llena el formulario (igual que en boot.js).
  const card = modal.querySelector('.startup-card');
  if (card) card.classList.toggle('branding-bottom', mode === 'new');
  if (mode === 'new' && suName) {
    // Nombre del proyecto actual si existe; si no, el sugerido por defecto.
    suName.value = getProjectName() || 'proyecto_nuevo';
    suName.focus();
    suName.select();
  }
  modal.style.display = 'flex';
}

// Pregunta "¿guardar los cambios?": Sí = guarda y continúa; No = continúa sin
// guardar. Si no hay cambios, continúa directamente.
async function confirmSaveBeforeContinue() {
  if (!sessionDirty.value) return;
  const save = window.confirm(
    'Hay cambios sin guardar en este proyecto.\n\n¿Guardarlos antes de continuar?'
  );
  if (save) await saveProject();
}

// --- Barra superior y menú Archivo ---
byId('btnSaveQuick')?.addEventListener('click', () => {
  saveProject();
});

// 📄 Proyecto nuevo (barra, menú o Ctrl+N): si hay cambios sin guardar
// pregunta si guardarlos; después va DIRECTO al formulario de proyecto nuevo
// (nombre + escenario). Para abrir uno existente está Abrir… (mnuOpen).
async function requestNewProject() {
  await confirmSaveBeforeContinue();
  showStartup('new');
}

// ✖ Cerrar proyecto (barra, menú o Ctrl+Q): si hay cambios sin guardar
// pregunta si guardarlos; después vuelve al menú inicial (nuevo o cargar).
async function closeProject() {
  await confirmSaveBeforeContinue();
  showStartup('home');
}

byId('btnNewBlank')?.addEventListener('click', () => {
  requestNewProject();
});

byId('mnuNew')?.addEventListener('click', () => {
  // (Sin stopPropagation: el click debe burbujear para que el menú Archivo se
  // cierre solo — el cierre global vive en ui.js.)
  requestNewProject();
});

byId('btnCloseProject')?.addEventListener('click', () => {
  closeProject();
});

byId('mnuClose')?.addEventListener('click', () => {
  // (Igual que mnuNew: el cierre del menú lo maneja el bubbling / projectFiles.js.)
  closeProject();
});

// Atajos de proyecto: Ctrl+S guardar, Ctrl+N nuevo, Ctrl+Q cerrar.
// (Nota: algunos navegadores reservan Ctrl+N / Ctrl+Q y no los entregan a la
// página; en ese caso usar el menú o los botones de la barra.)
document.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  if (k === 's') {
    e.preventDefault();
    saveProject();
  } else if (k === 'n') {
    e.preventDefault();
    requestNewProject();
  } else if (k === 'q') {
    e.preventDefault();
    closeProject();
  }
});
