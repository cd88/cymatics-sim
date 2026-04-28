function parseBool(value) {
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function normalizeRangeValue(input, raw) {
  const num = Number(raw);
  if (!Number.isFinite(num)) return input.value;

  const min = Number(input.min);
  const max = Number(input.max);
  const step = Number(input.step) || 1;
  const precision = (String(step).split('.')[1] || '').length;

  const clamped = Math.min(max, Math.max(min, num));
  const snapped = min + Math.round((clamped - min) / step) * step;
  return Math.min(max, Math.max(min, snapped)).toFixed(precision);
}

function encodeModes(modes) {
  return modes.map((mode) => `${mode.m},${mode.n},${Number(mode.amp).toFixed(2)}`).join(';');
}

function decodeModes(value, fallbackLength) {
  const chunks = String(value).split(';').map((part) => part.trim()).filter(Boolean);
  if (chunks.length < fallbackLength) return null;

  const parsed = chunks.slice(0, fallbackLength).map((chunk) => {
    const [mRaw, nRaw, ampRaw] = chunk.split(',');
    const m = Number(mRaw);
    const n = Number(nRaw);
    const amp = Number(ampRaw);
    if (!Number.isFinite(m) || !Number.isFinite(n) || !Number.isFinite(amp)) return null;
    return {
      m: Math.max(1, Math.min(14, Math.round(m))),
      n: Math.max(1, Math.min(14, Math.round(n))),
      amp: Math.max(0, Math.min(1.2, Math.round(amp * 100) / 100))
    };
  });

  return parsed.some((mode) => mode === null) ? null : parsed;
}

export function initUrlState({ controls, state }) {
  const tracked = [
    { el: controls.shape, key: 'shape', kind: 'text' },
    { el: controls.material, key: 'material', kind: 'text' },
    { el: controls.frequency, key: 'frequency', kind: 'range' },
    { el: controls.amplitude, key: 'amplitude', kind: 'range' },
    { el: controls.damping, key: 'damping', kind: 'range' },
    { el: controls.threshold, key: 'threshold', kind: 'range' },
    { el: controls.sharpness, key: 'sharpness', kind: 'range' },
    { el: controls.showNodal, key: 'showNodal', kind: 'check' },
    { el: controls.showHeat, key: 'showHeat', kind: 'check' },
    { el: controls.showParticles, key: 'showParticles', kind: 'check' },
    { el: controls.particleCount, key: 'particleCount', kind: 'range' },
    { el: controls.particleDamping, key: 'particleDamping', kind: 'range' },
    { el: controls.nodalPull, key: 'nodalPull', kind: 'range' },
    { el: controls.jitter, key: 'jitter', kind: 'range' },
    { el: controls.audioMap, key: 'audioMap', kind: 'check' }
  ];

  const applyFromUrl = () => {
    const params = new URLSearchParams(window.location.search);

    tracked.forEach(({ el, key, kind }) => {
      const raw = params.get(key);
      if (raw == null) return;

      if (kind === 'check') {
        el.checked = parseBool(raw);
        return;
      }

      if (kind === 'range') {
        el.value = normalizeRangeValue(el, raw);
        return;
      }

      const hasOption = Array.from(el.options || []).some((option) => option.value === raw);
      if (hasOption) el.value = raw;
    });

    const urlModes = params.get('modes');
    if (urlModes) {
      const parsedModes = decodeModes(urlModes, state.modes.length);
      if (parsedModes) {
        state.modes = parsedModes;
      }
    }
  };

  const syncToUrl = () => {
    const params = new URLSearchParams(window.location.search);

    tracked.forEach(({ el, key, kind }) => {
      if (kind === 'check') {
        params.set(key, el.checked ? '1' : '0');
      } else {
        params.set(key, el.value);
      }
    });

    params.set('modes', encodeModes(state.modes));

    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}${window.location.hash}` : `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState(null, '', nextUrl);
  };

  applyFromUrl();
  syncToUrl();

  tracked.forEach(({ el }) => {
    el.addEventListener('input', syncToUrl);
    el.addEventListener('change', syncToUrl);
  });

  return { syncToUrl };
}
