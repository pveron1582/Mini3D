// js/media/audio.js — Pistas de audio por escena (música + efectos).
//
// Campo opcional `audio` del proyecto JSON: cada pista guarda su metadata
// (nombre, tipo, volumen, inicio, loop) y el audio embebido como dataURL, así
// el proyecto suena igual al abrirlo en otra PC. Los buffers decodificados
// viven SOLO en memoria (nunca en el JSON ni en el undo).
//
// Mezcla en una sola pasada (recomendada en mini3d_mejoras.md #3): al
// reproducir suena por WebAudio; al exportar, las pistas también entran a un
// MediaStreamAudioDestinationNode cuyo track se suma al stream del canvas —
// el WebM sale con video + audio sincronizados, sin post-proceso.
//
// Límite: archivos de hasta 20 MB (un dataURL más grande haría el JSON
// inmanejable); pasar de 10 MB avisa.

import { byId } from '../dom.js';
import { playback, sessionDirty, audioBus } from '../state.js';
import { pushHistory } from '../undo.js';

// Metadata serializable (chica: va al JSON y a los snapshots del undo).
export const audioTracks = []; // { id, name, kind: 'music'|'sfx', volume 0-100, start (s), loop }

// Audio real en memoria: id -> { dataURL, buffer (AudioBuffer|null) }.
const audioData = new Map();

let trackCounter = 0;
export function bumpAudioCounter(n) { trackCounter = Math.max(trackCounter, n); }

const MAX_BYTES = 20 * 1024 * 1024;
const WARN_BYTES = 10 * 1024 * 1024;

// ---------- Contexto WebAudio (perezoso: se crea con un gesto del usuario) ----------
let ctx = null;
let master = null;
let dest = null;
let live = []; // BufferSources sonando ahora

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    dest = ctx.createMediaStreamDestination();
  }
  return ctx;
}

// La grabadora (recorder.js) no importa este módulo (evita el ciclo
// recorder ↔ audio): pide los tracks por el bus de estado.
audioBus.getExportTracks = () => (dest ? dest.stream.getAudioTracks() : []);

// ---------- Pistas ----------
export function addAudioTrack(file) {
  if (!file) return;
  if (file.size > MAX_BYTES) {
    setStatusLazy(`"${file.name}" pesa ${(file.size / 1048576).toFixed(1)} MB: máximo 20 MB por pista.`);
    return;
  }
  if (file.size > WARN_BYTES) {
    setStatusLazy(`"${file.name}" pesa ${(file.size / 1048576).toFixed(1)} MB: el .json va a quedar grande.`);
  }
  const reader = new FileReader();
  reader.onload = () => {
    const dataURL = reader.result;
    const id = 'audio' + (++trackCounter);
    const kind = /music|musica|música|bgm|fondo/i.test(file.name) ? 'music' : 'sfx';
    audioTracks.push({
      id,
      name: file.name.replace(/\.[^.]+$/, ''),
      kind,
      volume: 80,
      start: 0,
      loop: kind === 'music'
    });
    audioData.set(id, { dataURL, buffer: null });
    decodeTrack(id);
    renderAudioList();
    pushHistory();
    setStatusLazy(`Audio "${file.name}" agregado${kind === 'music' ? ' (música, en loop)' : ''}.`);
  };
  reader.readAsDataURL(file);
}

async function decodeTrack(id) {
  const rec = audioData.get(id);
  if (!rec || rec.buffer || !rec.dataURL) return null;
  const c = ac();
  if (!c) return null;
  try {
    const res = await fetch(rec.dataURL);
    const buf = await res.arrayBuffer();
    rec.buffer = await c.decodeAudioData(buf);
  } catch (err) {
    setStatusLazy(`No se pudo decodificar el audio (${err?.message || err}).`);
    return null;
  }
  renderAudioList();
  return rec.buffer;
}

export function removeAudioTrack(id) {
  const i = audioTracks.findIndex(t => t.id === id);
  if (i < 0) return;
  audioStop();
  audioTracks.splice(i, 1);
  audioData.delete(id);
  renderAudioList();
  pushHistory();
}

// Reemplazar el archivo de una pista (revincular si falta el audio).
export function relinkAudioTrack(id, file) {
  const t = audioTracks.find(t => t.id === id);
  if (!t || !file) return;
  if (file.size > MAX_BYTES) {
    setStatusLazy(`"${file.name}" pesa demasiado: máximo 20 MB por pista.`);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    audioData.set(id, { dataURL: reader.result, buffer: null });
    decodeTrack(id);
    pushHistory();
    setStatusLazy(`Audio de "${t.name}" revinculado.`);
  };
  reader.readAsDataURL(file);
}

// ---------- Reproducción ----------
export async function audioPlay(fromT = 0) {
  audioStop();
  const c = ac();
  if (!c) return;
  try { await c.resume(); } catch (err) { /* sin gesto aún: queda mudo */ }
  const rate = (playback && playback.rate) || 1;
  const t0 = c.currentTime + 0.05;
  for (const t of audioTracks) {
    const rec = audioData.get(t.id);
    if (!rec || !rec.buffer) continue;
    const buf = rec.buffer;
    const startAt = Math.max(0, t.start || 0);
    // Efecto puntual ya pasado (sin loop): no suena.
    if (!t.loop && fromT >= startAt + buf.duration) continue;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = !!t.loop;
    try { src.playbackRate.value = rate; } catch (err) { /* rate fijo */ }
    const g = c.createGain();
    g.gain.value = Math.max(0, Math.min(100, t.volume ?? 80)) / 100;
    src.connect(g);
    g.connect(master);
    g.connect(dest);
    // El offset en el buffer equivale a segundos de escena (la tasa de
    // consumo se compensa con playbackRate): arrancar a mitad es exacto.
    const offset = fromT > startAt ? (fromT - startAt) % buf.duration : 0;
    try {
      src.start(t0 + Math.max(0, startAt - fromT) / rate, offset);
      live.push(src);
    } catch (err) { /* offset fuera de rango: no suena */ }
  }
}

export function audioStop() {
  live.forEach(src => { try { src.stop(); } catch (err) { /* ya terminada */ } });
  live = [];
}

// ---------- Persistencia (projectFiles.js) ----------
// Metadata (siempre, es chica) + dataURLs (solo al guardar el archivo).
export function serializeAudioTracks(includeData) {
  const tracks = audioTracks.map(t => ({
    id: t.id,
    name: t.name,
    kind: t.kind,
    volume: t.volume,
    start: t.start,
    loop: !!t.loop
  }));
  if (!includeData) return { tracks };
  const data = {};
  tracks.forEach(t => {
    const rec = audioData.get(t.id);
    if (rec && rec.dataURL) data[t.id] = rec.dataURL;
  });
  return Object.keys(data).length ? { tracks, data } : { tracks };
}

export function setAudioTracks(list) {
  audioStop();
  audioTracks.length = 0;
  (Array.isArray(list) ? list : []).forEach((t, i) => {
    audioTracks.push({
      id: t.id || ('audio' + (i + 1)),
      name: t.name || ('pista ' + (i + 1)),
      kind: t.kind === 'music' ? 'music' : 'sfx',
      volume: Math.max(0, Math.min(100, t.volume ?? 80)),
      start: Math.max(0, t.start || 0),
      loop: !!t.loop
    });
  });
  bumpAudioCounter(audioTracks.length);
  renderAudioList();
}

// Al abrir un proyecto con audio embebido: decodificar en segundo plano.
export async function loadAudioData(data) {
  if (!data) return;
  Object.keys(data).forEach(id => {
    if (audioTracks.some(t => t.id === id) && !audioData.has(id)) {
      audioData.set(id, { dataURL: data[id], buffer: null });
    }
  });
  for (const t of audioTracks) await decodeTrack(t.id);
}

export function clearAudio() {
  audioStop();
  audioTracks.length = 0;
  audioData.clear();
  renderAudioList();
}

export function hasAudio() {
  return audioTracks.length > 0 && audioTracks.some(t => audioData.get(t.id)?.buffer);
}

// ---------- UI (sección 🔊 Audio del panel) ----------
function setStatusLazy(s) {
  const el = byId('status');
  if (el) el.textContent = s;
}

export function renderAudioList() {
  const host = byId('audioList');
  if (!host) return;
  host.innerHTML = '';
  if (audioTracks.length === 0) {
    const p = document.createElement('p');
    p.className = 'cinema-hint';
    p.textContent = 'Sin audio: agregá música o efectos, suenan al reproducir y salen en el video exportado.';
    host.appendChild(p);
    return;
  }
  audioTracks.forEach(t => {
    const rec = audioData.get(t.id);
    const row = document.createElement('div');
    row.className = 'audio-row';
    row.style.cssText = 'display:flex; gap:4px; align-items:center; flex-wrap:wrap; margin-top:6px; padding:6px; border:1px solid var(--border-color); border-radius:6px;';

    const kindSel = document.createElement('select');
    kindSel.className = 'tl-input';
    kindSel.title = 'Tipo de pista';
    [['music', '🎵 Música'], ['sfx', '🔔 Efecto']].forEach(([v, label]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = label;
      kindSel.appendChild(o);
    });
    kindSel.value = t.kind;
    kindSel.addEventListener('change', () => { t.kind = kindSel.value; pushHistory(); });
    row.appendChild(kindSel);

    const name = document.createElement('span');
    name.style.cssText = 'flex:1; min-width:80px; font-size:11px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
    name.textContent = (rec && rec.buffer ? '🔊 ' : '🔇 ') + t.name;
    name.title = rec && rec.buffer ? t.name : t.name + ' (sin audio decodificado: revinculá el archivo)';
    row.appendChild(name);

    const vol = document.createElement('input');
    vol.type = 'range'; vol.min = '0'; vol.max = '100'; vol.value = String(t.volume);
    vol.style.cssText = 'flex:1; min-width:60px;';
    vol.title = `Volumen (${t.volume}%)`;
    vol.addEventListener('change', () => { t.volume = +vol.value; vol.title = `Volumen (${t.volume}%)`; pushHistory(); });
    row.appendChild(vol);

    const start = document.createElement('input');
    start.type = 'number'; start.min = '0'; start.step = '0.5'; start.value = String(t.start);
    start.className = 'tl-input';
    start.style.cssText = 'width:56px;';
    start.title = 'Suena desde el segundo…';
    start.addEventListener('change', () => { t.start = Math.max(0, +start.value || 0); pushHistory(); });
    row.appendChild(start);
    const sLab = document.createElement('span');
    sLab.style.cssText = 'font-size:10px; color:var(--text-muted);';
    sLab.textContent = 's';
    row.appendChild(sLab);

    const loopLab = document.createElement('label');
    loopLab.style.cssText = 'font-size:10px; display:flex; gap:2px; align-items:center;';
    loopLab.title = 'Repetir en loop';
    const loop = document.createElement('input');
    loop.type = 'checkbox'; loop.checked = !!t.loop;
    loop.addEventListener('change', () => { t.loop = loop.checked; pushHistory(); });
    loopLab.appendChild(loop);
    const loopIcon = document.createElement('span');
    loopIcon.textContent = '🔁';
    loopLab.appendChild(loopIcon);
    row.appendChild(loopLab);

    const relink = document.createElement('button');
    relink.className = 'blender-btn';
    relink.style.cssText = 'padding:2px 6px;';
    relink.textContent = '🔗';
    relink.title = 'Revincular archivo de audio';
    relink.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*';
      input.addEventListener('change', () => {
        if (input.files && input.files[0]) relinkAudioTrack(t.id, input.files[0]);
      });
      input.click();
    });
    row.appendChild(relink);

    const del = document.createElement('button');
    del.className = 'blender-btn';
    del.style.cssText = 'color:#ff7a7a; padding:2px 6px;';
    del.textContent = '🗑';
    del.title = `Quitar "${t.name}"`;
    del.addEventListener('click', () => removeAudioTrack(t.id));
    row.appendChild(del);

    host.appendChild(row);
  });
}

byId('btnAddAudio')?.addEventListener('click', () => {
  // El click es gesto de usuario: habilita el AudioContext desde ya.
  ac();
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'audio/*';
  input.addEventListener('change', () => {
    if (input.files && input.files[0]) addAudioTrack(input.files[0]);
  });
  input.click();
});
