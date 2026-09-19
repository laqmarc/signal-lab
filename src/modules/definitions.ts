export const waveforms = ['sine', 'square', 'sawtooth', 'triangle'] as const;
export type Waveform = (typeof waveforms)[number];
export type ModuleId = 'oscillator' | 'filter' | 'output' | 'envelope' | 'lfo' | 'noise' | 'distortion' | 'delay' | 'reverb' | 'sequencer';
export type ParameterId = 'frequency' | 'cutoff' | 'resonance' | 'attack' | 'release' | 'lfoRate' | 'lfoDepth' | 'noiseLevel' | 'drive' | 'delayTime' | 'delayMix' | 'reverbDecay' | 'reverbMix' | 'tempo' | 'step1' | 'step2' | 'step3' | 'step4';
export type Parameters = { waveform: Waveform; frequency: number; cutoff: number; resonance: number } & Partial<Record<Exclude<ParameterId, 'frequency' | 'cutoff' | 'resonance'>, number>>;
export interface ParameterDefinition {
  id: ParameterId; label: string; name: string; hint: string; min: number; max: number;
  step: number; unit: string; logarithmic: boolean; initial: number;
}
const define = (id: ParameterId, label: string, name: string, hint: string, min: number, max: number, step: number, unit: string, initial: number, logarithmic = false): ParameterDefinition => ({ id, label, name, hint, min, max, step, unit, initial, logarithmic });
export const parameterDefinitions: Record<ParameterId, ParameterDefinition> = {
  frequency: define('frequency', 'FREQUENCY', 'To', 'De greu a agut', 80, 880, 1, 'Hz', 330, true),
  cutoff: define('cutoff', 'CUTOFF', 'Brillantor', 'De fosc a brillant', 120, 6000, 10, 'Hz', 2800, true),
  resonance: define('resonance', 'RESONANCE', 'Caràcter', 'Dona caràcter al filtre', 0.1, 8, 0.1, 'Q', 0.8),
  attack: define('attack', 'ATTACK', 'Entrada', 'Com de lent apareix el so', 0.01, 1, 0.01, 's', 0.05),
  release: define('release', 'RELEASE', 'Sortida', 'Com de lent desapareix', 0.05, 1.5, 0.05, 's', 0.2),
  lfoRate: define('lfoRate', 'LFO RATE', 'Velocitat del moviment', 'Oscil·lacions per segon', 0.5, 8, 0.1, 'Hz', 1),
  lfoDepth: define('lfoDepth', 'LFO DEPTH', 'Amplitud del moviment', 'Quant s’obre i es tanca', 100, 1800, 50, 'Hz', 200),
  noiseLevel: define('noiseLevel', 'NOISE LEVEL', 'Intensitat del soroll', 'De murmuri a vent', 0.1, 1, 0.05, '', 0.5),
  drive: define('drive', 'DRIVE', 'Rugositat', 'De net a saturat', 1, 12, 0.5, '×', 2),
  delayTime: define('delayTime', 'DELAY TIME', 'Distància de l’eco', 'Temps entre repeticions', 0.1, 0.8, 0.05, 's', 0.2),
  delayMix: define('delayMix', 'ECHO MIX', 'Quantitat d’eco', 'Quant se sent la repetició', 0.1, 0.7, 0.05, '', 0.2),
  reverbDecay: define('reverbDecay', 'DECAY', 'Mida de l’espai', 'De sala petita a gran', 0.3, 2.5, 0.1, 's', 0.5),
  reverbMix: define('reverbMix', 'SPACE MIX', 'Quantitat d’espai', 'De proper a llunyà', 0.1, 0.7, 0.05, '', 0.2),
  tempo: define('tempo', 'TEMPO', 'Velocitat de la seqüència', 'Polsos per minut', 60, 180, 5, 'BPM', 120),
  step1: define('step1', 'STEP 1', 'Nota 1', 'Semitons respecte al to base', -12, 12, 1, 'st', 0),
  step2: define('step2', 'STEP 2', 'Nota 2', 'Semitons respecte al to base', -12, 12, 1, 'st', 0),
  step3: define('step3', 'STEP 3', 'Nota 3', 'Semitons respecte al to base', -12, 12, 1, 'st', 0),
  step4: define('step4', 'STEP 4', 'Nota 4', 'Semitons respecte al to base', -12, 12, 1, 'st', 0),
};
interface PortDefinition { module: ModuleId; direction: 'in' | 'out'; kind: 'audio' | 'control'; label: string }
export const ports = {
  'oscillator:out': { module: 'oscillator', direction: 'out', kind: 'audio', label: 'Sortida OSCILLATOR' },
  'oscillator:pitch': { module: 'oscillator', direction: 'in', kind: 'control', label: 'Entrada PITCH d’OSCILLATOR' },
  'filter:in': { module: 'filter', direction: 'in', kind: 'audio', label: 'Entrada FILTER' },
  'filter:out': { module: 'filter', direction: 'out', kind: 'audio', label: 'Sortida FILTER' },
  'filter:mod': { module: 'filter', direction: 'in', kind: 'control', label: 'Entrada MOD de FILTER' },
  'output:in': { module: 'output', direction: 'in', kind: 'audio', label: 'Entrada OUTPUT' },
  'envelope:in': { module: 'envelope', direction: 'in', kind: 'audio', label: 'Entrada ENVELOPE' },
  'envelope:out': { module: 'envelope', direction: 'out', kind: 'audio', label: 'Sortida ENVELOPE' },
  'lfo:out': { module: 'lfo', direction: 'out', kind: 'control', label: 'Sortida LFO' },
  'noise:out': { module: 'noise', direction: 'out', kind: 'audio', label: 'Sortida NOISE' },
  'distortion:in': { module: 'distortion', direction: 'in', kind: 'audio', label: 'Entrada DISTORTION' },
  'distortion:out': { module: 'distortion', direction: 'out', kind: 'audio', label: 'Sortida DISTORTION' },
  'delay:in': { module: 'delay', direction: 'in', kind: 'audio', label: 'Entrada DELAY' },
  'delay:out': { module: 'delay', direction: 'out', kind: 'audio', label: 'Sortida DELAY' },
  'reverb:in': { module: 'reverb', direction: 'in', kind: 'audio', label: 'Entrada REVERB' },
  'reverb:out': { module: 'reverb', direction: 'out', kind: 'audio', label: 'Sortida REVERB' },
  'sequencer:out': { module: 'sequencer', direction: 'out', kind: 'control', label: 'Sortida SEQUENCER' },
} as const satisfies Record<string, PortDefinition>;
export type PortId = keyof typeof ports;
export interface Connection { from: PortId; to: PortId }
export interface Patch { parameters: Parameters; connections: Connection[]; modules?: ModuleId[] }
export interface ModuleDefinition {
  id: ModuleId; title: string; description: string; category: string; lesson: string; parameters: ParameterId[]; color: string;
}
export const moduleDefinitions: ModuleDefinition[] = [
  { id: 'oscillator', title: 'OSCILLATOR', description: 'Crea el so', category: 'SOURCE', lesson: 'Tria la forma d’ona i el to.', parameters: ['frequency'], color: '#d9b16f' },
  { id: 'filter', title: 'FILTER', description: 'Dona forma al so', category: 'SHAPE', lesson: 'Deixa passar els greus i suavitza els aguts.', parameters: ['cutoff', 'resonance'], color: '#a6c9d3' },
  { id: 'envelope', title: 'ENVELOPE', description: 'Dibuixa l’entrada i la sortida', category: 'DYNAMICS', lesson: 'ATTACK fa créixer el so. RELEASE el deixa desaparèixer.', parameters: ['attack', 'release'], color: '#dfa686' },
  { id: 'lfo', title: 'LFO', description: 'Mou el filtre automàticament', category: 'CONTROL', lesson: 'Connecta la sortida violeta a MOD de FILTER. No produeix so per si sol.', parameters: ['lfoRate', 'lfoDepth'], color: '#b6a1dc' },
  { id: 'noise', title: 'NOISE', description: 'Genera vent i textures', category: 'SOURCE', lesson: 'El soroll blanc no té una nota. Passa’l pel filtre per canviar-ne el color.', parameters: ['noiseLevel'], color: '#d5c3a4' },
  { id: 'distortion', title: 'DISTORTION', description: 'Afegeix rugositat', category: 'TEXTURE', lesson: 'DRIVE transforma una ona suau en un so aspre i ric.', parameters: ['drive'], color: '#db937b' },
  { id: 'delay', title: 'DELAY', description: 'Crea un eco', category: 'SPACE', lesson: 'TIME separa les repeticions. MIX controla quant eco escoltes.', parameters: ['delayTime', 'delayMix'], color: '#8dbccc' },
  { id: 'reverb', title: 'REVERB', description: 'Posa el so en una sala', category: 'SPACE', lesson: 'DECAY allarga la sala. MIX acosta o allunya el so.', parameters: ['reverbDecay', 'reverbMix'], color: '#a6b6df' },
  { id: 'sequencer', title: 'SEQUENCER', description: 'Ordena quatre notes', category: 'CONTROL', lesson: 'Connecta’l a PITCH d’OSCILLATOR. Cada pas canvia el to en semitons.', parameters: ['tempo', 'step1', 'step2', 'step3', 'step4'], color: '#c3a2dc' },
  { id: 'output', title: 'OUTPUT', description: 'Escolta el resultat', category: 'LISTEN', lesson: 'El camí d’àudio ha d’arribar aquí.', parameters: [], color: '#cee99a' },
];
export const baseModules: ModuleId[] = ['oscillator', 'filter', 'output'];
export const modulesForPatch = (patch: Patch): ModuleId[] => patch.modules ?? baseModules;
export const moduleDefinition = (id: ModuleId) => moduleDefinitions.find(module => module.id === id)!;
export const parameterIdsForPatch = (patch: Patch): ParameterId[] => modulesForPatch(patch).flatMap(id => moduleDefinition(id).parameters);
export const parameterValue = (p: Parameters, id: ParameterId): number => p[id] ?? parameterDefinitions[id].initial;
export function normalizeParameter(id: ParameterId, value: number): number {
  const { min, max, step } = parameterDefinitions[id];
  if (!Number.isFinite(value)) return min;
  return Number((Math.round((Math.min(max, Math.max(min, value)) - min) / step) * step + min).toFixed(3));
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
