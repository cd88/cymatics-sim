export function createFieldRenderer({ gl, fieldCanvas, controls, state, vertexSource, fragmentSource }) {
  const shapeMap = { circle: 0, square: 1, 'rounded-square': 2, triangle: 3, hex: 4 };

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

  function renderField(getModeAmplitudes) {
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

  return { renderField };
}
