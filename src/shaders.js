export const vertexSource = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export const fragmentSource = `
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
