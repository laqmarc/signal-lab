import { clonePatch, routesForPatch } from '../connections/patch.ts';
import { parameterDefinitions, parameterIdsForPatch, type ModuleId, type Parameters, type Patch } from '../modules/definitions.ts';
import { firstSignal, type Level } from './first-signal.ts';

const chapters = ['01 · Els fonaments', '02 · La forma del temps', '03 · Moviment i textura', '04 · Espais i ecos', '05 · Petites melodies', '06 · El laboratori complet'];
function experiment(id: string, title: string, chapter: number, modules: ModuleId[], target: Partial<Parameters>, lesson: string, duration = 3.5): Level {
  const patch: Patch = { modules, parameters: { waveform: 'sine', frequency: 330, cutoff: 2800, resonance: 0.8 }, connections: [] };
  for (const key of parameterIdsForPatch(patch)) patch.parameters[key] = parameterDefinitions[key].initial;
  const initial = clonePatch(patch);
  patch.parameters = { ...patch.parameters, ...target };
  patch.connections = routesForPatch(patch);
  return { id, title, chapter: chapters[chapter - 1], revision: 1, lesson, description: lesson, duration, target: patch, initial };
}
const basic: ModuleId[] = ['oscillator', 'filter', 'output'];
const envelope: ModuleId[] = ['oscillator', 'filter', 'envelope', 'output'];
const motion: ModuleId[] = ['oscillator', 'filter', 'lfo', 'output'];
const echo: ModuleId[] = ['oscillator', 'filter', 'envelope', 'delay', 'output'];
const space: ModuleId[] = ['oscillator', 'filter', 'envelope', 'reverb', 'output'];
const sequence: ModuleId[] = ['oscillator', 'filter', 'sequencer', 'output'];

export const levels: Level[] = [
  firstSignal,
  experiment('hollow-bass', 'Un baix de butxaca', 1, basic, { waveform: 'square', frequency: 110, cutoff: 600, resonance: 1.4 }, 'Busca un so greu i buit. La forma d’ona importa tant com la freqüència.'),
  experiment('warm-triangle', 'La llum del triangle', 1, basic, { waveform: 'triangle', frequency: 440, cutoff: 1600, resonance: 0.7 }, 'Un timbre suau amb una mica de brillantor. Escolta primer el to.'),
  experiment('bright-edge', 'Una vora brillant', 1, basic, { waveform: 'sawtooth', frequency: 165, cutoff: 2800, resonance: 3.2 }, 'Obre el filtre i busca el punt on el so guanya caràcter.'),
  experiment('slow-arrival', 'A poc a poc', 2, envelope, { waveform: 'triangle', frequency: 220, cutoff: 1400, attack: 0.8, release: 1 }, 'Màquina nova: ENVELOPE. ATTACK fa aparèixer el so; RELEASE el deixa marxar.', 4),
  experiment('tiny-pluck', 'Una corda curta', 2, envelope, { waveform: 'sawtooth', frequency: 330, cutoff: 1000, resonance: 1.2, attack: 0.01, release: 0.15 }, 'Compara una entrada immediata amb una sortida curta. Ajusta ENVELOPE.', 3),
  experiment('white-mist', 'Boira blanca', 2, ['noise', 'filter', 'output'], { cutoff: 700, resonance: 1, noiseLevel: 0.65 }, 'Màquina nova: NOISE. No busquis una nota: escolta el color i la intensitat del soroll.'),
  experiment('wind-gust', 'Una ràfega de vent', 2, ['noise', 'filter', 'envelope', 'output'], { cutoff: 1800, resonance: 2, noiseLevel: 0.8, attack: 0.65, release: 1.2 }, 'Dona vida al soroll amb una entrada lenta i una sortida llarga.', 4),
  experiment('slow-tide', 'Marea lenta', 3, motion, { waveform: 'sawtooth', frequency: 165, cutoff: 1600, lfoRate: 1.5, lfoDepth: 1000 }, 'Màquina nova: LFO. Uneix el cable violeta a MOD del filtre i escolta el vaivé.', 4),
  experiment('liquid-pulse', 'Bombolles elèctriques', 3, motion, { waveform: 'square', frequency: 220, cutoff: 2200, resonance: 3, lfoRate: 4, lfoDepth: 1500 }, 'El mateix moviment, més ràpid. RATE marca el ritme; DEPTH, l’amplitud.', 4),
  experiment('rough-sine', 'La rugositat del metall', 3, ['oscillator', 'filter', 'distortion', 'output'], { waveform: 'sine', frequency: 110, cutoff: 2400, drive: 7 }, 'Màquina nova: DISTORTION. Una ona pura també pot grunyir quan puges DRIVE.'),
  experiment('soft-growl', 'Un grunyit que neix', 3, ['oscillator', 'filter', 'distortion', 'envelope', 'output'], { waveform: 'triangle', frequency: 146, cutoff: 1200, drive: 4.5, attack: 0.4, release: 0.75 }, 'Combina la rugositat de DISTORTION amb el gest d’ENVELOPE.', 4),
  experiment('first-echo', 'Una resposta llunyana', 4, echo, { waveform: 'square', frequency: 330, cutoff: 1200, attack: 0.02, release: 0.1, delayTime: 0.45, delayMix: 0.55 }, 'Màquina nova: DELAY. Escolta què passa després que la nota s’aturi.', 4.5),
  experiment('close-echo', 'Dues parets properes', 4, echo, { waveform: 'triangle', frequency: 440, cutoff: 2200, attack: 0.03, release: 0.2, delayTime: 0.15, delayMix: 0.4 }, 'Un eco curt s’enganxa al so original. Redueix TIME i ajusta MIX.', 4.5),
  experiment('empty-hall', 'La sala buida', 4, space, { waveform: 'square', frequency: 220, cutoff: 1600, attack: 0.02, release: 0.15, reverbDecay: 1.8, reverbMix: 0.6 }, 'Màquina nova: REVERB. L’eco es transforma en una cua difusa, com dins d’una sala.', 4.5),
  experiment('distant-storm', 'Tempesta a la distància', 4, ['noise', 'filter', 'envelope', 'reverb', 'output'], { cutoff: 500, resonance: 1.5, noiseLevel: 0.75, attack: 0.3, release: 0.45, reverbDecay: 2.2, reverbMix: 0.5 }, 'Filtra el soroll, dibuixa la ràfega i col·loca-la en un espai gran.', 4.5),
  experiment('four-stairs', 'Quatre esglaons', 5, sequence, { waveform: 'triangle', frequency: 220, cutoff: 2200, tempo: 120, step1: 0, step2: 4, step3: 7, step4: 12 }, 'Màquina nova: SEQUENCER. Connecta-la a PITCH i ordena quatre notes. 0 és el to base.', 5.5),
  experiment('descending', 'Baixant l’escala', 5, sequence, { waveform: 'square', frequency: 165, cutoff: 1100, tempo: 90, step1: 12, step2: 7, step3: 3, step4: 0 }, 'Escolta la direcció de cada pas. TEMPO canvia la velocitat, no les notes.', 5.5),
  experiment('echo-pattern', 'Una melodia amb resposta', 5, ['oscillator', 'filter', 'delay', 'sequencer', 'output'], { waveform: 'triangle', frequency: 220, cutoff: 2600, tempo: 150, step1: 0, step2: 7, step3: 3, step4: 10, delayTime: 0.4, delayMix: 0.45 }, 'Construeix primer la melodia. Després afegeix l’eco entre les notes.', 5.5),
  experiment('moving-pattern', 'Notes que respiren', 5, ['oscillator', 'filter', 'lfo', 'sequencer', 'output'], { waveform: 'sawtooth', frequency: 110, cutoff: 2000, resonance: 1.8, tempo: 100, step1: 0, step2: 0, step3: 7, step4: 5, lfoRate: 2, lfoDepth: 1200 }, 'Dos cables violetes, dues feines: SEQUENCER mou el to i LFO mou el filtre.', 5.5),
  experiment('breathing-wind', 'El vent té pols', 6, ['noise', 'filter', 'envelope', 'lfo', 'output'], { noiseLevel: 0.7, cutoff: 1900, resonance: 2.3, attack: 0.5, release: 0.9, lfoRate: 2.5, lfoDepth: 1300 }, 'Combina soroll, moviment i dinàmica. Ajusta una màquina cada vegada.', 4.5),
  experiment('rusty-transmission', 'Transmissió oxidada', 6, ['oscillator', 'filter', 'distortion', 'envelope', 'delay', 'output'], { waveform: 'sine', frequency: 196, cutoff: 1700, drive: 8.5, attack: 0.15, release: 0.4, delayTime: 0.55, delayMix: 0.5 }, 'Un missatge aspre amb una resposta llunyana. Separa el timbre del temps.', 4.5),
  experiment('orbital-melody', 'Melodia en òrbita', 6, ['oscillator', 'filter', 'reverb', 'sequencer', 'output'], { waveform: 'triangle', frequency: 330, cutoff: 2100, tempo: 110, step1: 0, step2: 3, step3: 7, step4: 5, reverbDecay: 1.6, reverbMix: 0.45 }, 'Quatre notes dins d’una sala. Afina els passos abans d’ajustar l’espai.', 5.5),
  experiment('signal-constellation', 'La constel·lació del so', 6, ['oscillator', 'filter', 'envelope', 'delay', 'reverb', 'lfo', 'sequencer', 'output'], { waveform: 'sawtooth', frequency: 165, cutoff: 2000, resonance: 1.5, attack: 0.2, release: 0.5, lfoRate: 1, lfoDepth: 800, tempo: 120, step1: 0, step2: 7, step3: 10, step4: 5, delayTime: 0.5, delayMix: 0.35, reverbDecay: 1.3, reverbMix: 0.3 }, 'El repte final: connecta totes les màquines i reconstrueix aquesta petita constel·lació.', 6),
];

export function rememberedLevel(): Level {
  try { return levels.find(level => level.id === localStorage.getItem('signal-lab:last-level')) ?? firstSignal; }
  catch { return firstSignal; }
}
