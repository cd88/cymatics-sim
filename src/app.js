import { initUrlState } from './urlState.js';
import { vertexSource, fragmentSource } from './shaders.js';
import { createControlHelpers } from './controlUtils.js';
import { createAudioEngine } from './audioEngine.js';
import { createParticleEngine } from './particleEngine.js';
import { bindUiEvents } from './uiBindings.js';
import { createFieldRenderer } from './renderer.js';

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
  toneEnabled: false,
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

let syncUrlState = () => {};

const gl = fieldCanvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false });
if (!gl) {
  document.body.innerHTML = '<main class="fallback"><h1>WebGL is required for this prototype.</h1><p>Your browser or GPU settings did not provide a WebGL context.</p></main>';
  throw new Error('WebGL unavailable');
}

const { renderField } = createFieldRenderer({
  gl,
  fieldCanvas,
  controls,
  state,
  vertexSource,
  fragmentSource
});

const {
  ensureToneContext,
  updateToneFromControls,
  updateToneButtonIcon,
  toggleTone,
  syncAudioToRunState,
  useMicrophone,
  useAudioFile,
  getModeAmplitudes,
  drawFft
} = createAudioEngine({ controls, state });

const { initKnobs, syncKnobFromInput, setupInlineOutputEditor } = createControlHelpers({
  controls,
  ensureToneContext,
  updateOutputs
});

function setMaterial(name) {
  state.material = materialProfiles[name] || materialProfiles.steel;
  updateToneFromControls();
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

const { seedParticles, updateParticles, drawParticles } = createParticleEngine({
  controls,
  state,
  pctx,
  particleCanvas,
  waveAt
});

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

function syncShapePicker() {
  if (!controls.shapePicker) return;
  controls.shapePicker.querySelectorAll('.shape-chip').forEach((button) => {
    const active = button.dataset.shape === controls.shape.value;
    button.classList.toggle('is-selected', active);
    button.setAttribute('aria-checked', active ? 'true' : 'false');
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

function updatePlayPauseButton() {
  controls.playPause.textContent = state.running ? '⏸' : '▶';
  const label = state.running ? 'Pause simulation' : 'Play simulation';
  controls.playPause.setAttribute('aria-label', label);
  controls.playPause.setAttribute('title', label);
}

async function toggleRunning() {
  state.running = !state.running;
  updatePlayPauseButton();
  updateToneButtonIcon();
  updateToneFromControls();
  await syncAudioToRunState();
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
  syncUrlState();
}

function updateModeField(index, field, value) {
  state.modes[index][field] = value;
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
  renderField(getModeAmplitudes);
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

bindUiEvents({
  controls,
  setMaterial,
  updateOutputs,
  seedParticles,
  randomPreset,
  toggleTone,
  useMicrophone,
  useAudioFile,
  toggleRunning,
  syncUrlState: () => syncUrlState(),
  updateModeField
});

window.addEventListener('resize', resize);

const { syncToUrl } = initUrlState({ controls, state });
syncUrlState = syncToUrl;

renderModeEditor();
initKnobs();
setupInlineOutputEditor(controls.frequencyOut, controls.frequency, { suffix: 'Hz', decimals: 0 });
setupInlineOutputEditor(controls.amplitudeOut, controls.amplitude, { decimals: 2 });
setupInlineOutputEditor(controls.dampingOut, controls.damping, { decimals: 3 });
setMaterial(controls.material.value);
updatePlayPauseButton();
updateToneButtonIcon();
updateOutputs();
resize();
requestAnimationFrame(frame);
