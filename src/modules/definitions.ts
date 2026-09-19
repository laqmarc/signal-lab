export const waveforms = ['sine', 'square', 'sawtooth', 'triangle'] as const;
export type Waveform = (typeof waveforms)[number];
export type ModuleId = 'oscillator' | 'filter' | 'output';
export type PortId = 'oscillator:out' | 'filter:in' | 'filter:out' | 'output:in';
export type ParameterId = 'frequency' | 'cutoff' | 'resonance';

export interface Parameters {
  waveform: Waveform;
  frequency: number;
  cutoff: number;
  resonance: number;
}

export interface Connection { from: PortId; to: PortId }
export interface Patch { parameters: Parameters; connections: Connection[] }
export interface ParameterDefinition {
  id: ParameterId;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  logarithmic: boolean;
}

export const parameterDefinitions: Record<ParameterId, ParameterDefinition> = {
  frequency: { id: 'frequency', label: 'FREQUENCY', hint: 'De greu a agut', min: 80, max: 880, step: 1, unit: 'Hz', logarithmic: true },
  cutoff: { id: 'cutoff', label: 'CUTOFF', hint: 'De fosc a brillant', min: 120, max: 6000, step: 10, unit: 'Hz', logarithmic: true },
  resonance: { id: 'resonance', label: 'RESONANCE', hint: 'Dona caràcter al filtre', min: 0.1, max: 8, step: 0.1, unit: 'Q', logarithmic: false },
};

export const moduleDefinitions = [
  { id: 'oscillator', title: 'OSCILLATOR', description: 'Crea el so', ports: ['oscillator:out'], parameters: ['frequency'] },
  { id: 'filter', title: 'FILTER', description: 'Dona forma al so', ports: ['filter:in', 'filter:out'], parameters: ['cutoff', 'resonance'] },
  { id: 'output', title: 'OUTPUT', description: 'Escolta el resultat', ports: ['output:in'], parameters: [] },
] as const;

export const ports: Record<PortId, { module: ModuleId; direction: 'in' | 'out'; label: string }> = {
  'oscillator:out': { module: 'oscillator', direction: 'out', label: 'Sortida OSCILLATOR' },
  'filter:in': { module: 'filter', direction: 'in', label: 'Entrada FILTER' },
  'filter:out': { module: 'filter', direction: 'out', label: 'Sortida FILTER' },
  'output:in': { module: 'output', direction: 'in', label: 'Entrada OUTPUT' },
};

export function normalizeParameter(id: ParameterId, value: number): number {
  const { min, max, step } = parameterDefinitions[id];
  if (!Number.isFinite(value)) return min;
  const clamped = Math.min(max, Math.max(min, value));
  return Number((Math.round((clamped - min) / step) * step + min).toFixed(3));
}

export function parameterPosition(id: ParameterId, value: number): number {
  const { min, max, logarithmic } = parameterDefinitions[id];
  return logarithmic ? Math.log(value / min) / Math.log(max / min) : (value - min) / (max - min);
}

export function parameterAtPosition(id: ParameterId, position: number): number {
  const { min, max, logarithmic } = parameterDefinitions[id];
  const ratio = Math.max(0, Math.min(1, position));
  return normalizeParameter(id, logarithmic ? min * (max / min) ** ratio : min + ratio * (max - min));
}
