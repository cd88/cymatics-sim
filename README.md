# Cymatics Field Lab

A dependency-free local prototype for cymatics-style wave and particle simulation.

## What it does

- Uses a WebGL fragment shader as a vibrating 2D surface.
- Generates standing waves from multiple editable modes.
- Extracts and visualizes nodal lines from near-zero displacement regions.
- Simulates sand-like particles that drift toward low-vibration/nodal regions.
- Exposes controls for frequency, amplitude, damping, material, plate shape, particles, and nodal extraction.
- Supports optional microphone or audio-file FFT mapping into mode amplitudes.

## Run locally

Because browsers restrict ES modules and microphone access from `file://`, run it from a local server.

### Option A: Python

```bash
cd cymatics-prototype
python3 -m http.server 5173
```

Then open:

```text
http://localhost:5173
```

### Option B: Node, no install

```bash
cd cymatics-prototype
npx serve .
```

## Notes

This is not a full finite-element plate solver. It is a real-time modal cymatics prototype: standing-wave modes are rendered on a shader surface, then a separate particle simulation estimates sand motion toward nodal lines.

The simulation is intentionally structured so the wave-field model, shader visualization, particle transport, and audio mapping are separate enough to replace later with a more physically exact finite-difference, FEM, or modal-analysis solver.
