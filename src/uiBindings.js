export function bindUiEvents({
  controls,
  setMaterial,
  updateOutputs,
  seedParticles,
  randomPreset,
  toggleTone,
  useMicrophone,
  useAudioFile,
  toggleRunning,
  syncUrlState,
  updateModeField
}) {
  controls.playPause.addEventListener('click', async () => {
    await toggleRunning();
  });

  controls.resetParticles.addEventListener('click', seedParticles);
  controls.snapPreset.addEventListener('click', randomPreset);
  controls.material.addEventListener('change', () => setMaterial(controls.material.value));
  controls.shape.addEventListener('change', () => {
    updateOutputs();
    seedParticles();
  });

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
    updateModeField(index, field, value);
    syncUrlState();
  });

  window.addEventListener('keydown', (event) => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.code === 'Space') {
      event.preventDefault();
      void toggleRunning();
      return;
    }
    if (event.key.toLowerCase() === 'm') {
      event.preventDefault();
      void toggleTone();
    }
  });

  for (const input of document.querySelectorAll('input, select')) {
    input.addEventListener('input', updateOutputs);
  }
}
