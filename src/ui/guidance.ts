import { isCompletePatch, routesForPatch } from '../connections/patch.ts';
import { ports, type Patch } from '../modules/definitions.ts';

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
    const missing = routesForPatch(patch).find(route => !patch.connections.some(c => c.from === route.from && c.to === route.to))!;
    const from = ports[missing.from];
    const to = ports[missing.to];
    const destination = missing.to.endsWith(':mod') ? 'MOD' : missing.to.endsWith(':pitch') ? 'PITCH' : 'IN';
    return { step: 1, action: '', text: `Clica OUT ${from.module === 'oscillator' || from.module === 'envelope' ? 'd’' : 'de '}${from.module.toUpperCase()} i després ${destination} de ${to.module.toUpperCase()}. ${from.kind === 'control' ? 'El cable violeta controla un paràmetre.' : 'El connector il·luminat t’indica per on continuar.'}` };
  }
  if (state.checked) return { step: 2, action: 'player', text: 'Segueix les pistes de sota. Ajusta un control cada vegada i torna a escoltar.' };
  if (!state.heardPlayer) return { step: 2, action: 'player', text: 'Prem PLAY MY SOUND. Pots moure els knobs mentre sona i escoltar què canvia.' };
  return { step: 3, action: 'check', text: 'Prem CHECK per saber què s’assembla i què cal ajustar. Pots tornar a escoltar l’objectiu.' };
}
