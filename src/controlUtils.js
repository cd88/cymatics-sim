const KNOB_ANGLE_MIN = -135;
const KNOB_ANGLE_MAX = 135;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function stepPrecision(step) {
  const str = String(step);
  const idx = str.indexOf('.');
  return idx === -1 ? 0 : str.length - idx - 1;
}

function setRangeValue(input, nextValue) {
  const min = Number(input.min);
  const max = Number(input.max);
  const step = Math.max(Number(input.step) || 1, 1e-9);
  const precision = stepPrecision(step);
  const snapped = min + Math.round((clamp(nextValue, min, max) - min) / step) * step;
  const limited = clamp(snapped, min, max);
  const value = limited.toFixed(precision);
  if (value !== input.value) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function inputToAngle(input) {
  const min = Number(input.min);
  const max = Number(input.max);
  const value = Number(input.value);
  const norm = (value - min) / Math.max(max - min, 1e-9);
  return KNOB_ANGLE_MIN + norm * (KNOB_ANGLE_MAX - KNOB_ANGLE_MIN);
}

export function createControlHelpers({ controls, ensureToneContext, updateOutputs }) {
  const knobElements = new Map();

  function syncKnobFromInput(input) {
    const knob = knobElements.get(input.id);
    if (!knob) return;
    knob.style.setProperty('--knob-angle', `${inputToAngle(input)}deg`);
    knob.setAttribute('aria-valuenow', input.value);
  }

  function bindKnob(knob) {
    const input = controls[knob.dataset.target];
    if (!input) return;
    knobElements.set(input.id, knob);
    syncKnobFromInput(input);

    let pointerId = null;
    let lastX = 0;
    let lastY = 0;

    knob.addEventListener('pointerdown', async (event) => {
      if (event.button !== 0) return;
      await ensureToneContext();
      pointerId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      knob.classList.add('dragging');
      knob.setPointerCapture(pointerId);
      event.preventDefault();
    });

    knob.addEventListener('pointermove', (event) => {
      if (pointerId !== event.pointerId) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;

      const min = Number(input.min);
      const max = Number(input.max);
      const sensitivity = (max - min) / 900;
      const clockwiseDelta = (dx - dy) * sensitivity;
      setRangeValue(input, Number(input.value) + clockwiseDelta);
    });

    const endDrag = (event) => {
      if (pointerId !== event.pointerId) return;
      knob.classList.remove('dragging');
      knob.releasePointerCapture(pointerId);
      pointerId = null;
    };

    knob.addEventListener('pointerup', endDrag);
    knob.addEventListener('pointercancel', endDrag);

    knob.addEventListener('wheel', (event) => {
      const step = Number(input.step) || (Number(input.max) - Number(input.min)) / 100;
      const mult = event.shiftKey ? 4 : 1;
      const direction = event.deltaY < 0 ? 1 : -1;
      setRangeValue(input, Number(input.value) + step * mult * direction);
      event.preventDefault();
    }, { passive: false });

    knob.addEventListener('keydown', (event) => {
      const step = Number(input.step) || (Number(input.max) - Number(input.min)) / 100;
      const mult = event.shiftKey ? 10 : 1;
      if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
        setRangeValue(input, Number(input.value) + step * mult);
        event.preventDefault();
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
        setRangeValue(input, Number(input.value) - step * mult);
        event.preventDefault();
      }
    });
  }

  function initKnobs() {
    document.querySelectorAll('.knob[data-target]').forEach((knob) => bindKnob(knob));
  }

  function setupInlineOutputEditor(output, input, { suffix = '', decimals = 2 } = {}) {
    let editing = false;
    output.classList.add('editable-output');

    const restore = () => {
      editing = false;
      updateOutputs();
    };

    output.addEventListener('click', () => {
      if (editing) return;
      editing = true;

      const editor = document.createElement('input');
      editor.type = 'text';
      editor.className = 'inline-value-editor';
      editor.value = Number(input.value).toFixed(decimals);

      output.textContent = '';
      output.append(editor);
      if (suffix) {
        const unit = document.createElement('span');
        unit.className = 'inline-unit';
        unit.textContent = ` ${suffix}`;
        output.append(unit);
      }

      editor.focus();
      editor.select();

      editor.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') editor.blur();
        if (event.key === 'Escape') restore();
      });

      editor.addEventListener('blur', () => {
        if (!editing) return;
        const parsed = Number(editor.value.trim());
        if (Number.isFinite(parsed)) {
          setRangeValue(input, parsed);
        }
        restore();
      });
    });
  }

  return {
    initKnobs,
    syncKnobFromInput,
    setupInlineOutputEditor
  };
}
