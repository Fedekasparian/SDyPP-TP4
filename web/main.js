'use strict';
/*
 * TP4 Shader Harness: ejecuta los .glsl de ShaderToy (firma mainImage) con WebGL2.
 *  - Loader:    fetch del .glsl + prólogo de uniforms + main() que llama a mainImage.
 *  - Renderer:  quad a pantalla completa; el fragment shader corre una vez por píxel.
 *  - Canales:   iChannel0/1 desde imagen de prueba, webcam o archivo local.
 */

// ---------------------------------------------------------------------------
// Catálogo de Hits
// ---------------------------------------------------------------------------
const HITS = [
  { id: 'hit1',        file: '../hit1/hello_world.glsl',      channels: [],     threshold: false,
    label: 'Hit 1 · Hello world',            desc: 'Shader de ejemplo de ShaderToy: color animado con iTime, sin texturas.' },
  { id: 'hit3',        file: '../hit3/passthrough.glsl',      channels: [0],    threshold: false,
    label: 'Hit 3 · Passthrough',            desc: 'Copia iChannel0 a la salida, píxel por píxel.' },
  { id: 'hit4-y',      file: '../hit4/flip_y.glsl',           channels: [0],    threshold: false,
    label: 'Hit 4 · FLIP-Y',                 desc: 'Imagen cabeza abajo: v pasa a ser 1 - v.' },
  { id: 'hit4-x',      file: '../hit4/flip_x.glsl',           channels: [0],    threshold: false,
    label: 'Hit 4 · FLIP-X (espejo)',        desc: 'Espejo horizontal: u pasa a ser 1 - u.' },
  { id: 'hit4-xy',     file: '../hit4/flip_xy.glsl',          channels: [0],    threshold: false,
    label: 'Hit 4 · FLIP-X + FLIP-Y',        desc: 'Ambos flips, equivale a rotar 180°: uv pasa a ser 1 - uv.' },
  { id: 'hit5',        file: '../hit5/chroma.glsl',           channels: [0, 1], threshold: true,
    label: 'Hit 5 · Chroma key',             desc: 'Donde iChannel1 se parece al verde (distancia < umbral) se muestra iChannel0.' },
  { id: 'hit6',        file: '../hit6/grayscale.glsl',        channels: [0],    threshold: false,
    label: 'Hit 6 · Escala de grises',       desc: 'Luminancia Rec. 709 sobre valores lineales: Y = 0.2126R + 0.7152G + 0.0722B.' },
  { id: 'hit6-chroma', file: '../hit6/chroma_grayscale.glsl', channels: [0, 1], threshold: true,
    label: 'Hit 6 · Chroma + grises',        desc: 'Chroma del Hit 5 y luego escala de grises sobre el resultado.' },
];

// ---------------------------------------------------------------------------
// Wrapper GLSL: emula los uniforms de ShaderToy
// ---------------------------------------------------------------------------
const PROLOGUE = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform vec3      iResolution;
uniform float     iTime;
uniform float     iTimeDelta;
uniform float     iFrameRate;
uniform int       iFrame;
uniform vec4      iMouse;
uniform vec4      iDate;
uniform float     iChannelTime[4];
uniform vec3      iChannelResolution[4];
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
out vec4 st_outColor;
`;
const EPILOGUE = `
void main() {
    vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
    mainImage(color, gl_FragCoord.xy);
    st_outColor = color;
}
`;
const PROLOGUE_LINES = PROLOGUE.split('\n').length - 1;

const VERTEX_SRC = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const errorBox = $('error');
const hitSelect = $('hit');
const thresholdInput = $('threshold');
const fileInput = $('file');

// ---------------------------------------------------------------------------
// WebGL2
// ---------------------------------------------------------------------------
const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
if (!gl) {
  showError('Este navegador no soporta WebGL2.');
  throw new Error('WebGL2 no disponible');
}

// Quad a pantalla completa: 2 triángulos = 6 vértices (paso 1 del pipeline, trivial).
const quad = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quad);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
  -1, -1,  1, -1,  -1, 1,
  -1,  1,  1, -1,   1, 1,
]), gl.STATIC_DRAW);

const vertexShader = compile(gl.VERTEX_SHADER, VERTEX_SRC);

function compile(type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) || 'error desconocido';
    gl.deleteShader(sh);
    throw new Error(log);
  }
  return sh;
}

// Ajusta los números de línea del log para que coincidan con el .glsl original.
function remapLog(log) {
  return log.replace(/(ERROR: \d+:)(\d+)/g, (_, pre, n) => `${pre}${Math.max(1, Number(n) - PROLOGUE_LINES)}`);
}

function buildProgram(userSrc) {
  let fs;
  try {
    fs = compile(gl.FRAGMENT_SHADER, PROLOGUE + userSrc + EPILOGUE);
  } catch (e) {
    throw new Error(remapLog(e.message));
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, vertexShader);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(log);
  }
  const u = (name) => gl.getUniformLocation(prog, name);
  return {
    prog,
    aPos: gl.getAttribLocation(prog, 'aPos'),
    loc: {
      iResolution: u('iResolution'), iTime: u('iTime'), iTimeDelta: u('iTimeDelta'),
      iFrameRate: u('iFrameRate'), iFrame: u('iFrame'), iMouse: u('iMouse'), iDate: u('iDate'),
      iChannelTime: u('iChannelTime'), iChannelResolution: u('iChannelResolution'),
      iChannel0: u('iChannel0'), iChannel1: u('iChannel1'),
    },
  };
}

// ---------------------------------------------------------------------------
// Canales (texturas)
// ---------------------------------------------------------------------------
function makeChannel(unit) {
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // source: elemento que alimenta la textura; tick: redibuja fuentes animadas;
  // dynamic: se re-sube cada frame (video/canvas animado); dirty: subir una vez.
  return { unit, tex, source: null, tick: null, dynamic: false, dirty: false, w: 1, h: 1, startTime: 0 };
}
const channels = [makeChannel(0), makeChannel(1)];

function setSource(ch, source, { dynamic = false, tick = null } = {}) {
  ch.source = source;
  ch.dynamic = dynamic;
  ch.tick = tick;
  ch.dirty = true;
  ch.startTime = performance.now();
}

function uploadChannel(ch) {
  const src = ch.source;
  if (!src || !(ch.dynamic || ch.dirty)) return;
  if (src instanceof HTMLVideoElement && src.readyState < 2) return; // sin frame todavía
  const w = src.videoWidth || src.naturalWidth || src.width;
  const h = src.videoHeight || src.naturalHeight || src.height;
  if (!w || !h) return;
  gl.activeTexture(gl.TEXTURE0 + ch.unit);
  gl.bindTexture(gl.TEXTURE_2D, ch.tex);
  // ShaderToy usa vflip = true por defecto: uv (0,0) es la esquina inferior izquierda de la imagen.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  ch.w = w; ch.h = h; ch.dirty = false;
}

// --- Fuente: patrón de prueba (asimétrico, para ver los flips) ---
function patternCanvas() {
  const c = document.createElement('canvas');
  c.width = 640; c.height = 360;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, c.width, c.height);
  grad.addColorStop(0, '#e63946'); grad.addColorStop(0.5, '#f1c453'); grad.addColorStop(1, '#2a9d8f');
  g.fillStyle = grad; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1;
  for (let x = 0; x <= c.width; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke(); }
  for (let y = 0; y <= c.height; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke(); }
  g.fillStyle = '#111'; g.font = 'bold 44px system-ui, sans-serif';
  g.fillText('ARRIBA-IZQ', 20, 60);
  g.font = 'bold 28px system-ui, sans-serif';
  g.fillText('iChannel0', 20, c.height - 24);
  g.beginPath(); g.moveTo(c.width - 40, 30); g.lineTo(c.width - 70, 80); g.lineTo(c.width - 10, 80); g.closePath(); g.fill();
  return c;
}

// --- Fuente: "video" de fondo verde animado (simula un chroma con iluminación despareja) ---
function greenScreenSource() {
  const c = document.createElement('canvas');
  c.width = 640; c.height = 360;
  const g = c.getContext('2d');
  const draw = (t) => {
    // Fondo verde con viñeta: el centro es verde puro y los bordes más oscuros,
    // como un chroma real mal iluminado. Así se nota el efecto del umbral.
    const bg = g.createRadialGradient(320, 180, 40, 320, 180, 420);
    bg.addColorStop(0, 'rgb(0,255,0)');
    bg.addColorStop(1, 'rgb(40,150,50)');
    g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
    // "Bailarín": silueta que se mueve, con borde difuso verdoso (spill).
    const x = 320 + Math.sin(t * 1.6) * 180;
    const y = 200 + Math.abs(Math.sin(t * 3.2)) * -30;
    g.save();
    g.shadowColor = 'rgba(60,200,60,0.9)'; g.shadowBlur = 18;
    g.fillStyle = '#f2c6a0'; g.beginPath(); g.arc(x, y - 95, 32, 0, Math.PI * 2); g.fill();        // cabeza
    g.fillStyle = '#1d3a8a'; g.fillRect(x - 40, y - 60, 80, 120);                                  // torso
    g.fillStyle = '#e63946';                                                                       // brazos
    g.save(); g.translate(x - 40, y - 50); g.rotate(-0.8 + Math.sin(t * 6) * 0.6); g.fillRect(-12, 0, 24, 90); g.restore();
    g.save(); g.translate(x + 40, y - 50); g.rotate(0.8 - Math.sin(t * 6) * 0.6); g.fillRect(-12, 0, 24, 90); g.restore();
    g.fillStyle = '#222'; g.fillRect(x - 38, y + 60, 30, 90); g.fillRect(x + 8, y + 60, 30, 90); // piernas
    g.restore();
  };
  draw(0);
  return { canvas: c, draw };
}

// --- Fuente: webcam (un único stream compartido entre canales) ---
let webcamVideo = null;
async function getWebcam() {
  if (webcamVideo) return webcamVideo;
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('getUserMedia no disponible: abrí la página por https o desde localhost.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.srcObject = stream;
  await v.play();
  webcamVideo = v;
  return v;
}

// --- Fuente: archivo local ---
function loadFile(file) {
  const url = URL.createObjectURL(file);
  if (file.type.startsWith('video/')) {
    const v = document.createElement('video');
    v.src = url; v.loop = true; v.muted = true; v.playsInline = true;
    return v.play().then(() => ({ el: v, dynamic: true }));
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ el: img, dynamic: false });
    img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
    img.src = url;
  });
}

async function applyChannelChoice(index, value) {
  const ch = channels[index];
  try {
    if (value === 'pattern') {
      setSource(ch, patternCanvas());
    } else if (value === 'greenscreen') {
      const gs = greenScreenSource();
      setSource(ch, gs.canvas, { dynamic: true, tick: gs.draw });
    } else if (value === 'webcam') {
      setSource(ch, await getWebcam(), { dynamic: true });
    } else if (value === 'file') {
      pendingFileChannel = index;
      fileInput.value = '';
      fileInput.click();
      return;
    }
    channelChoice[index] = value;
    clearError();
  } catch (e) {
    showError(`iChannel${index}: ${e.message}`);
    $(`ch${index}`).value = channelChoice[index];
  }
}

const channelChoice = ['pattern', 'greenscreen'];
let pendingFileChannel = null;

fileInput.addEventListener('change', async () => {
  const idx = pendingFileChannel;
  const file = fileInput.files[0];
  pendingFileChannel = null;
  if (idx === null || !file) return;
  try {
    const { el, dynamic } = await loadFile(file);
    setSource(channels[idx], el, { dynamic });
    channelChoice[idx] = 'file';
    clearError();
  } catch (e) {
    showError(`iChannel${idx}: ${e.message}`);
    $(`ch${idx}`).value = channelChoice[idx];
  }
});
fileInput.addEventListener('cancel', () => {
  if (pendingFileChannel !== null) $(`ch${pendingFileChannel}`).value = channelChoice[pendingFileChannel];
  pendingFileChannel = null;
});

// ---------------------------------------------------------------------------
// Mouse (convención de ShaderToy) + slider de umbral
// ---------------------------------------------------------------------------
// Se guarda normalizado [0,1] y se convierte a píxeles al dibujar (sobrevive a resize).
// xy: posición actual mientras el botón está apretado. zw: posición del click
// (positivos mientras está apretado, negativos al soltar).
// ?umbral=0.3 en la URL fija el umbral inicial (capturas reproducibles).
const umbralParam = Number.parseFloat(new URLSearchParams(location.search).get('umbral'));
if (Number.isFinite(umbralParam)) thresholdInput.value = String(Math.min(1, Math.max(0, umbralParam)));
const mouse = { x: Number(thresholdInput.value), y: 0.5, z: 0, w: 0, down: false };

function pointerToNorm(ev) {
  const r = canvas.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)),
    y: Math.min(1, Math.max(0, (r.bottom - ev.clientY) / r.height)), // origen abajo, como gl_FragCoord
  };
}
function syncSlider() {
  thresholdInput.value = mouse.x.toFixed(2);
  $('threshold-val').textContent = mouse.x.toFixed(2);
}
canvas.addEventListener('pointerdown', (ev) => {
  const p = pointerToNorm(ev);
  Object.assign(mouse, { x: p.x, y: p.y, z: p.x, w: p.y, down: true });
  canvas.setPointerCapture(ev.pointerId);
  syncSlider();
});
canvas.addEventListener('pointermove', (ev) => {
  if (!mouse.down) return;
  const p = pointerToNorm(ev);
  mouse.x = p.x; mouse.y = p.y;
  syncSlider();
});
canvas.addEventListener('pointerup', () => {
  mouse.down = false;
  mouse.z = -Math.abs(mouse.z); mouse.w = -Math.abs(mouse.w);
});
thresholdInput.addEventListener('input', () => {
  mouse.x = Number(thresholdInput.value);
  syncSlider();
});

// ---------------------------------------------------------------------------
// Carga de Hits
// ---------------------------------------------------------------------------
let current = null;   // programa activo
let loadToken = 0;

async function loadHit(id) {
  const hit = HITS.find((h) => h.id === id) || HITS[0];
  const token = ++loadToken;
  hitSelect.value = hit.id;
  history.replaceState(null, '', `#${hit.id}`);
  $('hit-desc').textContent = hit.desc;
  $('ch0-box').disabled = !hit.channels.includes(0);
  $('ch1-box').disabled = !hit.channels.includes(1);
  $('threshold-box').disabled = !hit.threshold;
  try {
    const res = await fetch(hit.file, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status} al leer ${hit.file}`);
    const src = await res.text();
    if (token !== loadToken) return; // el usuario cambió de Hit mientras cargaba
    const program = buildProgram(src);
    if (current) gl.deleteProgram(current.prog);
    current = program;
    frameCount = 0;
    startTime = performance.now();
    clearError();
  } catch (e) {
    if (token !== loadToken) return;
    const hint = location.protocol === 'file:'
      ? '\n\nAbrí el harness con un servidor HTTP: desde la raíz del repo, "python -m http.server 8000" y luego http://localhost:8000/web/'
      : '';
    showError(`${hit.label}\n${e.message}${hint}`);
  }
}

function showError(msg) { errorBox.textContent = msg; errorBox.hidden = false; }
function clearError() { errorBox.hidden = true; errorBox.textContent = ''; }

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------
let startTime = performance.now();
let lastTime = startTime;
let frameCount = 0;
let fpsFrames = 0;
let fpsLast = startTime;
let fps = 60;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.min(1920, Math.round(canvas.clientWidth * dpr));
  const h = Math.round(w * 9 / 16);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w; canvas.height = h;
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  resize();
  const time = (now - startTime) / 1000;
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  for (const ch of channels) {
    if (ch.tick) ch.tick(time);
    uploadChannel(ch);
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
  if (!current) return;

  const { prog, aPos, loc } = current;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const W = canvas.width, H = canvas.height;
  const d = new Date();
  gl.uniform3f(loc.iResolution, W, H, 1);
  gl.uniform1f(loc.iTime, time);
  gl.uniform1f(loc.iTimeDelta, dt);
  gl.uniform1f(loc.iFrameRate, fps);
  gl.uniform1i(loc.iFrame, frameCount);
  gl.uniform4f(loc.iMouse, mouse.x * W, mouse.y * H, mouse.z * W, mouse.w * H);
  gl.uniform4f(loc.iDate, d.getFullYear(), d.getMonth(), d.getDate(),
    d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000);
  gl.uniform1fv(loc.iChannelTime, channels.map((c) => (now - c.startTime) / 1000).concat([0, 0]));
  gl.uniform3fv(loc.iChannelResolution, [
    channels[0].w, channels[0].h, 1, channels[1].w, channels[1].h, 1, 0, 0, 0, 0, 0, 0,
  ]);
  for (const ch of channels) {
    gl.activeTexture(gl.TEXTURE0 + ch.unit);
    gl.bindTexture(gl.TEXTURE_2D, ch.tex);
  }
  gl.uniform1i(loc.iChannel0, 0);
  gl.uniform1i(loc.iChannel1, 1);

  // Un único draw call: la GPU ejecuta mainImage W*H veces, en paralelo.
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  frameCount++;

  fpsFrames++;
  if (now - fpsLast >= 500) {
    fps = (fpsFrames * 1000) / (now - fpsLast);
    fpsFrames = 0; fpsLast = now;
    $('fps').textContent = `${fps.toFixed(0)} fps`;
    $('res').textContent = `${W}×${H}`;
    $('pixels').textContent = `${(W * H).toLocaleString('es-AR')} invocaciones de mainImage por frame`;
  }
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
for (const h of HITS) hitSelect.add(new Option(h.label, h.id));
hitSelect.addEventListener('change', () => loadHit(hitSelect.value));
$('reload').addEventListener('click', () => loadHit(hitSelect.value));
for (const i of [0, 1]) {
  $(`ch${i}`).addEventListener('change', (ev) => applyChannelChoice(i, ev.target.value));
}
$('capture').addEventListener('click', () => {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${hitSelect.value}-${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');
});
window.addEventListener('hashchange', () => loadHit(location.hash.slice(1)));

applyChannelChoice(0, 'pattern');
applyChannelChoice(1, 'greenscreen');
syncSlider();
loadHit(location.hash.slice(1) || 'hit5');
requestAnimationFrame(frame);
