import { AudioEngine, createVoice } from '../src/audio/engine.ts';
import { clonePatch, requiredConnections } from '../src/connections/patch.ts';
import { firstSignal } from '../src/levels/first-signal.ts';
import { type Patch, waveforms } from '../src/modules/definitions.ts';

const render = async (patch: Patch, sampleRate = 44100) => {
  const context = new OfflineAudioContext(1, Math.round(sampleRate * 0.35), sampleRate);
  createVoice(context, patch, 0.3, 0);
  return (await context.startRendering()).getChannelData(0);
};
const peak = (data: Float32Array) => data.reduce((max, n) => Math.max(max, Math.abs(n)), 0);
const difference = (a: Float32Array, b: Float32Array) => a.reduce((max, n, i) => Math.max(max, Math.abs(n - b[i])), 0);
const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

document.querySelector<HTMLButtonElement>('#run')!.addEventListener('click', async event => {
  const button = event.currentTarget as HTMLButtonElement;
  button.disabled = true;
  document.querySelector('#results')!.replaceChildren();
  let passed = 0;
  let failed = 0;
  const check = async (label: string, fn: () => Promise<void>) => {
    const item = document.createElement('li');
    try { await fn(); item.textContent = `PASS — ${label}`; passed++; }
    catch (error) { item.textContent = `FAIL — ${label}: ${error}`; item.className = 'fail'; failed++; }
    document.querySelector('#results')!.append(item);
  };
  const target = await render(firstSignal.target);
  await check('El target genera un senyal finit i audible', async () => {
    assert(target.every(Number.isFinite) && peak(target) > 0.01 && peak(target) < 1, 'invalid signal');
  });
  await check('El mateix patch produeix exactament les mateixes mostres', async () => {
    assert(difference(target, await render(clonePatch(firstSignal.target))) === 0, 'samples differ');
  });
  await check('Sense algun dels cables, la sortida és silenci', async () => {
    for (const connections of [[], [requiredConnections[0]], [requiredConnections[1]]]) {
      assert(peak(await render({ ...clonePatch(firstSignal.target), connections })) === 0, 'unexpected output');
    }
  });
  await check('Les quatre formes d’ona produeixen senyals diferents', async () => {
    const signals = [];
    for (const waveform of waveforms) {
      const p = clonePatch(firstSignal.target); p.parameters.waveform = waveform;
      const signal = await render(p);
      assert(peak(signal) > 0.001, 'silent waveform');
      for (const other of signals) assert(difference(signal, other) > 0.001, 'identical waveforms');
      signals.push(signal);
    }
  });
  await check('Frequency, cutoff i resonance canvien realment l’àudio', async () => {
    for (const [key, value] of [['frequency', 440], ['cutoff', 3000], ['resonance', 5]] as const) {
      const p = clonePatch(firstSignal.target); p.parameters[key] = value;
      assert(difference(target, await render(p)) > 0.001, `${key} has no effect`);
    }
  });
  await check('Els extrems dels controls no saturen la sortida', async () => {
    for (const sampleRate of [44100, 48000]) for (const waveform of waveforms) {
      for (const frequency of [80, 220, 880]) for (const cutoff of [120, frequency, 6000]) {
        const p = clonePatch(firstSignal.target); p.parameters = { waveform, frequency, cutoff, resonance: 8 };
        const signal = await render(p, sampleRate);
        assert(signal.every(Number.isFinite) && peak(signal) < 1, `${waveform} clips at ${frequency}/${cutoff}`);
      }
    }
  });
  await check('La nota acaba i deixa silenci després del fade', async () => {
    assert(target.slice(Math.round(0.32 * 44100)).every(n => n === 0), 'voice did not end');
  });
  await check('Un patch incomplet no inicia cap veu en viu', async () => {
    const engine = new AudioEngine();
    assert(await engine.play(firstSignal.initial, 2, () => {}) === false, 'incomplete playback');
  });
  document.querySelector('#summary')!.textContent = `${passed} PASS / ${failed} FAIL`;
  button.disabled = false;
});
