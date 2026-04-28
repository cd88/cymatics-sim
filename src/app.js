const fieldCanvas = document.getElementById('fieldCanvas');
const particleCanvas = document.getElementById('particleCanvas');
const stage = document.getElementById('stage');
const pctx = particleCanvas.getContext('2d', { alpha: true });

const controls = {
  playPause: document.getElementById('playPause'),
  resetParticles: document.getElementById('resetParticles'),
  snapPreset: document.getElementById('snapPreset'),
  shape: document.getElementById('shape'),
  material: document.getElementById('material'),
  frequency: document.getElementById('frequency'),
  amplitude: document.getElementById('amplitude'),
  damping: document.getElementById('damping'),
  threshold: document.getElementById('threshold'),
  sharpness: document.getElementById('sharpness'),
  showNodal: document.getElementById('showNodal'),
  showHeat: document.getElementById('showHeat'),
  showParticles: document.getElementById('showParticles'),
  particleCount: document.getElementById('particleCount'),
  particleDamping: document.getElementById('particleDamping'),
  nodalPull: document.getElementById('nodalPull'),
  jitter: document.getElementById('jitter'),
  audioMap: document.getElementById('audioMap'),
  toneToggle: document.getElementById('toneToggle'),
  shapePicker: document.getElementById('shapePicker'),
  micButton: document.getElementById('micButton'),
  audioFile: document.getElementById('audioFile'),
  audioElement: document.getElementById('audioElement'),
  outputVolume: document.getElementById('outputVolume'),
  fftCanvas: document.getElementById('fftCanvas'),
  modeEditor: document.getElementById('modeEditor'),
  audioStatus: document.getElementById('audioStatus'),
  energyReadout: document.getElementById('energyReadout'),
  fpsReadout: document.getElementById('fpsReadout'),
  particleReadout: document.getElementById('particleReadout'),
  shapeReadout: document.getElementById('shapeReadout'),
  frequencyOut: document.getElementById('frequencyOut'),
  amplitudeOut: document.getElementById('amplitudeOut'),
  dampingOut: document.getElementById('dampingOut'),
  thresholdOut: document.getElementById('thresholdOut'),
  sharpnessOut: document.getElementById('sharpnessOut'),
  particleCountOut: document.getElementById('particleCountOut'),
  particleDampingOut: document.getElementById('particleDampingOut'),
  nodalPullOut: document.getElementById('nodalPullOut'),
  jitterOut: document.getElementById('jitterOut'),
  outputVolumeOut: document.getElementById('outputVolumeOut')
};

const state = {
  running: true,
  audioElementWasPlaying: false,
  time: 0,
  lastNow: performance.now(),
  width: 1,
  height: 1,
  dpr: Math.min(2, window.devicePixelRatio || 1),
  audio: null,
  tone: null,
  fft: new Uint8Array(512),
  audioEnergy: 0,
  particles: [],
  modes: [
    { m: 1, n: 1, amp: 0.52 },
    { m: 2, n: 3, amp: 0.44 },
    { m: 3, n: 2, amp: 0.36 },
    { m: 4, n: 5, amp: 0.24 },
    { m: 6, n: 4, amp: 0.18 },
    { m: 7, n: 8, amp: 0.12 }
  ],
  material: {
    decay: 0.82,
    stiffness: 1.2,
    toneFilter: 5100,
    toneQ: 2.4,
    harmonic: 0.2,
    colorA: [0.03, 0.08, 0.13],
    colorB: [0.18, 0.85, 0.78],
    colorC: [0.78, 0.48, 1.0]
  }
};

const materialProfiles = {
  steel: { decay: 0.82, stiffness: 1.25, toneFilter: 6200, toneQ: 3.6, harmonic: 0.35, colorA: [0.03, 0.08, 0.13], colorB: [0.18, 0.85, 0.78], colorC: [0.78, 0.48, 1.0] },
  brass: { decay: 0.74, stiffness: 0.94, toneFilter: 3500, toneQ: 1.8, harmonic: 0.28, colorA: [0.10, 0.065, 0.025], colorB: [1.0, 0.72, 0.32], colorC: [0.55, 0.28, 0.13] },
  glass: { decay: 0.92, stiffness: 1.55, toneFilter: 7600, toneQ: 4.2, harmonic: 0.24, colorA: [0.02, 0.06, 0.12], colorB: [0.54, 0.88, 1.0], colorC: [0.96, 0.92, 1.0] },
  rubber: { decay: 0.48, stiffness: 0.62, toneFilter: 1400, toneQ: 0.8, harmonic: 0.08, colorA: [0.035, 0.04, 0.06], colorB: [0.39, 0.54, 0.68], colorC: [0.08, 0.12, 0.18] },
  water: { decay: 0.66, stiffness: 0.72, toneFilter: 2200, toneQ: 1.1, harmonic: 0.14, colorA: [0.005, 0.03, 0.045], colorB: [0.06, 0.55, 0.8], colorC: [0.63, 0.9, 1.0] }
};

const KNOB_ANGLE_MIN = -135;
const KNOB_ANGLE_MAX = 135;

const gl = fieldCanvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false });
if (!gl) {
  document.body.innerHTML = '<main class="fallback"><h1>WebGL is required for this prototype.</h1><p>Your browser or GPU settings did not provide a WebGL context.</p></main>';
  throw new Error('WebGL unavailable');
}

const vertexSource = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const fragmentSource = `
precision highp float;
varying vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_frequency;
uniform float u_amplitude;
uniform float u_damping;
uniform float u_threshold;
uniform float u_sharpness;
uniform float u_showNodal;
uniform float u_showHeat;
uniform int u_shape;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform vec3 u_colorC;
uniform vec3 u_modesA;
uniform vec3 u_modesB;
uniform vec3 u_ampsA;
uniform vec3 u_ampsB;

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float sdEquilateralTriangle(vec2 p) {
  const float k = 1.7320508;
  p.x = abs(p.x) - 0.82;
  p.y = p.y + 0.47;
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -1.64, 0.0);
  return -length(p) * sign(p.y);
}

float sdHex(vec2 p, float r) {
  const vec3 k = vec3(-0.8660254, 0.5, 0.5773503);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

float shapeDistance(vec2 p) {
  if (u_shape == 0) return length(p) - 0.92;
  if (u_shape == 1) return sdBox(p, vec2(0.86));
  if (u_shape == 2) return sdRoundBox(p, vec2(0.83), 0.17);
  if (u_shape == 3) return sdEquilateralTriangle(p);
  return sdHex(p, 0.9);
}

float modeTerm(vec2 uv, float m, float n, float amp, float t, float phase) {
  float spatial = sin(3.14159265 * m * uv.x) * sin(3.14159265 * n * uv.y);
  float modeFreq = sqrt(m * m + n * n);
  float temporal = cos(t * (0.45 + 0.018 * u_frequency) * modeFreq + phase);
  return spatial * temporal * amp;
}

float fieldAt(vec2 uv, float t) {
  float z = 0.0;
  z += modeTerm(uv, u_modesA.x, u_modesA.y, u_ampsA.x, t, 0.0);
  z += modeTerm(uv, u_modesA.z, u_modesB.x, u_ampsA.y, t, 0.7);
  z += modeTerm(uv, u_modesB.y, u_modesB.z, u_ampsA.z, t, 1.6);
  z += modeTerm(uv, u_modesA.x + u_modesB.x, u_modesA.y + 1.0, u_ampsB.x, t, 2.3);
  z += modeTerm(uv, u_modesA.z + 1.0, u_modesB.z, u_ampsB.y, t, 3.0);
  z += modeTerm(uv, u_modesB.y, u_modesA.y + u_modesB.x, u_ampsB.z, t, 4.1);
  return z * u_amplitude;
}

void main() {
  vec2 st = v_uv;
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (st * 2.0 - 1.0) * aspect;
  float dist = shapeDistance(p);
  float mask = 1.0 - smoothstep(-0.004, 0.018, dist);
  float rim = 1.0 - smoothstep(0.0, 0.035, abs(dist));
  vec2 uv = st;

  float z = fieldAt(uv, u_time);
  float mag = abs(z);
  float sharpBlend = 1.0 - u_sharpness;
  float nodal = 1.0 - smoothstep(u_threshold * (1.25 - sharpBlend), u_threshold * (1.7 + sharpBlend), mag);
  float contour = 0.5 + 0.5 * sin(z * 42.0);
  float heat = smoothstep(0.0, 1.1, mag);

  vec3 base = mix(u_colorA, u_colorB, heat * u_showHeat);
  base = mix(base, u_colorC, pow(max(0.0, contour), 9.0) * 0.16 * u_showHeat);
  vec3 nodeColor = vec3(0.92, 0.98, 1.0);
  base = mix(base, nodeColor, nodal * u_showNodal * 0.92);
  base += rim * vec3(0.32, 0.58, 0.72);
  base *= mask;
  base += vec3(0.006, 0.008, 0.012) * (1.0 - mask);

  float vignette = smoothstep(1.3, 0.2, length(p));
  base *= 0.72 + vignette * 0.42;
  gl_FragColor = vec4(base, 1.0);
}`;

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || 'Shader failed');
  }
  return shader;
}

function makeProgram(vs, fs) {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vs));
  gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || 'Program failed');
  }
  return program;
}

const program = makeProgram(vertexSource, fragmentSource);
const loc = {
  position: gl.getAttribLocation(program, 'a_position'),
  resolution: gl.getUniformLocation(program, 'u_resolution'),
  time: gl.getUniformLocation(program, 'u_time'),
  frequency: gl.getUniformLocation(program, 'u_frequency'),
  amplitude: gl.getUniformLocation(program, 'u_amplitude'),
  damping: gl.getUniformLocation(program, 'u_damping'),
  threshold: gl.getUniformLocation(program, 'u_threshold'),
  sharpness: gl.getUniformLocation(program, 'u_sharpness'),
  showNodal: gl.getUniformLocation(program, 'u_showNodal'),
  showHeat: gl.getUniformLocation(program, 'u_showHeat'),
  shape: gl.getUniformLocation(program, 'u_shape'),
  colorA: gl.getUniformLocation(program, 'u_colorA'),
  colorB: gl.getUniformLocation(program, 'u_colorB'),
  colorC: gl.getUniformLocation(program, 'u_colorC'),
  modesA: gl.getUniformLocation(program, 'u_modesA'),
  modesB: gl.getUniformLocation(program, 'u_modesB'),
  ampsA: gl.getUniformLocation(program, 'u_ampsA'),
  ampsB: gl.getUniformLocation(program, 'u_ampsB')
};

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

const shapeMap = { circle: 0, square: 1, 'rounded-square': 2, triangle: 3, hex: 4 };
const knobElements = new Map();

function setMaterial(name) {
  state.material = materialProfiles[name] || materialProfiles.steel;
  updateToneFromControls();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function stepPrecision(step) {
  const str = String(step);
  const idx = str.indexOf('.');
  return idx === -1 ? 0 : str.length - idx - 1;
}

function setRangeValue(input, nextValue) {
  const min = Number(input.min);
  const max = Number(input.max);
  const step = Math.max(Number(input.step) || 1, 1e-9);
  const precision = stepPrecision(step);
  const snapped = min + Math.round((clamp(nextValue, min, max) - min) / step) * step;
  const limited = clamp(snapped, min, max);
  const value = limited.toFixed(precision);
  if (value !== input.value) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function inputToAngle(input) {
  const min = Number(input.min);
  const max = Number(input.max);
  const value = Number(input.value);
  const norm = (value - min) / Math.max(max - min, 1e-9);
  return KNOB_ANGLE_MIN + norm * (KNOB_ANGLE_MAX - KNOB_ANGLE_MIN);
}

function syncKnobFromInput(input) {
  const knob = knobElements.get(input.id);
  if (!knob) return;
  knob.style.setProperty('--knob-angle', `${inputToAngle(input)}deg`);
  knob.setAttribute('aria-valuenow', input.value);
}

function bindKnob(knob) {
  const input = controls[knob.dataset.target];
  if (!input) return;
  knobElements.set(input.id, knob);
  syncKnobFromInput(input);

  let pointerId = null;
  let lastX = 0;
  let lastY = 0;

  knob.addEventListener('pointerdown', async (event) => {
    if (event.button !== 0) return;
    await ensureToneContext();
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    knob.classList.add('dragging');
    knob.setPointerCapture(pointerId);
    event.preventDefault();
  });

  knob.addEventListener('pointermove', (event) => {
    if (pointerId !== event.pointerId) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;

    const min = Number(input.min);
    const max = Number(input.max);
    const sensitivity = (max - min) / 900;
    const clockwiseDelta = (dx - dy) * sensitivity;
    setRangeValue(input, Number(input.value) + clockwiseDelta);
  });

  const endDrag = (event) => {
    if (pointerId !== event.pointerId) return;
    knob.classList.remove('dragging');
    knob.releasePointerCapture(pointerId);
    pointerId = null;
  };

  knob.addEventListener('pointerup', endDrag);
  knob.addEventListener('pointercancel', endDrag);

  knob.addEventListener('wheel', (event) => {
    const step = Number(input.step) || (Number(input.max) - Number(input.min)) / 100;
    const mult = event.shiftKey ? 4 : 1;
    const direction = event.deltaY < 0 ? 1 : -1;
    setRangeValue(input, Number(input.value) + step * mult * direction);
    event.preventDefault();
  }, { passive: false });

  knob.addEventListener('keydown', (event) => {
    const step = Number(input.step) || (Number(input.max) - Number(input.min)) / 100;
    const mult = event.shiftKey ? 10 : 1;
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      setRangeValue(input, Number(input.value) + step * mult);
      event.preventDefault();
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      setRangeValue(input, Number(input.value) - step * mult);
      event.preventDefault();
    }
  });
}

function initKnobs() {
  document.querySelectorAll('.knob[data-target]').forEach((knob) => bindKnob(knob));
}

async function ensureToneContext() {
  if (!state.tone) {
    const context = new AudioContext();
    const mainOsc = context.createOscillator();
    const overtoneOsc = context.createOscillator();
    const mainGain = context.createGain();
    const overtoneGain = context.createGain();
    const filter = context.createBiquadFilter();
    const body = context.createGain();
    const output = context.createGain();

    mainOsc.type = 'sine';
    overtoneOsc.type = 'triangle';
    mainGain.gain.value = 0.65;
    overtoneGain.gain.value = 0.18;
    filter.type = 'lowpass';
    body.gain.value = 0;
    output.gain.value = 0;

    mainOsc.connect(mainGain);
    overtoneOsc.connect(overtoneGain);
    mainGain.connect(filter);
    overtoneGain.connect(filter);
    filter.connect(body);
    body.connect(output);
    output.connect(context.destination);

    mainOsc.start();
    overtoneOsc.start();

    state.tone = {
      context,
      enabled: false,
      mainOsc,
      overtoneOsc,
      overtoneGain,
      filter,
      body,
      output
    };
  }
  if (state.tone.context.state === 'suspended') {
    await state.tone.context.resume();
  }
  return state.tone;
}

function updateToneFromControls() {
  if (!state.tone) return;
  const tone = state.tone;
  const now = tone.context.currentTime;
  const frequency = Number(controls.frequency.value);
  const amplitude = Number(controls.amplitude.value);
  const damping = Number(controls.damping.value);
  const outputVolume = Number(controls.outputVolume.value);

  const dampMin = Number(controls.damping.min);
  const dampMax = Number(controls.damping.max);
  const dampNorm = (damping - dampMin) / Math.max(dampMax - dampMin, 1e-9);

  const carrier = clamp(frequency, 20, 2200);
  const filterFreq = clamp(state.material.toneFilter + carrier * 2.1, 180, 12000);
  const decayTime = clamp((1 - dampNorm) * (0.65 + state.material.decay * 0.55), 0.04, 1.2);
  const audioActive = state.running && tone.enabled;
  const targetBodyGain = audioActive ? (amplitude / 1.8) * 0.48 : 0;
  const targetOutput = audioActive ? outputVolume : 0;

  tone.mainOsc.frequency.setTargetAtTime(carrier, now, 0.015);
  tone.overtoneOsc.frequency.setTargetAtTime(carrier * 2, now, 0.02);
  tone.overtoneGain.gain.setTargetAtTime(state.material.harmonic, now, 0.08);
  tone.filter.frequency.setTargetAtTime(filterFreq, now, 0.07);
  tone.filter.Q.setTargetAtTime(state.material.toneQ, now, 0.08);
  tone.body.gain.setTargetAtTime(targetBodyGain, now, decayTime);
  tone.output.gain.setTargetAtTime(targetOutput, now, 0.06);
}

function updatePlayPauseButton() {
  controls.playPause.textContent = state.running ? '⏸' : '▶';
  const label = state.running ? 'Pause simulation' : 'Play simulation';
  controls.playPause.setAttribute('aria-label', label);
  controls.playPause.setAttribute('title', label);
}

function updateToneButtonIcon() {
  const audible = state.running && state.tone?.enabled;
  controls.toneToggle.textContent = audible ? '🔊' : '🔇';
  const label = state.tone?.enabled ? 'Disable tone' : 'Enable tone';
  controls.toneToggle.setAttribute('aria-label', label);
  controls.toneToggle.setAttribute('title', label);
}

async function toggleTone() {
  await ensureToneContext();
  state.tone.enabled = !state.tone.enabled;
  const baseLabel = state.audio?.label || 'manual';
  const toneLabel = state.tone.enabled ? ' + tone' : '';
  controls.audioStatus.textContent = `Audio: ${baseLabel}${toneLabel}`;
  updateToneButtonIcon();
  updateToneFromControls();
}

async function syncAudioToRunState() {
  try {
    if (!state.running) {
      state.audioElementWasPlaying = !controls.audioElement.paused;
      controls.audioElement.pause();
      if (state.audio?.context && state.audio.context.state !== 'suspended') {
        await state.audio.context.suspend();
      }
      if (state.tone?.context && state.tone.context.state !== 'suspended') {
        await state.tone.context.suspend();
      }
      return;
    }

    if (state.audio?.context && state.audio.context.state === 'suspended') {
      await state.audio.context.resume();
    }
    if (state.tone?.context && state.tone.context.state === 'suspended') {
      await state.tone.context.resume();
    }
    if (state.audioElementWasPlaying && controls.audioElement.src) {
      controls.audioElement.play().catch(() => {});
    }
    state.audioElementWasPlaying = false;
  } finally {
    updateToneButtonIcon();
    updateToneFromControls();
  }
}

function waveAt(x, y, t = state.time) {
  let z = 0;
  const frequency = Number(controls.frequency.value);
  const amp = Number(controls.amplitude.value);
  const baseSpeed = 0.45 + 0.018 * frequency;
  const modeAmps = getModeAmplitudes();
  for (let i = 0; i < state.modes.length; i++) {
    const mode = state.modes[i];
    const spatial = Math.sin(Math.PI * mode.m * x) * Math.sin(Math.PI * mode.n * y);
    const modeFreq = Math.hypot(mode.m, mode.n);
    const temporal = Math.cos(t * baseSpeed * modeFreq + i * 0.77);
    z += spatial * temporal * modeAmps[i];
  }
  return z * amp;
}

function getModeAmplitudes() {
  if (!controls.audioMap.checked || !state.audio?.analyser) {
    return state.modes.map((m) => m.amp);
  }
  state.audio.analyser.getByteFrequencyData(state.fft);
  const amps = state.modes.map((mode, i) => {
    const bin = Math.min(state.fft.length - 1, Math.floor((i + 1) * state.fft.length / 13));
    const neighbor = Math.min(state.fft.length - 1, bin + 4);
    let sum = 0;
    for (let b = bin; b <= neighbor; b++) sum += state.fft[b];
    const energy = sum / ((neighbor - bin + 1) * 255);
    return mode.amp * (0.25 + energy * 2.2);
  });
  state.audioEnergy = amps.reduce((acc, n) => acc + n, 0) / amps.length;
  return amps;
}

function sdEquilateralTriangleJS(px, py) {
  // Direct JS port of the shader's sdEquilateralTriangle
  const k = 1.7320508;
  let x = Math.abs(px) - 0.82;
  let y = py + 0.47;
  if (x + k * y > 0) {
    const nx = (x - k * y) / 2;
    const ny = (-k * x - y) / 2;
    x = nx;
    y = ny;
  }
  x -= Math.max(Math.min(x, 0), -1.64);
  return -Math.hypot(x, y) * Math.sign(y);
}

function isInsideShape(x, y) {
  const aspect = state.width / state.height;
  const px = (x * 2 - 1) * aspect;
  // Match shader p.y orientation (top is +1 in v_uv-derived space).
  const py = 1 - y * 2;
  const shape = controls.shape.value;
  if (shape === 'circle') return Math.hypot(px, py) < 0.92;
  if (shape === 'square') return Math.max(Math.abs(px), Math.abs(py)) < 0.86;
  if (shape === 'rounded-square') {
    // Port of sdRoundBox(p, vec2(0.83), 0.17): inside when dist < 0
    const dx = Math.max(Math.abs(px) - 0.66, 0); // 0.83 - 0.17 = 0.66
    const dy = Math.max(Math.abs(py) - 0.66, 0);
    return Math.hypot(dx, dy) < 0.17;
  }
  if (shape === 'triangle') return sdEquilateralTriangleJS(px, py) < 0;
  if (shape === 'hex') {
    const qx = Math.abs(px), qy = Math.abs(py);
    return qx * 0.8660254 + qy * 0.5 < 0.83 && qy < 0.86;
  }
  return false;
}

function randomPointInShape() {
  for (let i = 0; i < 100; i++) {
    const x = Math.random();
    const y = Math.random();
    if (isInsideShape(x, y)) return { x, y };
  }
  return { x: 0.5, y: 0.5 };
}

function seedParticles() {
  const count = Number(controls.particleCount.value);
  state.particles = Array.from({ length: count }, () => {
    const p = randomPointInShape();
    return {
      x: p.x,
      y: p.y,
      vx: (Math.random() - 0.5) * 0.001,
      vy: (Math.random() - 0.5) * 0.001,
      settled: Math.random()
    };
  });
  controls.particleReadout.textContent = String(count);
}

function updateParticles(dt) {
  const threshold = Number(controls.threshold.value);
  const pull = Number(controls.nodalPull.value);
  const pdamp = Number(controls.particleDamping.value);
  const jitter = Number(controls.jitter.value);
  const eps = 1 / Math.max(state.width, state.height);
  const step = Math.min(dt, 0.033) * 52;
  const surfDamping = Number(controls.damping.value) + (1 - state.material.decay) * 0.06;

  for (const p of state.particles) {
    const z = Math.abs(waveAt(p.x, p.y));
    const zx = Math.abs(waveAt(Math.min(0.999, p.x + eps), p.y)) - Math.abs(waveAt(Math.max(0.001, p.x - eps), p.y));
    const zy = Math.abs(waveAt(p.x, Math.min(0.999, p.y + eps))) - Math.abs(waveAt(p.x, Math.max(0.001, p.y - eps)));
    const calm = Math.max(0, 1 - z / Math.max(threshold * 8, 0.0001));
    const active = 1 - calm;

    p.vx += -zx * pull * step * 0.88;
    p.vy += -zy * pull * step * 0.88;
    p.vx += (Math.random() - 0.5) * jitter * active * 0.0018;
    p.vy += (Math.random() - 0.5) * jitter * active * 0.0018;
    p.vx *= pdamp - surfDamping;
    p.vy *= pdamp - surfDamping;
    p.x += p.vx * step;
    p.y += p.vy * step;

    if (!isInsideShape(p.x, p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) {
      const np = randomPointInShape();
      p.x = np.x;
      p.y = np.y;
      p.vx = 0;
      p.vy = 0;
    }
  }
}

function drawParticles() {
  pctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  if (!controls.showParticles.checked) return;
  const w = particleCanvas.width;
  const h = particleCanvas.height;
  const r = Math.max(0.62, state.dpr * 0.58);
  pctx.globalCompositeOperation = 'lighter';
  pctx.fillStyle = 'rgba(245, 241, 214, 0.72)';
  pctx.beginPath();
  for (const p of state.particles) {
    pctx.moveTo(p.x * w + r, p.y * h);
    pctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2);
  }
  pctx.fill();
  pctx.globalCompositeOperation = 'source-over';
}

function renderField() {
  const amps = getModeAmplitudes();
  gl.viewport(0, 0, fieldCanvas.width, fieldCanvas.height);
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.enableVertexAttribArray(loc.position);
  gl.vertexAttribPointer(loc.position, 2, gl.FLOAT, false, 0, 0);

  gl.uniform2f(loc.resolution, fieldCanvas.width, fieldCanvas.height);
  gl.uniform1f(loc.time, state.time);
  gl.uniform1f(loc.frequency, Number(controls.frequency.value));
  gl.uniform1f(loc.amplitude, Number(controls.amplitude.value) * state.material.stiffness);
  gl.uniform1f(loc.damping, Number(controls.damping.value));
  gl.uniform1f(loc.threshold, Number(controls.threshold.value));
  gl.uniform1f(loc.sharpness, Number(controls.sharpness.value));
  gl.uniform1f(loc.showNodal, controls.showNodal.checked ? 1 : 0);
  gl.uniform1f(loc.showHeat, controls.showHeat.checked ? 1 : 0);
  gl.uniform1i(loc.shape, shapeMap[controls.shape.value] ?? 0);
  gl.uniform3fv(loc.colorA, state.material.colorA);
  gl.uniform3fv(loc.colorB, state.material.colorB);
  gl.uniform3fv(loc.colorC, state.material.colorC);
  gl.uniform3f(loc.modesA, state.modes[0].m, state.modes[0].n, state.modes[1].m);
  gl.uniform3f(loc.modesB, state.modes[1].n, state.modes[2].m, state.modes[2].n);
  gl.uniform3f(loc.ampsA, amps[0], amps[1], amps[2]);
  gl.uniform3f(loc.ampsB, amps[3], amps[4], amps[5]);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function drawFft() {
  const canvas = controls.fftCanvas;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,0.045)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!state.audio?.analyser) return;
  state.audio.analyser.getByteFrequencyData(state.fft);
  const bars = 72;
  const bw = canvas.width / bars;
  for (let i = 0; i < bars; i++) {
    const idx = Math.floor(i * state.fft.length / bars);
    const v = state.fft[idx] / 255;
    const h = v * canvas.height;
    const hue = 175 + v * 90;
    ctx.fillStyle = `hsla(${hue}, 90%, 68%, 0.72)`;
    ctx.fillRect(i * bw, canvas.height - h, Math.max(1, bw - 1), h);
  }
}

function resize() {
  const rect = stage.getBoundingClientRect();
  state.dpr = Math.min(2, window.devicePixelRatio || 1);
  state.width = Math.max(1, Math.floor(rect.width));
  state.height = Math.max(1, Math.floor(rect.height));
  fieldCanvas.width = Math.floor(state.width * state.dpr);
  fieldCanvas.height = Math.floor(state.height * state.dpr);
  particleCanvas.width = fieldCanvas.width;
  particleCanvas.height = fieldCanvas.height;
  particleCanvas.style.width = `${state.width}px`;
  particleCanvas.style.height = `${state.height}px`;
  fieldCanvas.style.width = `${state.width}px`;
  fieldCanvas.style.height = `${state.height}px`;
  seedParticles();
}

function renderModeEditor() {
  controls.modeEditor.innerHTML = '';
  state.modes.forEach((mode, i) => {
    const row = document.createElement('div');
    row.className = 'mode-row';
    row.innerHTML = `
      <div class="mode-index">${i + 1}</div>
      <label>m<input type="number" min="1" max="14" value="${mode.m}" data-mode="${i}" data-field="m" /></label>
      <label>n<input type="number" min="1" max="14" value="${mode.n}" data-mode="${i}" data-field="n" /></label>
      <label>amp<input type="range" min="0" max="1.2" value="${mode.amp}" step="0.01" data-mode="${i}" data-field="amp" /></label>
    `;
    controls.modeEditor.appendChild(row);
  });
}

function updateOutputs() {
  controls.frequencyOut.textContent = `${controls.frequency.value} Hz`;
  controls.amplitudeOut.textContent = Number(controls.amplitude.value).toFixed(2);
  controls.dampingOut.textContent = Number(controls.damping.value).toFixed(3);
  controls.thresholdOut.textContent = Number(controls.threshold.value).toFixed(3);
  controls.sharpnessOut.textContent = Number(controls.sharpness.value).toFixed(2);
  controls.particleCountOut.textContent = controls.particleCount.value;
  controls.particleDampingOut.textContent = Number(controls.particleDamping.value).toFixed(3);
  controls.nodalPullOut.textContent = Number(controls.nodalPull.value).toFixed(2);
  controls.jitterOut.textContent = Number(controls.jitter.value).toFixed(2);
  controls.outputVolumeOut.textContent = Number(controls.outputVolume.value).toFixed(2);
  controls.shapeReadout.textContent = controls.shape.value;
  syncShapePicker();

  syncKnobFromInput(controls.frequency);
  syncKnobFromInput(controls.amplitude);
  syncKnobFromInput(controls.damping);
  updateToneFromControls();
}

function syncShapePicker() {
  if (!controls.shapePicker) return;
  controls.shapePicker.querySelectorAll('.shape-chip').forEach((button) => {
    const active = button.dataset.shape === controls.shape.value;
    button.classList.toggle('is-selected', active);
    button.setAttribute('aria-checked', active ? 'true' : 'false');
  });
}

function randomPreset() {
  const presets = [
    [{ m: 1, n: 2, amp: 0.7 }, { m: 2, n: 3, amp: 0.48 }, { m: 4, n: 4, amp: 0.3 }, { m: 5, n: 7, amp: 0.18 }, { m: 8, n: 3, amp: 0.15 }, { m: 9, n: 9, amp: 0.09 }],
    [{ m: 2, n: 2, amp: 0.6 }, { m: 3, n: 5, amp: 0.5 }, { m: 5, n: 3, amp: 0.42 }, { m: 8, n: 8, amp: 0.2 }, { m: 10, n: 4, amp: 0.12 }, { m: 4, n: 11, amp: 0.11 }],
    [{ m: 1, n: 4, amp: 0.72 }, { m: 4, n: 1, amp: 0.72 }, { m: 3, n: 6, amp: 0.22 }, { m: 6, n: 3, amp: 0.22 }, { m: 7, n: 7, amp: 0.12 }, { m: 12, n: 2, amp: 0.08 }],
    Array.from({ length: 6 }, (_, i) => ({ m: 1 + Math.floor(Math.random() * 10), n: 1 + Math.floor(Math.random() * 10), amp: Math.max(0.07, 0.75 / (i + 1) + Math.random() * 0.14) }))
  ];
  state.modes = structuredClone(presets[Math.floor(Math.random() * presets.length)]);
  renderModeEditor();
}

function setupAudioGraph(sourceNode, context, label) {
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.78;
  sourceNode.connect(analyser);
  if (sourceNode.mediaElement) analyser.connect(context.destination);
  state.audio = { context, analyser, sourceNode, label };
  state.fft = new Uint8Array(analyser.frequencyBinCount);
  const toneLabel = state.tone?.enabled ? ' + tone' : '';
  controls.audioStatus.textContent = `Audio: ${label}${toneLabel}`;
  controls.audioMap.checked = true;
}

async function useMicrophone() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const context = new AudioContext();
    if (context.state === 'suspended') await context.resume();
    const source = context.createMediaStreamSource(stream);
    setupAudioGraph(source, context, 'microphone');
  } catch (err) {
    controls.audioStatus.textContent = 'Audio: mic blocked';
    console.error(err);
  }
}

function useAudioFile(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  controls.audioElement.src = url;
  controls.audioElement.play().catch(() => {});
  const context = new AudioContext();
  context.resume().catch(() => {});
  const source = context.createMediaElementSource(controls.audioElement);
  source.mediaElement = controls.audioElement;
  setupAudioGraph(source, context, 'file');
}

let fpsFrames = 0;
let fpsTime = performance.now();
let lastEnergySample = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - state.lastNow) / 1000);
  state.lastNow = now;
  if (state.running) {
    const damp = 1 - Number(controls.damping.value) * 0.45;
    state.time += dt * damp * state.material.decay;
    updateParticles(dt);
  }
  renderField();
  drawParticles();
  drawFft();

  fpsFrames++;
  if (now - fpsTime > 500) {
    controls.fpsReadout.textContent = String(Math.round(fpsFrames * 1000 / (now - fpsTime)));
    fpsFrames = 0;
    fpsTime = now;
  }
  if (now - lastEnergySample > 140) {
    const samples = [[0.28, 0.33], [0.5, 0.5], [0.72, 0.61], [0.42, 0.78], [0.62, 0.22]];
    const e = samples.reduce((acc, p) => acc + Math.abs(waveAt(p[0], p[1])), 0) / samples.length;
    controls.energyReadout.textContent = e.toFixed(2);
    lastEnergySample = now;
  }
  requestAnimationFrame(frame);
}

controls.playPause.addEventListener('click', async () => {
  state.running = !state.running;
  updatePlayPauseButton();
  updateToneButtonIcon();
  updateToneFromControls();
  await syncAudioToRunState();
});

controls.resetParticles.addEventListener('click', seedParticles);
controls.snapPreset.addEventListener('click', randomPreset);
controls.material.addEventListener('change', () => setMaterial(controls.material.value));
controls.shape.addEventListener('change', () => { updateOutputs(); seedParticles(); });
controls.shapePicker.addEventListener('click', (event) => {
  const button = event.target.closest('.shape-chip[data-shape]');
  if (!button) return;
  const value = button.dataset.shape;
  if (!value || value === controls.shape.value) return;
  controls.shape.value = value;
  controls.shape.dispatchEvent(new Event('change', { bubbles: true }));
});
controls.particleCount.addEventListener('change', seedParticles);
controls.toneToggle.addEventListener('click', toggleTone);
controls.micButton.addEventListener('click', useMicrophone);
controls.audioFile.addEventListener('change', (event) => useAudioFile(event.target.files?.[0]));
controls.modeEditor.addEventListener('input', (event) => {
  const el = event.target;
  const index = Number(el.dataset.mode);
  const field = el.dataset.field;
  if (!Number.isFinite(index) || !field) return;
  const value = field === 'amp' ? Number(el.value) : Math.max(1, Math.min(14, Number(el.value)));
  state.modes[index][field] = value;
});

for (const input of document.querySelectorAll('input, select')) {
  input.addEventListener('input', updateOutputs);
}

window.addEventListener('resize', resize);

renderModeEditor();
initKnobs();
setMaterial(controls.material.value);
updatePlayPauseButton();
updateToneButtonIcon();
updateOutputs();
resize();
requestAnimationFrame(frame);
