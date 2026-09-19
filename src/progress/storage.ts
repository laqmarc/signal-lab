import { clonePatch, requiredConnections } from '../connections/patch.ts';
import type { Level } from '../levels/first-signal.ts';
import { normalizeParameter, parameterDefinitions, waveforms, type ParameterId, type Patch, type Waveform } from '../modules/definitions.ts';
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
  return a.parameters.waveform === b.parameters.waveform
    && (Object.keys(parameterDefinitions) as ParameterId[]).every(id => a.parameters[id] === b.parameters[id])
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
function parsePatch(value: unknown): Patch | null {
  if (!isRecord(value) || !isRecord(value.parameters) || !Array.isArray(value.connections)) return null;
  const p = value.parameters;
  if (!waveforms.includes(p.waveform as Waveform)) return null;
  for (const id of Object.keys(parameterDefinitions) as ParameterId[]) {
    if (typeof p[id] !== 'number' || !Number.isFinite(p[id]) || normalizeParameter(id, p[id]) !== p[id]) return null;
  }
  if (value.connections.length > requiredConnections.length) return null;
  const connections: Patch['connections'] = [];
  for (const cable of value.connections) {
    if (!isRecord(cable)) return null;
    const valid = requiredConnections.find(c => c.from === cable.from && c.to === cable.to);
    if (!valid || connections.some(c => c.from === valid.from)) return null;
    connections.push({ ...valid });
  }
  return { parameters: { waveform: p.waveform as Waveform, frequency: p.frequency as number, cutoff: p.cutoff as number, resonance: p.resonance as number }, connections };
}

function parseProgress(raw: string, level: Level): Progress | null {
  let saved: unknown;
  try { saved = JSON.parse(raw); } catch { return null; }
  if (!isRecord(saved) || saved.schemaVersion !== schemaVersion || saved.levelId !== level.id || saved.levelRevision !== level.revision) return null;
  if (typeof saved.heardTarget !== 'boolean' || typeof saved.heardPlayer !== 'boolean') return null;
  const patch = parsePatch(saved.patch);
  const lastCheckedPatch = saved.lastCheckedPatch === null ? null : parsePatch(saved.lastCheckedPatch);
  const bestPatch = saved.bestPatch === null ? null : parsePatch(saved.bestPatch);
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
