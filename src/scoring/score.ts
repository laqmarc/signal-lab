import { isCompletePatch } from '../connections/patch.ts';
import type { Patch } from '../modules/definitions.ts';

export interface ScoreResult {
  score: number;
  complete: boolean;
  solved: boolean;
  hint: string;
  parts: { waveform: number; frequency: number; cutoff: number; resonance: number };
}

const similarity = (distance: number) => Math.max(0, 1 - distance);

export function scorePatch(player: Patch, target: Patch): ScoreResult {
  const p = player.parameters;
  const t = target.parameters;
  const parts = {
    waveform: p.waveform === t.waveform ? 1 : 0,
    frequency: similarity(Math.abs(Math.log2(p.frequency / t.frequency)) / 2),
    cutoff: similarity(Math.abs(Math.log2(p.cutoff / t.cutoff)) / 4),
    resonance: similarity(Math.abs(p.resonance - t.resonance) / 7.9),
  };
  const complete = isCompletePatch(player);
  const solved = complete && Object.values(parts).every(value => value === 1);
  const weighted = parts.waveform * 30 + parts.frequency * 30 + parts.cutoff * 25 + parts.resonance * 15;
  // Reserve 100% for an exact match, even when rounding would hide a small difference.
  const score = complete ? (solved ? 100 : Math.min(99, Math.round(weighted))) : 0;
  let hint = 'So recreat! Has trobat la primera freqüència.';
  if (!complete) hint = 'Falta camí per al so. Connecta OSCILLATOR → FILTER → OUTPUT.';
  else if (!solved) {
    const worst = (Object.keys(parts) as (keyof typeof parts)[]).sort((a, b) => parts[a] - parts[b])[0];
    const hints = {
      waveform: 'Prova una altra forma d’ona. Cada forma té un caràcter diferent.',
      frequency: p.frequency > t.frequency ? 'El teu so és massa agut. Baixa una mica FREQUENCY.' : 'El teu so és massa greu. Puja una mica FREQUENCY.',
      cutoff: p.cutoff > t.cutoff ? 'El teu so és massa brillant. Baixa CUTOFF per suavitzar-lo.' : 'El teu so és massa fosc. Puja CUTOFF per obrir-lo.',
      resonance: p.resonance > t.resonance ? 'El filtre destaca massa. Baixa una mica RESONANCE.' : 'Falta una mica de caràcter. Puja RESONANCE.',
    };
    hint = hints[worst];
  }
  return { score, complete, solved, hint, parts };
}
