import test from 'node:test';
import assert from 'node:assert/strict';
import { clonePatch, requiredConnections } from '../src/connections/patch.ts';
import { firstSignal } from '../src/levels/first-signal.ts';
import { bestPatchFor, initialProgress, ProgressStore, samePatch } from '../src/progress/storage.ts';
import { scorePatch } from '../src/scoring/score.ts';

function memoryStorage() {
  const records = new Map();
  return { getItem: key => records.get(key) ?? null, setItem: (key, value) => { records.set(key, value); } };
}

function fixture() {
  const memory = memoryStorage();
  const store = new ProgressStore(firstSignal, () => memory);
  const progress = initialProgress(firstSignal);
  return { memory, store, progress };
}

test('a new player gets an independent initial patch without writing on load', () => {
  const { memory, store } = fixture();
  const result = store.load();
  assert.equal(result.status, 'empty');
  assert.equal(memory.getItem(store.key), null);
  result.progress.patch.parameters.frequency = 440;
  assert.equal(firstSignal.initial.parameters.frequency, 330);
});

test('save and load restore partial cables, parameter edits and learning progress', () => {
  const { store, progress } = fixture();
  progress.patch.parameters = { waveform: 'triangle', frequency: 287, cutoff: 650, resonance: 1.3 };
  progress.patch.connections = [requiredConnections[1]];
  progress.heardTarget = true;
  assert.equal(store.save(progress).saved, true);
  assert.deepEqual(store.load(), { progress, status: 'restored' });
});

test('the evaluated patch is restored separately from subsequent unsaved-to-CHECK edits', () => {
  const { store, progress } = fixture();
  progress.lastCheckedPatch = clonePatch(firstSignal.target);
  progress.patch = clonePatch(firstSignal.target);
  progress.patch.parameters.frequency = 221;
  store.save(progress);
  const loaded = store.load().progress;
  assert.equal(samePatch(loaded.patch, loaded.lastCheckedPatch), false);
  assert.equal(scorePatch(loaded.lastCheckedPatch, firstSignal.target).score, 100);
  assert.equal(scorePatch(loaded.patch, firstSignal.target).score, 99);
  assert.equal(scorePatch(loaded.bestPatch, firstSignal.target).score, 100);
});

test('reloading an exactly checked patch preserves its current result', () => {
  const { store, progress } = fixture();
  progress.patch = clonePatch(firstSignal.target);
  progress.lastCheckedPatch = clonePatch(progress.patch);
  store.save(progress);
  const loaded = store.load().progress;
  assert.equal(samePatch(loaded.patch, loaded.lastCheckedPatch), true);
  assert.equal(scorePatch(loaded.patch, firstSignal.target).solved, true);
});

test('resetting the current patch cannot lose the best score', () => {
  const { store, progress } = fixture();
  progress.patch = clonePatch(firstSignal.target);
  progress.lastCheckedPatch = clonePatch(progress.patch);
  store.save(progress);
  const reset = initialProgress(firstSignal);
  reset.bestPatch = store.load().progress.bestPatch;
  store.save(reset);
  const loaded = store.load().progress;
  assert.deepEqual(loaded.patch, firstSignal.initial);
  assert.equal(loaded.lastCheckedPatch, null);
  assert.equal(scorePatch(loaded.bestPatch, firstSignal.target).score, 100);
});

test('a stale second tab can save its patch without lowering another tab’s record', () => {
  const { memory, store, progress } = fixture();
  const other = new ProgressStore(firstSignal, () => memory);
  const stale = other.load().progress;
  progress.lastCheckedPatch = clonePatch(firstSignal.target);
  store.save(progress);
  stale.patch.parameters.frequency = 150;
  stale.lastCheckedPatch = clonePatch(stale.patch);
  const saved = other.save(stale);
  assert.equal(scorePatch(saved.bestPatch, firstSignal.target).score, 100);
  assert.equal(store.load().progress.patch.parameters.frequency, 150);
  assert.equal(scorePatch(store.load().progress.bestPatch, firstSignal.target).score, 100);
});

test('invalid JSON, unknown versions and other levels safely start a new patch', () => {
  const { memory, store, progress } = fixture();
  store.save(progress);
  const valid = JSON.parse(memory.getItem(store.key));
  for (const data of [null, [], {}, { ...valid, schemaVersion: 2 }, { ...valid, levelId: 'other' }, { ...valid, levelRevision: 2 }, { ...valid, heardTarget: 'yes' }]) {
    memory.setItem(store.key, JSON.stringify(data));
    assert.equal(store.load().status, 'invalid');
    assert.deepEqual(store.load().progress.patch, firstSignal.initial);
  }
  memory.setItem(store.key, '{bad JSON');
  assert.equal(store.load().status, 'invalid');
});

test('stored numeric values and waveforms must match the supported controls exactly', () => {
  const { memory, store, progress } = fixture();
  store.save(progress);
  const valid = JSON.parse(memory.getItem(store.key));
  for (const [parameter, value] of [['waveform', 'noise'], ['frequency', 0], ['frequency', '220'], ['frequency', 221.5], ['cutoff', 6050], ['cutoff', 901], ['resonance', null], ['resonance', 2.45]]) {
    const invalid = structuredClone(valid);
    invalid.patch.parameters[parameter] = value;
    memory.setItem(store.key, JSON.stringify(invalid));
    assert.equal(store.load().status, 'invalid', `${parameter}: ${value}`);
  }
});

test('stored feedback patches and duplicate, missing or invalid ports are rejected', () => {
  const { memory, store, progress } = fixture();
  store.save(progress);
  const valid = JSON.parse(memory.getItem(store.key));
  for (const connections of [[{}], [requiredConnections[0], requiredConnections[0]], [{ from: 'oscillator:out', to: 'output:in' }], [{ from: 'filter:out', to: 'filter:in' }], [null]]) {
    const invalid = structuredClone(valid);
    invalid.patch.connections = connections;
    memory.setItem(store.key, JSON.stringify(invalid));
    assert.equal(store.load().status, 'invalid');
  }
  for (const field of ['lastCheckedPatch', 'bestPatch']) {
    memory.setItem(store.key, JSON.stringify({ ...valid, [field]: { parameters: {} } }));
    assert.equal(store.load().status, 'invalid');
  }
});

test('storage access and quota errors never prevent starting or continuing a game', () => {
  const inaccessible = new ProgressStore(firstSignal, () => { throw new Error('SecurityError'); });
  assert.equal(inaccessible.load().status, 'unavailable');
  assert.equal(inaccessible.save(initialProgress(firstSignal)).saved, false);
  const full = new ProgressStore(firstSignal, () => ({ getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } }));
  assert.equal(full.load().status, 'empty');
  assert.equal(full.save(initialProgress(firstSignal)).saved, false);
});

test('patch comparison ignores cable order but detects missing cables and changed controls', () => {
  const a = clonePatch(firstSignal.target);
  const b = clonePatch(a);
  b.connections.reverse();
  assert.equal(samePatch(a, b), true);
  b.parameters.resonance = 2.5;
  assert.equal(samePatch(a, b), false);
  b.parameters.resonance = a.parameters.resonance;
  b.connections.pop();
  assert.equal(samePatch(a, b), false);
});

test('best patch selection returns a copy and recomputes the score from parameters', () => {
  const first = clonePatch(firstSignal.initial);
  first.connections = [...requiredConnections];
  const best = bestPatchFor(firstSignal, first, firstSignal.target);
  assert.equal(scorePatch(best, firstSignal.target).score, 100);
  best.parameters.frequency = 80;
  assert.equal(firstSignal.target.parameters.frequency, 220);
  assert.equal(bestPatchFor(firstSignal, null, null), null);
});
