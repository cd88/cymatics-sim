export function createParticleEngine({ controls, state, pctx, particleCanvas, waveAt }) {
  function sdEquilateralTriangleJS(px, py) {
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
    const py = 1 - y * 2;
    const shape = controls.shape.value;
    if (shape === 'circle') return Math.hypot(px, py) < 0.92;
    if (shape === 'square') return Math.max(Math.abs(px), Math.abs(py)) < 0.86;
    if (shape === 'rounded-square') {
      const dx = Math.max(Math.abs(px) - 0.66, 0);
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
    const pdampMin = Number(controls.particleDamping.min);
    const pdampMax = Number(controls.particleDamping.max);
    const jitter = Number(controls.jitter.value);
    const eps = 1 / Math.max(state.width, state.height);
    const step = Math.min(dt, 0.033) * 52;
    const surfDamping = Number(controls.damping.value) + (1 - state.material.decay) * 0.06;
    // Invert slider semantics so higher value means stronger damping.
    const particleRetention = Math.max(0, (pdampMin + pdampMax) - pdamp - surfDamping);

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
      p.vx *= particleRetention;
      p.vy *= particleRetention;
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

  return {
    seedParticles,
    updateParticles,
    drawParticles
  };
}
