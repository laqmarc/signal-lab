import { requiredConnections } from '../connections/patch.ts';
import type { Patch } from '../modules/definitions.ts';

export interface Level {
  id: string;
  revision: number;
  title: string;
  description: string;
  duration: number;
  target: Patch;
  initial: Patch;
}

export const firstSignal: Level = {
  id: 'first-signal',
  revision: 1,
  title: 'Primera freqüència',
  description: 'Un so misteriós. Tres màquines. Troba la connexió.',
  duration: 2,
  target: {
    parameters: { waveform: 'sawtooth', frequency: 220, cutoff: 900, resonance: 2.4 },
    connections: requiredConnections.map(c => ({ ...c })),
  },
  initial: {
    parameters: { waveform: 'sine', frequency: 330, cutoff: 2800, resonance: 0.8 },
    connections: [],
  },
};
