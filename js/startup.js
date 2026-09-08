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
// Barra superior: 💾 guardar cambios · 📄 proyecto nuevo (pregunta si hay sin
// guardar) · ↩ deshacer · ↪ rehacer (estos dos ya existían en undo.js).

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

// 📄 Proyecto nuevo (barra) y Archivo ▸ Nuevo…: preguntan si guardar los
// cambios y vuelven a la pantalla principal de arranque (boot.js atiende el
// modal desde ahí: crear uno nuevo o cargar otro proyecto).
byId('btnNewBlank')?.addEventListener('click', async () => {
  await confirmSaveBeforeContinue();
  showStartup('home');
});

byId('mnuNew')?.addEventListener('click', async () => {
  // (Sin stopPropagation: el click debe burbujear para que el menú Archivo se
  // cierre solo — el cierre global vive en ui.js.)
  await confirmSaveBeforeContinue();
  showStartup('home');
});

// Atajo Ctrl+S para guardar rápido
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveProject();
  }
});
