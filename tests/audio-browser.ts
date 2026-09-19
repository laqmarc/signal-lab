import { AudioEngine, createVoice } from '../src/audio/engine.ts';
import { clonePatch, requiredConnections } from '../src/connections/patch.ts';
import { levels } from '../src/levels/catalog.ts';
import { parameterIdsForPatch, parameterDefinitions, parameterValue } from '../src/modules/definitions.ts';
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
  await check('Ajustar cada knob modifica la nota sense reiniciar-la ni allargar-la', async () => {
    for (const [key, value] of [['frequency', 440], ['cutoff', 3000], ['resonance', 5]] as const) {
      const context = new OfflineAudioContext(1, Math.round(44100 * 0.35), 44100);
      const voice = createVoice(context, firstSignal.target, 0.3, 0);
      voice.update({ ...firstSignal.target.parameters, [key]: value }, 0.12);
      const signal = (await context.startRendering()).getChannelData(0);
      const beforeDifference = difference(target.slice(0, 4000), signal.slice(0, 4000));
      // Adding automation can change Chromium's float processing by ~1e-7.
      // This tolerance remains well below one 16-bit PCM quantization step.
      assert(beforeDifference < 0.000001, `${key} changed the audio before the edit (max difference: ${beforeDifference})`);
      assert(difference(target.slice(7000, 11000), signal.slice(7000, 11000)) > 0.001, `${key} did not update`);
      assert(signal.slice(Math.round(0.32 * 44100)).every(n => n === 0), `${key} extended the note`);
      assert(signal.every(Number.isFinite) && peak(signal) < 1, `${key} produced invalid audio`);
    }
  });
  await check('Canviar la forma d’ona actualitza la veu existent', async () => {
    const context = new OfflineAudioContext(1, Math.round(44100 * 0.35), 44100);
    const voice = createVoice(context, firstSignal.target, 0.3, 0);
    voice.update({ ...firstSignal.target.parameters, waveform: 'square' }, 0);
    assert(voice.oscillator.type === 'square', 'waveform did not change');
    const signal = (await context.startRendering()).getChannelData(0);
    assert(difference(target, signal) > 0.001 && peak(signal) < 1, 'waveform output did not change');
  });
  const renderLevel = async (patch: Patch, duration: number) => {
    const context = new OfflineAudioContext(1, Math.ceil(22050 * (duration + 0.1)), 22050);
    createVoice(context, patch, duration, 0);
    return (await context.startRendering()).getChannelData(0);
  };
  await check('Els 24 objectius són audibles, finits, sense saturació i acaben en silenci', async () => {
    for (const level of levels) {
      const signal = await renderLevel(level.target, level.duration);
      assert(signal.every(Number.isFinite) && peak(signal) > 0.001 && peak(signal) < 1, level.id);
      assert(peak(signal.slice(Math.ceil((level.duration + 0.03) * 22050))) === 0, `${level.id} leaves a tail`);
    }
  });
  await check('Noise, reverb i totes les combinacions són reproduïbles mostra a mostra', async () => {
    for (const level of levels.slice(4)) {
      const a = await renderLevel(level.target, level.duration);
      const b = await renderLevel(clonePatch(level.target), level.duration);
      assert(difference(a, b) < 0.000001, `${level.id}: ${difference(a, b)}`);
    }
  });
  await check('Cada control nou modifica realment les mostres del seu nivell', async () => {
    const checked = new Set<string>(['frequency', 'cutoff', 'resonance']);
    for (const level of levels) for (const id of parameterIdsForPatch(level.target)) {
      if (checked.has(id)) continue;
      checked.add(id);
      const patch = clonePatch(level.target), def = parameterDefinitions[id];
      patch.parameters[id] = parameterValue(patch.parameters, id) === def.max ? def.min : def.max;
      const a = await renderLevel(level.target, level.duration), b = await renderLevel(patch, level.duration);
      assert(difference(a, b) > 0.00001, `${id} has no audible effect`);
    }
    assert(checked.size === Object.keys(parameterDefinitions).length, 'a control was not checked');
  });
  await check('El motor bloqueja també els cables de control incomplets', async () => {
    for (const level of levels.filter(l => l.target.connections.some(c => c.to === 'filter:mod' || c.to === 'oscillator:pitch'))) {
      for (const cable of level.target.connections) {
        const patch = clonePatch(level.target); patch.connections = patch.connections.filter(c => c !== patch.connections.find(p => p.from === cable.from));
        const engine = new AudioEngine();
        assert(await engine.play(patch, level.duration, () => {}) === false, level.id);
        engine.dispose();
      }
    }
  });
  await check('El final de les veus en viu notifica un cop; aturar o disposar cancel·la les notificacions', async () => {
    const engine = new AudioEngine();
    let count = 0;
    try {
      await engine.play(levels[6].target, 0.15, () => { count++; });
      await new Promise(resolve => setTimeout(resolve, 300));
      assert(count === 1, `noise ended ${count} times`);
      await engine.play(levels[8].target, 1, () => { count++; });
      engine.stop();
      await new Promise(resolve => setTimeout(resolve, 60));
      assert(count === 1, 'stop invoked completion');
      await engine.play(levels[16].target, 1, () => { count++; });
      engine.dispose();
      await new Promise(resolve => setTimeout(resolve, 60));
      assert(count === 1, 'dispose invoked completion');
    } finally { engine.dispose(); }
  });
  document.querySelector('#summary')!.textContent = `${passed} PASS / ${failed} FAIL`;
  button.disabled = false;
});
