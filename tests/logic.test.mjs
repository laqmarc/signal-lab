import test from 'node:test';
import assert from 'node:assert/strict';
import { clonePatch, connectPorts, disconnectPort, isCompletePatch, requiredConnections } from '../src/connections/patch.ts';
import { firstSignal } from '../src/levels/first-signal.ts';
import { normalizeParameter, parameterAtPosition, parameterDefinitions } from '../src/modules/definitions.ts';
import { scorePatch } from '../src/scoring/score.ts';
import { getGuidance } from '../src/ui/guidance.ts';

test('an exact complete patch earns 100%; target is not mutated', () => {
  const player = clonePatch(firstSignal.target);
  assert.equal(scorePatch(player, firstSignal.target).score, 100);
  assert.equal(scorePatch(player, firstSignal.target).solved, true);
  player.parameters.frequency = 300;
  player.connections.pop();
  assert.equal(firstSignal.target.parameters.frequency, 220);
  assert.equal(firstSignal.target.connections.length, 2);
});

test('every incomplete topology earns 0%, even with perfect parameters', () => {
  for (const connections of [[], [requiredConnections[0]], [requiredConnections[1]]]) {
    const player = { ...clonePatch(firstSignal.target), connections };
    assert.equal(isCompletePatch(player), false);
    assert.equal(scorePatch(player, firstSignal.target).score, 0);
  }
});

test('connections work in either click order without duplicates', () => {
  let cables = connectPorts([], 'filter:in', 'oscillator:out');
  assert.equal(cables.length, 1);
  cables = connectPorts(cables, 'oscillator:out', 'filter:in');
  assert.equal(cables.length, 1);
  cables = connectPorts(cables, 'output:in', 'filter:out');
  assert.equal(isCompletePatch({ ...firstSignal.initial, connections: cables }), true);
  assert.equal(disconnectPort(cables, 'filter:in').length, 1);
  assert.equal(disconnectPort(cables, 'output:in')[0].from, 'oscillator:out');
});

test('self-connections, feedback, same-direction ports and bypasses are rejected', () => {
  for (const [a, b] of [
    ['filter:out', 'filter:in'], ['oscillator:out', 'output:in'],
    ['oscillator:out', 'filter:out'], ['filter:in', 'output:in'], ['filter:in', 'filter:in'],
  ]) assert.equal(connectPorts([], a, b), null);
});

test('each parameter independently affects score and provides a useful hint', () => {
  for (const [key, value] of Object.entries({ waveform: 'sine', frequency: 440, cutoff: 3000, resonance: 5 })) {
    const player = clonePatch(firstSignal.target);
    player.parameters[key] = value;
    const result = scorePatch(player, firstSignal.target);
    assert.ok(result.score > 0 && result.score < 100);
    assert.equal(result.solved, false);
    assert.ok(result.hint.length > 15);
  }
});

test('small differences never round to a false victory', () => {
  for (const [key, value] of Object.entries({ frequency: 221, cutoff: 910, resonance: 2.5 })) {
    const player = clonePatch(firstSignal.target);
    player.parameters[key] = value;
    assert.equal(scorePatch(player, firstSignal.target).score, 99);
    assert.equal(scorePatch(player, firstSignal.target).solved, false);
  }
});

test('a novice following directional hints can reach the solution', () => {
  const player = clonePatch(firstSignal.initial);
  player.connections = requiredConnections.map(c => ({ ...c }));
  for (let i = 0; i < 600 && !scorePatch(player, firstSignal.target).solved; i++) {
    const { parts } = scorePatch(player, firstSignal.target);
    const worst = Object.keys(parts).sort((a, b) => parts[a] - parts[b])[0];
    if (worst === 'waveform') player.parameters.waveform = 'sawtooth';
    else player.parameters[worst] = normalizeParameter(worst, player.parameters[worst] + Math.sign(firstSignal.target.parameters[worst] - player.parameters[worst]) * parameterDefinitions[worst].step);
  }
  assert.equal(scorePatch(player, firstSignal.target).score, 100);
});

test('all controls clamp their numeric and drag values to their range', () => {
  for (const [id, d] of Object.entries(parameterDefinitions)) {
    assert.equal(normalizeParameter(id, -999), d.min);
    assert.equal(normalizeParameter(id, 99999), d.max);
    assert.equal(normalizeParameter(id, NaN), d.min);
    assert.equal(parameterAtPosition(id, -1), d.min);
    assert.equal(parameterAtPosition(id, 2), d.max);
    assert.equal(normalizeParameter(id, firstSignal.target.parameters[id]), firstSignal.target.parameters[id]);
  }
});

test('score is always within 0–100 over the valid parameter space', () => {
  for (const waveform of ['sine', 'square', 'sawtooth', 'triangle']) {
    for (let i = 0; i <= 100; i++) {
      const player = clonePatch(firstSignal.target);
      player.parameters = { waveform, frequency: parameterAtPosition('frequency', i / 100), cutoff: parameterAtPosition('cutoff', (100 - i) / 100), resonance: parameterAtPosition('resonance', i / 100) };
      const { score } = scorePatch(player, firstSignal.target);
      assert.ok(Number.isInteger(score) && score >= 0 && score <= 100);
    }
  }
});

test('parameter feedback gives correct directions without revealing the target values', () => {
  const player = clonePatch(firstSignal.target);
  player.parameters = { waveform: 'triangle', frequency: 440, cutoff: 400, resonance: 5 };
  const { feedback } = scorePatch(player, firstSignal.target);
  assert.deepEqual(feedback.map(f => f.direction), ['change', 'down', 'up', 'down']);
  assert.ok(feedback.every(f => f.percent < 100));
  assert.ok(feedback.every(f => !/220|900|2[.,]4/.test(f.instruction)));
  assert.ok(scorePatch(firstSignal.target, firstSignal.target).feedback.every(f => f.direction === 'match' && f.percent === 100));
});

test('disconnected patches give connection guidance, not misleading parameter matches', () => {
  const disconnected = clonePatch(firstSignal.target);
  disconnected.connections = [];
  assert.deepEqual(scorePatch(disconnected, firstSignal.target).feedback, []);
  const near = clonePatch(firstSignal.target);
  near.parameters.frequency = 221;
  assert.equal(scorePatch(near, firstSignal.target).feedback.find(f => f.parameter === 'frequency').percent, 99);
});

test('learning guidance follows listening, both cables, audition and checking', () => {
  const state = { heardTarget: false, heardPlayer: false, checked: false, solved: false };
  const player = clonePatch(firstSignal.initial);
  assert.equal(getGuidance(player, state).action, 'target');
  state.heardTarget = true;
  assert.match(getGuidance(player, state).text, /OUT d’OSCILLATOR/);
  player.connections = [requiredConnections[0]];
  assert.match(getGuidance(player, state).text, /OUT de FILTER/);
  player.connections = [...requiredConnections];
  assert.equal(getGuidance(player, state).action, 'player');
  state.heardPlayer = true;
  assert.equal(getGuidance(player, state).action, 'check');
  state.checked = true;
  assert.match(getGuidance(player, state).text, /Segueix les pistes/);
  state.solved = true;
  assert.equal(getGuidance(player, state).step, 4);
});

test('learning guidance recovers if the player connects in reverse order or disconnects later', () => {
  const state = { heardTarget: true, heardPlayer: true, checked: false, solved: false };
  const player = clonePatch(firstSignal.target);
  player.connections = [requiredConnections[1]];
  assert.match(getGuidance(player, state).text, /OUT d’OSCILLATOR/);
});
