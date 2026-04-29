# Cymatics Field Lab

A dependency-free local prototype for cymatics-style wave and particle simulation.

<img width="583" height="572" alt="Screenshot 2026-04-28 at 3 59 31 PM" src="https://github.com/user-attachments/assets/bb0a88be-e573-4a3e-8d71-0d1ccb42b2e4" />

<img width="1416" height="832" alt="image" src="https://github.com/user-attachments/assets/70beaad8-df67-4f14-9db6-9b7919cc9ad7" />

## What it does

- Uses a WebGL fragment shader as a vibrating 2D surface.
- Generates standing waves from multiple editable modes.
- Extracts and visualizes nodal lines from near-zero displacement regions.
- Simulates sand-like particles that drift toward low-vibration/nodal regions.
- Exposes controls for frequency, amplitude, damping, material, plate shape, particles, and nodal extraction.
- Supports optional microphone or audio-file FFT mapping into mode amplitudes.

## Run locally

Because browsers restrict ES modules and microphone access from `file://`, run it from a local server.

### Option A: Node, no install

```bash
cd cymatics-prototype
npx serve .
```

### Option B: Python

```bash
cd cymatics-prototype
python3 -m http.server 5173
```

Then open:

```text
http://localhost:5173
```

## Notes

This is not a full finite-element plate solver. It is a real-time modal cymatics prototype: standing-wave modes are rendered on a shader surface, then a separate particle simulation estimates sand motion toward nodal lines.

The simulation is intentionally structured so the wave-field model, shader visualization, particle transport, and audio mapping are separate enough to replace later with a more physically exact finite-difference, FEM, or modal-analysis solver.
