function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createAudioEngine({ controls, state }) {
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

  function updateToneButtonIcon() {
    controls.toneToggle.textContent = state.toneEnabled ? '🔊' : '🔇';
    controls.toneToggle.classList.toggle('is-dimmed', !state.running);
    const label = state.toneEnabled ? 'Disable tone' : 'Enable tone';
    controls.toneToggle.setAttribute('aria-label', label);
    controls.toneToggle.setAttribute('title', label);
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
    const audioActive = state.running && state.toneEnabled;
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

  function setupAudioGraph(sourceNode, context, label) {
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.78;
    sourceNode.connect(analyser);
    if (sourceNode.mediaElement) analyser.connect(context.destination);
    state.audio = { context, analyser, sourceNode, label };
    state.fft = new Uint8Array(analyser.frequencyBinCount);
    const toneLabel = state.toneEnabled ? ' + tone' : '';
    controls.audioStatus.textContent = `Audio: ${label}${toneLabel}`;
    controls.audioMap.checked = true;
  }

  async function toggleTone() {
    state.toneEnabled = !state.toneEnabled;
    if (state.toneEnabled && state.running) {
      await ensureToneContext();
    }
    if (state.tone) {
      state.tone.enabled = state.toneEnabled;
    }
    const baseLabel = state.audio?.label || 'manual';
    const toneLabel = state.toneEnabled ? ' + tone' : '';
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

      if (state.toneEnabled && !state.tone) {
        await ensureToneContext();
        state.tone.enabled = true;
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

  return {
    ensureToneContext,
    updateToneFromControls,
    updateToneButtonIcon,
    toggleTone,
    syncAudioToRunState,
    useMicrophone,
    useAudioFile,
    getModeAmplitudes,
    drawFft
  };
}
