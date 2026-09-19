import { clonePatch, isCompletePatch } from '../connections/patch.ts';
import { ports, type ModuleId, type Patch } from '../modules/definitions.ts';

export interface Voice { oscillator: OscillatorNode; gain: GainNode; disconnect: () => void }

// Shared by live playback and offline audio tests. No analyser or FFT is used.
export function createVoice(context: BaseAudioContext, patch: Patch, duration: number, start = context.currentTime): Voice {
  const oscillator = context.createOscillator();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  oscillator.type = patch.parameters.waveform;
  oscillator.frequency.setValueAtTime(patch.parameters.frequency, start);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(patch.parameters.cutoff, start);
  filter.Q.setValueAtTime(patch.parameters.resonance, start);

  const nodes: Record<ModuleId, AudioNode> = { oscillator, filter, output: gain };
  for (const cable of patch.connections) nodes[ports[cable.from].module].connect(nodes[ports[cable.to].module]);
  gain.connect(context.destination);
  // A fixed, short fade avoids clicks; identical for target and player.
  // 0.045 leaves headroom at the highest permitted filter resonance (Q = 8).
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.045, start + 0.025);
  gain.gain.setValueAtTime(0.045, start + duration - 0.08);
  gain.gain.linearRampToValueAtTime(0, start + duration);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.01);
  return { oscillator, gain, disconnect: () => { oscillator.disconnect(); filter.disconnect(); gain.disconnect(); } };
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private voice: Voice | null = null;
  private request = 0;

  async play(patch: Patch, duration: number, onEnded: () => void): Promise<boolean> {
    this.stop();
    if (!isCompletePatch(patch)) return false;
    const snapshot = clonePatch(patch);
    const request = this.request;
    this.context ??= new AudioContext();
    await this.context.resume();
    // A reset or newer play request may arrive while the context is resuming.
    if (request !== this.request) return false;
    const voice = createVoice(this.context, snapshot, duration);
    this.voice = voice;
    voice.oscillator.onended = () => {
      voice.disconnect();
      if (this.voice === voice) { this.voice = null; onEnded(); }
    };
    return true;
  }

  stop(): void {
    this.request++;
    const voice = this.voice;
    this.voice = null;
    if (voice && this.context) {
      const now = this.context.currentTime;
      voice.gain.gain.cancelAndHoldAtTime(now);
      voice.gain.gain.linearRampToValueAtTime(0, now + 0.015);
      voice.oscillator.stop(now + 0.02);
    }
  }
}
