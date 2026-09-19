import { normalizeParameter, parameterAtPosition, parameterDefinitions, parameterPosition, type ParameterId } from '../modules/definitions.ts';

export function knobMarkup(id: ParameterId, value: number): string {
  const d = parameterDefinitions[id];
  const ticks = Array.from({ length: 25 }, (_, i) => {
    const a = (135 + i * 11.25) * Math.PI / 180;
    return `<line x1="${60 + Math.cos(a) * 49}" y1="${60 + Math.sin(a) * 49}" x2="${60 + Math.cos(a) * 54}" y2="${60 + Math.sin(a) * 54}" />`;
  }).join('');
  return `<div class="parameter" data-parameter="${id}">
    <label class="parameter-label" for="value-${id}">${d.label}</label>
    <div class="dial" role="slider" tabindex="0" aria-label="${d.label}" aria-valuemin="${d.min}" aria-valuemax="${d.max}" aria-valuenow="${value}" aria-describedby="hint-${id}">
      <svg class="dial-scale" viewBox="0 0 120 120" aria-hidden="true">${ticks}</svg>
      <div class="dial-body"><div class="dial-face"><span class="dial-indicator"></span></div></div>
    </div>
    <div class="parameter-value"><input id="value-${id}" type="number" inputmode="decimal" min="${d.min}" max="${d.max}" step="${d.step}" value="${value}" aria-label="Valor de ${d.label}" /><span>${d.unit}</span></div>
    <p class="parameter-hint" id="hint-${id}">${d.hint}</p>
  </div>`;
}

export function bindKnob(root: HTMLElement, id: ParameterId, initial: number, onChange: (value: number) => void): (value: number) => void {
  const control = root.querySelector<HTMLElement>(`[data-parameter="${id}"]`)!;
  const dial = control.querySelector<HTMLElement>('.dial')!;
  const input = control.querySelector<HTMLInputElement>('input')!;
  let value = initial;
  let drag: { y: number; position: number; pointer: number } | null = null;
  const update = (next: number, notify = false, preserveDraft = false) => {
    const previous = value;
    value = normalizeParameter(id, next);
    if (!preserveDraft) input.value = String(value);
    dial.style.setProperty('--angle', `${-135 + parameterPosition(id, value) * 270}deg`);
    dial.setAttribute('aria-valuenow', String(value));
    dial.setAttribute('aria-valuetext', `${value} ${parameterDefinitions[id].unit}`);
    if (notify && value !== previous) onChange(value);
  };
  dial.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    dial.focus();
    dial.setPointerCapture(event.pointerId);
    drag = { y: event.clientY, position: parameterPosition(id, value), pointer: event.pointerId };
    dial.classList.add('dragging');
  });
  dial.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const sensitivity = event.shiftKey ? 0.0006 : 0.004;
    const position = Math.max(0, Math.min(1, drag.position + (drag.y - event.clientY) * sensitivity));
    update(parameterAtPosition(id, position), true);
    drag = { y: event.clientY, position, pointer: event.pointerId };
  });
  const endDrag = () => { drag = null; dial.classList.remove('dragging'); };
  dial.addEventListener('pointerup', endDrag);
  dial.addEventListener('pointercancel', endDrag);
  dial.addEventListener('lostpointercapture', endDrag);
  dial.addEventListener('keydown', event => {
    const d = parameterDefinitions[id];
    const changes: Record<string, number> = { ArrowUp: d.step, ArrowRight: d.step, ArrowDown: -d.step, ArrowLeft: -d.step, PageUp: d.step * 10, PageDown: -d.step * 10 };
    if (event.key in changes) { event.preventDefault(); update(value + changes[event.key], true); }
    if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); update(event.key === 'Home' ? d.min : d.max, true); }
  });
  input.addEventListener('input', () => {
    const next = input.valueAsNumber;
    const { min, max } = parameterDefinitions[id];
    // Keep the text draft while typing, but commit valid values immediately.
    if (Number.isFinite(next) && next >= min && next <= max) update(next, true, true);
  });
  input.addEventListener('change', () => update(input.value === '' ? value : input.valueAsNumber, true));
  input.addEventListener('blur', () => update(input.value === '' ? value : input.valueAsNumber, true));
  input.addEventListener('keydown', event => { if (event.key === 'Enter') input.blur(); });
  update(initial);
  return next => update(next);
}
