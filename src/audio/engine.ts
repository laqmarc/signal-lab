import { clonePatch, isCompletePatch } from '../connections/patch.ts';
import { modulesForPatch, parameterValue, ports, type ModuleId, type Parameters, type Patch } from '../modules/definitions.ts';

export interface Voice {
  oscillator: OscillatorNode;
  ended: ConstantSourceNode;
  gain: GainNode;
  update: (parameters: Parameters, at?: number) => void;
  stop: (at: number) => void;
  disconnect: () => void;
}

// Seeded textures make repeated target/player renders directly comparable.
function texture(context: BaseAudioContext, seconds: number, decay = false): AudioBuffer {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate);
  const samples = buffer.getChannelData(0);
  let seed = 123456789;
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    samples[i] = (seed / 2147483648 - 1) * (decay ? (1 - i / samples.length) ** 3 : 1);
  }
  return buffer;
}
function curve(drive: number): Float32Array<ArrayBuffer> {
  return Float32Array.from({ length: 4096 }, (_, i) => Math.tanh((i / 4095 * 2 - 1) * drive) / Math.tanh(drive));
}

// One graph builder for target, player and OfflineAudioContext verification.
export function createVoice(context: BaseAudioContext, patch: Patch, duration: number, start = context.currentTime): Voice {
  const modules = modulesForPatch(patch);
  const has = (id: ModuleId) => modules.includes(id);
  const p = patch.parameters;
  const value = (id: ParametersKey) => parameterValue(p, id);
  const all: AudioNode[] = [];
  const keep = <T extends AudioNode>(node: T): T => { all.push(node); return node; };
  const oscillator = keep(context.createOscillator());
  const filter = keep(context.createBiquadFilter());
  const gain = keep(context.createGain());
  const gate = keep(context.createGain());
  const ended = keep(context.createConstantSource());
  ended.offset.value = 0;
  const sources: AudioScheduledSourceNode[] = [ended];
  const end = start + duration;
  const sourceEnd = end - (has('delay') || has('reverb') ? Math.min(1.4, duration * 0.35) : 0);
  oscillator.type = p.waveform;
  oscillator.frequency.setValueAtTime(p.frequency, start);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(p.cutoff, start);
  filter.Q.setValueAtTime(p.resonance, start);
  const units: Partial<Record<ModuleId, { input: AudioNode; output: AudioNode }>> = {};
  const unit = (id: ModuleId, input: AudioNode, output = input) => { units[id] = { input, output }; };
  unit('filter', filter); unit('output', gain);
  gate.gain.setValueAtTime(1, start);
  gate.gain.setValueAtTime(1, Math.max(start, sourceEnd - 0.025));
  gate.gain.linearRampToValueAtTime(0, sourceEnd);
  if (has('oscillator')) { oscillator.connect(gate); unit('oscillator', gate); sources.push(oscillator); }
  let noiseGain: GainNode | undefined;
  if (has('noise')) {
    const noise = keep(context.createBufferSource());
    noise.buffer = texture(context, 2); noise.loop = true;
    noiseGain = keep(context.createGain()); noiseGain.gain.value = value('noiseLevel');
    noise.connect(noiseGain).connect(gate); unit('noise', gate); sources.push(noise);
  }
  if (has('envelope')) {
    const envelope = keep(context.createGain());
    const attackEnd = start + Math.min(value('attack'), Math.max(0.001, sourceEnd - start - 0.05));
    const release = Math.min(value('release'), sourceEnd - attackEnd);
    // A brief hold makes both attack and release clearly audible.
    const releaseStart = has('sequencer') ? sourceEnd - release : Math.min(attackEnd + 0.35, sourceEnd - release);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(1, attackEnd);
    envelope.gain.setValueAtTime(1, releaseStart);
    envelope.gain.linearRampToValueAtTime(0, releaseStart + release);
    unit('envelope', envelope);
  }
  let shaper: WaveShaperNode | undefined;
  let lastDrive = value('drive');
  if (has('distortion')) {
    shaper = keep(context.createWaveShaper()); shaper.curve = curve(value('drive')); shaper.oversample = '2x'; unit('distortion', shaper);
  }
  const mixUnits: { kind: 'delay' | 'reverb'; dry: GainNode; wet: GainNode }[] = [];
  let delay: DelayNode | undefined;
  for (const kind of ['delay', 'reverb'] as const) if (has(kind)) {
    const input = keep(context.createGain()), output = keep(context.createGain());
    const dry = keep(context.createGain()), wet = keep(context.createGain());
    const mix = value(kind === 'delay' ? 'delayMix' : 'reverbMix');
    dry.gain.value = 1 - mix; wet.gain.value = mix;
    input.connect(dry).connect(output);
    if (kind === 'delay') {
      delay = keep(context.createDelay(1)); delay.delayTime.value = value('delayTime');
      const feedback = keep(context.createGain()); feedback.gain.value = 0.3;
      input.connect(delay); delay.connect(feedback).connect(delay); delay.connect(wet);
    } else {
      const reverb = keep(context.createConvolver()); reverb.buffer = texture(context, value('reverbDecay'), true);
      input.connect(reverb).connect(wet);
    }
    wet.connect(output); unit(kind, input, output); mixUnits.push({ kind, dry, wet });
  }
  let lfo: OscillatorNode | undefined, depth: GainNode | undefined;
  if (has('lfo')) {
    lfo = keep(context.createOscillator()); depth = keep(context.createGain());
    lfo.frequency.value = value('lfoRate'); depth.gain.value = value('lfoDepth');
    lfo.connect(depth); unit('lfo', depth); sources.push(lfo);
  }
  if (has('sequencer')) {
    const sequence = keep(context.createConstantSource());
    const beat = 60 / value('tempo');
    for (let step = 0; start + step * beat < end; step++) {
      sequence.offset.setValueAtTime(value(`step${step % 4 + 1}` as ParametersKey) * 100, start + step * beat);
    }
    unit('sequencer', sequence); sources.push(sequence);
  }
  for (const cable of patch.connections) {
    const from = units[ports[cable.from].module]?.output;
    if (cable.to === 'filter:mod') from?.connect(filter.frequency);
    else if (cable.to === 'oscillator:pitch') from?.connect(oscillator.detune);
    else { const to = units[ports[cable.to].module]?.input; if (from && to) from.connect(to); }
  }
  gain.connect(context.destination);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.045, start + Math.min(0.025, duration / 4));
  gain.gain.setValueAtTime(0.045, end - Math.min(0.08, duration / 4));
  gain.gain.linearRampToValueAtTime(0, end);
  for (const source of sources) { source.start(start); source.stop(end + 0.01); }
  return {
    oscillator, ended, gain,
    update: (parameters, at = context.currentTime) => {
      oscillator.type = parameters.waveform;
      const smooth = (param: AudioParam | undefined, v: number) => {
        if (!param) return;
        param.cancelAndHoldAtTime(at); param.setTargetAtTime(v, at, 0.008);
      };
      smooth(oscillator.frequency, parameters.frequency); smooth(filter.frequency, parameters.cutoff); smooth(filter.Q, parameters.resonance);
      smooth(noiseGain?.gain, parameterValue(parameters, 'noiseLevel'));
      smooth(lfo?.frequency, parameterValue(parameters, 'lfoRate')); smooth(depth?.gain, parameterValue(parameters, 'lfoDepth'));
      smooth(delay?.delayTime, parameterValue(parameters, 'delayTime'));
      if (shaper && parameterValue(parameters, 'drive') !== lastDrive) { lastDrive = parameterValue(parameters, 'drive'); shaper.curve = curve(lastDrive); }
      for (const mix of mixUnits) {
        const amount = parameterValue(parameters, mix.kind === 'delay' ? 'delayMix' : 'reverbMix');
        smooth(mix.dry.gain, 1 - amount); smooth(mix.wet.gain, amount);
      }
    },
    stop: at => { for (const source of sources) source.stop(at); },
    disconnect: () => { for (const node of all) node.disconnect(); },
  };
}
type ParametersKey = import('../modules/definitions.ts').ParameterId;

export class AudioEngine {
  private context: AudioContext | null = null;
  private voice: Voice | null = null;
  private request = 0;
  private pendingPatch: Patch | null = null;
  async play(patch: Patch, duration: number, onEnded: () => void): Promise<boolean> {
    this.stop();
    if (!isCompletePatch(patch)) return false;
    const snapshot = clonePatch(patch);
    this.pendingPatch = snapshot;
    const request = this.request;
    this.context ??= new AudioContext();
    await this.context.resume();
    if (request !== this.request) return false;
    const voice = createVoice(this.context, snapshot, duration);
    this.pendingPatch = null; this.voice = voice;
    voice.ended.onended = () => { voice.disconnect(); if (this.voice === voice) { this.voice = null; onEnded(); } };
    return true;
  }
  updateParameters(parameters: Parameters): void {
    if (this.pendingPatch) this.pendingPatch.parameters = { ...parameters };
    this.voice?.update(parameters);
  }
  stop(): void {
    this.request++; this.pendingPatch = null;
    const voice = this.voice; this.voice = null;
    if (voice && this.context) {
      const now = this.context.currentTime;
      voice.gain.gain.cancelAndHoldAtTime(now); voice.gain.gain.linearRampToValueAtTime(0, now + 0.015); voice.stop(now + 0.02);
    }
  }
  dispose(): void { this.stop(); if (this.context) void this.context.close(); this.context = null; }
}
