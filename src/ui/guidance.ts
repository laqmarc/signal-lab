import { isCompletePatch, requiredConnections } from '../connections/patch.ts';
import type { Patch } from '../modules/definitions.ts';

export interface LearningState {
  heardTarget: boolean;
  heardPlayer: boolean;
  checked: boolean;
  solved: boolean;
}

export function getGuidance(patch: Patch, state: LearningState) {
  if (state.solved) return { step: 4, action: '', text: 'Experiment completat. Has connectat, ajustat i recreat el so!' };
  if (!state.heardTarget) return { step: 0, action: 'target', text: 'Comença amb PLAY TARGET. Escolta com és el so que vols recrear.' };
  if (!isCompletePatch(patch)) {
    const firstMissing = !patch.connections.some(c => c.from === requiredConnections[0].from && c.to === requiredConnections[0].to);
    return { step: 1, action: '', text: firstMissing
      ? 'Clica OUT d’OSCILLATOR i després IN de FILTER. El connector il·luminat t’indica per on començar.'
      : 'Ara uneix OUT de FILTER amb IN d’OUTPUT. El so necessita arribar a la sortida.' };
  }
  if (state.checked) return { step: 2, action: 'player', text: 'Segueix les pistes de sota. Ajusta un control cada vegada i torna a escoltar.' };
  if (!state.heardPlayer) return { step: 2, action: 'player', text: 'Prem PLAY MY SOUND. Pots moure els knobs mentre sona i escoltar què canvia.' };
  return { step: 3, action: 'check', text: 'Prem CHECK per saber què s’assembla i què cal ajustar. Pots tornar a escoltar l’objectiu.' };
}
