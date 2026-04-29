# Cymatics Field Lab

A dependency-free local prototype for cymatics-style wave and particle simulation.

<img width="1217" height="831" alt="Screenshot 2026-04-29 at 2 06 15 PM" src="https://github.com/user-attachments/assets/21e873de-329a-4d7e-b6d9-61bb1d7f1cc1" />

  ---
  
Sample Screenshot 1        |  Sample Screenshot 2
:-------------------------:|:-------------------------:
<img width="600" height="588" alt="Screenshot 1 - random mode" src="https://github.com/user-attachments/assets/bb0a88be-e573-4a3e-8d71-0d1ccb42b2e4" style="display:inline;"/> | <img width="592" height="588" alt="Screenshot 2 - random mode" src="https://github.com/user-attachments/assets/aef9b751-838a-4b74-ab0f-8e0492eb9b8f" style="display:inline;"/>

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
cd cymatics-sim
npx serve .
```

### Option B: Python

```bash
cd cymatics-sim
python3 -m http.server 5173
```

Then open:

```text
http://localhost:5173
```

## Notes

This is not a full finite-element plate solver. It is a real-time modal cymatics prototype: standing-wave modes are rendered on a shader surface, then a separate particle simulation estimates sand motion toward nodal lines.

The simulation is intentionally structured so the wave-field model, shader visualization, particle transport, and audio mapping are separate enough to replace later with a more physically exact finite-difference, FEM, or modal-analysis solver.

