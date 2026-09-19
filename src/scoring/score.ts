import { isCompletePatch, routesForPatch } from '../connections/patch.ts';
import { modulesForPatch, parameterDefinitions, parameterIdsForPatch, parameterValue, type ParameterId, type Patch } from '../modules/definitions.ts';

export interface ParameterFeedback {
  parameter: keyof Patch['parameters']; label: string; control: string; percent: number;
  direction: 'match' | 'change' | 'up' | 'down'; instruction: string;
}
export interface ScoreResult {
  score: number; complete: boolean; solved: boolean; hint: string;
  parts: Record<string, number>; feedback: ParameterFeedback[];
}
const similarity = (distance: number) => Math.max(0, 1 - distance);
export function scorePatch(player: Patch, target: Patch): ScoreResult {
  const p = player.parameters;
  const t = target.parameters;
  const ids: (ParameterId | 'waveform')[] = [...(modulesForPatch(target).includes('oscillator') ? ['waveform' as const] : []), ...parameterIdsForPatch(target)];
  const parts: Record<string, number> = {};
  for (const id of ids) {
    if (id === 'waveform') parts[id] = p.waveform === t.waveform ? 1 : 0;
    else {
      const a = parameterValue(p, id), b = parameterValue(t, id), definition = parameterDefinitions[id];
      const distance = id === 'frequency' ? Math.abs(Math.log2(a / b)) / 2 : id === 'cutoff' ? Math.abs(Math.log2(a / b)) / 4 : Math.abs(a - b) / (definition.max - definition.min);
      parts[id] = similarity(distance);
    }
  }
  const complete = modulesForPatch(player).join(',') === modulesForPatch(target).join(',') && isCompletePatch(player, routesForPatch(target));
  const solved = complete && ids.every(id => parts[id] === 1);
  const weights: Partial<Record<ParameterId | 'waveform', number>> = { waveform: 30, frequency: 30, cutoff: 25, resonance: 15 };
  const totalWeight = ids.reduce((sum, id) => sum + (weights[id] ?? 15), 0);
  const weighted = ids.reduce((sum, id) => sum + parts[id] * (weights[id] ?? 15), 0) / totalWeight * 100;
  const score = complete ? (solved ? 100 : Math.min(99, Math.round(weighted))) : 0;
  const feedback: ParameterFeedback[] = complete ? ids.map(parameter => {
    const match = parts[parameter] === 1;
    const direction = match ? 'match' : parameter === 'waveform' ? 'change' : parameterValue(p, parameter) > parameterValue(t, parameter) ? 'down' : 'up';
    const instructions = { match: 'Encertat', change: 'Prova una altra ona', down: 'Baixa el valor', up: 'Puja el valor' };
    return { parameter, label: parameter === 'waveform' ? 'Forma d’ona' : parameterDefinitions[parameter].name,
      control: parameter === 'waveform' ? 'WAVEFORM' : parameterDefinitions[parameter].label,
      percent: match ? 100 : Math.min(99, Math.round(parts[parameter] * 100)), direction, instruction: instructions[direction] };
  }) : [];
  let hint = 'So recreat! Has resolt aquest experiment.';
  if (!complete) hint = 'Falta una connexió. Completa els cables del camí de so i els cables de control violetes.';
  else if (!solved) {
    const worst = feedback.reduce((a, b) => parts[a.parameter] <= parts[b.parameter] ? a : b);
    hint = worst.parameter === 'waveform' ? 'Prova una altra forma d’ona. Cada forma té un caràcter diferent.'
      : `${worst.instruction === 'Puja el valor' ? 'Puja' : 'Baixa'} ${worst.control}. ${parameterDefinitions[worst.parameter].hint}.`;
  }
  return { score, complete, solved, hint, parts, feedback };
}
