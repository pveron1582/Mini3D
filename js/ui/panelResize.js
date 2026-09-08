// js/ui/panelResize.js — Paneles redimensionables (estilo apps de edición).
//
//   #tlResizeHandle: barra fina sobre el panel de la línea de tiempo
//   (#scene-timeline). Arrastrarla hacia arriba agranda el panel (se ven
//   todas las pistas); hacia abajo lo achica y aparece el scroll vertical
//   (.tl-body) para recorrer las pistas con la barra.
//
//   #leftResizeHandle: barra fina en el borde derecho del panel izquierdo
//   (#left-panel). Arrastrarla cambia su ancho; el contenido es responsive
//   (grillas que se reacomodan solas con auto-fill/minmax).
//
// Ambos recuerdan el tamaño elegido en localStorage.

// localStorage seguro: en Node (tests de carga) no existe; guardar en
// memoria para no romper el módulo.
const storage = (typeof localStorage !== 'undefined') ? localStorage : {
  _m: {},
  getItem(k) { return this._m[k] ?? null; },
  setItem(k, v) { this._m[k] = String(v); }
};

const TL_MIN = 120;    // alto mínimo del panel de timeline (px)
const TL_MAX_DIV = 0.72;  // tope: 72% de la altura de la ventana
const LP_MIN = 220;    // ancho mínimo del panel izquierdo (px)
const LP_MAX_DIV = 0.5;   // tope: 50% del ancho de la ventana

const tlHandle = document.getElementById('tlResizeHandle');
const tlPanel = document.getElementById('scene-timeline');
const lpHandle = document.getElementById('leftResizeHandle');
const lpPanel = document.getElementById('left-panel');

// ---------- Panel de la línea de tiempo (alto) ----------
let tlH = parseFloat(storage.getItem('tlPanelH')) || 0;
let tlDrag = null;

function tlApply() {
  if (!tlPanel) return;
  if (tlH > 0) {
    tlPanel.style.height = tlH + 'px';
    tlPanel.style.flex = 'none';
  }
  // El scroll lo maneja el CSS: .tl-body tiene flex:1 + overflow-y:auto —
  // scrollea solo cuando las pistas no entran en el alto elegido.
}

if (tlHandle && tlPanel) {
  if (tlH > 0) tlApply();
  tlHandle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    tlDrag = { startY: e.clientY, startH: tlPanel.getBoundingClientRect().height };
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  });
  window.addEventListener('pointermove', (e) => {
    if (!tlDrag) return;
    const maxH = Math.round(window.innerHeight * TL_MAX_DIV);
    let h = tlDrag.startH + (tlDrag.startY - e.clientY); // arriba del mouse = más alto
    h = Math.max(TL_MIN, Math.min(maxH, h));
    tlH = h;
    tlApply();
  });
  window.addEventListener('pointerup', () => {
    if (!tlDrag) return;
    tlDrag = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    storage.setItem('tlPanelH', String(Math.round(tlH)));
    // Recalcular posiciones de los bloques con el nuevo ancho/alto
    window.dispatchEvent(new Event('resize'));
  });
}

// ---------- Panel izquierdo (ancho) ----------
let lpW = parseFloat(storage.getItem('lpPanelW')) || 0;
let lpDrag = null;

function lpApply() {
  if (lpW > 0 && lpPanel) lpPanel.style.width = lpW + 'px';
}

if (lpHandle && lpPanel) {
  if (lpW > 0) lpApply();
  lpHandle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    lpDrag = { startX: e.clientX, startW: lpPanel.getBoundingClientRect().width };
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  });
  window.addEventListener('pointermove', (e) => {
    if (!lpDrag) return;
    const maxW = Math.round(window.innerWidth * LP_MAX_DIV);
    let w = lpDrag.startW + (e.clientX - lpDrag.startX); // derecha del mouse = más ancho
    w = Math.max(LP_MIN, Math.min(maxW, w));
    lpW = w;
    lpApply();
  });
  window.addEventListener('pointerup', () => {
    if (!lpDrag) return;
    lpDrag = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    storage.setItem('lpPanelW', String(Math.round(lpW)));
    window.dispatchEvent(new Event('resize'));
  });
}

// Reajustar el scroll del timeline cuando cambia el tamaño de la ventana
window.addEventListener('resize', () => { tlApply(); });
