import { clonePatch, routesForPatch } from '../connections/patch.ts';
import type { Level } from '../levels/first-signal.ts';
import { modulesForPatch, normalizeParameter, parameterIdsForPatch, parameterValue, waveforms, type ParameterId, type Patch, type Waveform } from '../modules/definitions.ts';
import { scorePatch } from '../scoring/score.ts';

export interface Progress {
  patch: Patch;
  lastCheckedPatch: Patch | null;
  bestPatch: Patch | null;
  heardTarget: boolean;
  heardPlayer: boolean;
}

export type LoadStatus = 'empty' | 'restored' | 'invalid' | 'unavailable';
export type ProgressStorage = Pick<Storage, 'getItem' | 'setItem'>;
const schemaVersion = 1;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export function initialProgress(level: Level): Progress {
  return { patch: clonePatch(level.initial), lastCheckedPatch: null, bestPatch: null, heardTarget: false, heardPlayer: false };
}

export function samePatch(a: Patch, b: Patch): boolean {
  return modulesForPatch(a).join(',') === modulesForPatch(b).join(',')
    && (!modulesForPatch(a).includes('oscillator') || a.parameters.waveform === b.parameters.waveform)
    && parameterIdsForPatch(a).every(id => parameterValue(a.parameters, id) === parameterValue(b.parameters, id))
    && a.connections.length === b.connections.length
    && a.connections.every(c => b.connections.some(other => c.from === other.from && c.to === other.to));
}

export function bestPatchFor(level: Level, ...patches: (Patch | null)[]): Patch | null {
  let best: Patch | null = null;
  for (const patch of patches) {
    if (patch && (!best || scorePatch(patch, level.target).score > scorePatch(best, level.target).score)) best = patch;
  }
  return best ? clonePatch(best) : null;
}

// Browser storage is untrusted: only restore exact supported values and routes.
function parsePatch(value: unknown, level: Level): Patch | null {
  if (!isRecord(value) || !isRecord(value.parameters) || !Array.isArray(value.connections)) return null;
  const p = value.parameters;
  const modules = value.modules === undefined ? modulesForPatch({ parameters: level.initial.parameters, connections: [] }) : value.modules;
  if (!Array.isArray(modules) || modules.some(id => typeof id !== 'string') || modules.join(',') !== modulesForPatch(level.target).join(',')) return null;
  if (!waveforms.includes(p.waveform as Waveform)) return null;
  const numericIds = [...new Set<ParameterId>(['frequency', 'cutoff', 'resonance', ...parameterIdsForPatch(level.target)])];
  for (const id of numericIds) {
    if (typeof p[id] !== 'number' || !Number.isFinite(p[id]) || normalizeParameter(id, p[id]) !== p[id]) return null;
  }
  const requiredConnections = routesForPatch(level.target);
  if (value.connections.length > requiredConnections.length) return null;
  const connections: Patch['connections'] = [];
  for (const cable of value.connections) {
    if (!isRecord(cable)) return null;
    const valid = requiredConnections.find(c => c.from === cable.from && c.to === cable.to);
    if (!valid || connections.some(c => c.from === valid.from)) return null;
    connections.push({ ...valid });
  }
  const parameters: Patch['parameters'] = { waveform: p.waveform as Waveform, frequency: p.frequency as number, cutoff: p.cutoff as number, resonance: p.resonance as number };
  for (const id of numericIds) parameters[id] = p[id] as number;
  return { parameters, connections, ...(value.modules === undefined ? {} : { modules: [...modulesForPatch(level.target)] }) };
}

function parseProgress(raw: string, level: Level): Progress | null {
  let saved: unknown;
  try { saved = JSON.parse(raw); } catch { return null; }
  if (!isRecord(saved) || saved.schemaVersion !== schemaVersion || saved.levelId !== level.id || saved.levelRevision !== level.revision) return null;
  if (typeof saved.heardTarget !== 'boolean' || typeof saved.heardPlayer !== 'boolean') return null;
  const patch = parsePatch(saved.patch, level);
  const lastCheckedPatch = saved.lastCheckedPatch === null ? null : parsePatch(saved.lastCheckedPatch, level);
  const bestPatch = saved.bestPatch === null ? null : parsePatch(saved.bestPatch, level);
  if (!patch || (saved.lastCheckedPatch !== null && !lastCheckedPatch) || (saved.bestPatch !== null && !bestPatch)) return null;
  return { patch, lastCheckedPatch, bestPatch: bestPatchFor(level, bestPatch, lastCheckedPatch), heardTarget: saved.heardTarget, heardPlayer: saved.heardPlayer };
}

export class ProgressStore {
  readonly key: string;
  private level: Level;
  private storage: () => ProgressStorage;

  constructor(level: Level, storage: () => ProgressStorage = () => window.localStorage) {
    this.level = level;
    this.key = `signal-lab:progress:${level.id}`;
    this.storage = storage;
  }

  load(): { progress: Progress; status: LoadStatus } {
    try {
      const raw = this.storage().getItem(this.key);
      if (raw === null) return { progress: initialProgress(this.level), status: 'empty' };
      const progress = parseProgress(raw, this.level);
      return progress ? { progress, status: 'restored' } : { progress: initialProgress(this.level), status: 'invalid' };
    } catch {
      return { progress: initialProgress(this.level), status: 'unavailable' };
    }
  }

  save(progress: Progress): { saved: boolean; bestPatch: Patch | null } {
    try {
      const storage = this.storage();
      const raw = storage.getItem(this.key);
      const existing = raw === null ? null : parseProgress(raw, this.level);
      // A second tab can replace the current patch, but cannot lower the record.
      const bestPatch = bestPatchFor(this.level, progress.bestPatch, existing?.bestPatch ?? null, progress.lastCheckedPatch);
      storage.setItem(this.key, JSON.stringify({
        schemaVersion, levelId: this.level.id, levelRevision: this.level.revision,
        patch: clonePatch(progress.patch),
        lastCheckedPatch: progress.lastCheckedPatch ? clonePatch(progress.lastCheckedPatch) : null,
        bestPatch, heardTarget: progress.heardTarget, heardPlayer: progress.heardPlayer,
      }));
      return { saved: true, bestPatch };
    } catch {
      return { saved: false, bestPatch: progress.bestPatch };
    }
  }
}
