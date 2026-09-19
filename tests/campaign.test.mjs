import test from 'node:test';
import assert from 'node:assert/strict';
import { levels } from '../src/levels/catalog.ts';
import { clonePatch, connectPorts, isCompletePatch, routesForPatch } from '../src/connections/patch.ts';
import { moduleDefinitions, modulesForPatch, parameterIdsForPatch, parameterDefinitions, parameterValue, normalizeParameter } from '../src/modules/definitions.ts';
import { scorePatch } from '../src/scoring/score.ts';
import { initialProgress, ProgressStore, samePatch } from '../src/progress/storage.ts';
import { getGuidance } from '../src/ui/guidance.ts';

test('24 distinct playable experiments introduce all ten machines', () => {
  assert.equal(levels.length, 24);
  assert.equal(new Set(levels.map(l => l.id)).size, 24);
  assert.equal(new Set(levels.flatMap(l => modulesForPatch(l.target))).size, moduleDefinitions.length);
  for (const level of levels) {
    assert.ok(isCompletePatch(level.target), level.id);
    assert.equal(scorePatch(level.target, level.target).score, 100, level.id);
    assert.equal(scorePatch(level.initial, level.target).score, 0, level.id);
    for (const id of parameterIdsForPatch(level.target)) {
      assert.equal(normalizeParameter(id, parameterValue(level.target.parameters, id)), parameterValue(level.target.parameters, id), `${level.id}/${id}`);
    }
  }
});
test('every campaign route can be wired in reverse order; every missing cable blocks success', () => {
  for (const level of levels) {
    let connections = [];
    const routes = routesForPatch(level.target);
    for (const route of [...routes].reverse()) {
      connections = connectPorts(connections, route.to, route.from, routes);
      assert.ok(connections, level.id);
    }
    assert.ok(isCompletePatch({ ...level.target, connections }));
    for (const route of routes) {
      const patch = clonePatch(level.target);
      patch.connections = patch.connections.filter(c => c.from !== route.from);
      assert.equal(scorePatch(patch, level.target).score, 0);
      assert.ok(getGuidance(patch, { heardTarget: true }).text.includes(route.from.split(':')[0].toUpperCase()));
    }
    assert.equal(connectPorts([], 'lfo:out', 'output:in', routes), null);
    assert.equal(connectPorts([], 'sequencer:out', 'filter:mod', routes), null);
  }
});
test('each active control affects scoring and inactive oscillator controls do not penalize noise', () => {
  for (const level of levels) for (const id of parameterIdsForPatch(level.target)) {
    const patch = clonePatch(level.target), def = parameterDefinitions[id];
    patch.parameters[id] = parameterValue(patch.parameters, id) === def.max ? def.min : def.max;
    const result = scorePatch(patch, level.target);
    assert.ok(result.score < 100, `${level.id}/${id}`);
    assert.notEqual(result.feedback.find(f => f.parameter === id).direction, 'match');
  }
  const noise = levels.find(l => l.id === 'white-mist');
  const p = clonePatch(noise.target); p.parameters.frequency = 880; p.parameters.waveform = 'square';
  assert.equal(scorePatch(p, noise.target).score, 100);
  assert.ok(samePatch(p, noise.target));
});
test('all campaign progress round-trips independently and rejects missing machines or controls', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  for (const level of levels) {
    const store = new ProgressStore(level, () => storage);
    const progress = { ...initialProgress(level), patch: clonePatch(level.target), lastCheckedPatch: clonePatch(level.target), bestPatch: clonePatch(level.target) };
    assert.ok(store.save(progress).saved);
    assert.equal(store.load().status, 'restored', level.id);
    assert.ok(samePatch(store.load().progress.patch, level.target));
  }
  assert.equal(data.size, 24);
  for (const level of levels.slice(4)) {
    const store = new ProgressStore(level, () => storage);
    const valid = data.get(store.key), bad = JSON.parse(valid);
    bad.patch.modules = ['oscillator', 'filter', 'output'];
    storage.setItem(store.key, JSON.stringify(bad));
    assert.equal(store.load().status, 'invalid');
    const missing = JSON.parse(valid);
    delete missing.patch.parameters[parameterIdsForPatch(level.target).at(-1)];
    storage.setItem(store.key, JSON.stringify(missing));
    assert.equal(store.load().status, 'invalid');
  }
});
test('a player following the hints can solve every level using supported control steps', () => {
  for (const level of levels) {
    const patch = clonePatch(level.initial); patch.connections = routesForPatch(patch);
    for (let attempts = 0; attempts < 1200 && !scorePatch(patch, level.target).solved; attempts++) {
      const result = scorePatch(patch, level.target);
      const hint = result.feedback.find(item => item.direction !== 'match');
      if (hint.parameter === 'waveform') patch.parameters.waveform = level.target.parameters.waveform;
      else {
        const id = hint.parameter, def = parameterDefinitions[id];
        patch.parameters[id] = normalizeParameter(id, parameterValue(patch.parameters, id) + (hint.direction === 'up' ? def.step : -def.step));
      }
    }
    assert.ok(scorePatch(patch, level.target).solved, level.id);
  }
});
