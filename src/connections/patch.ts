import { modulesForPatch, ports, type Connection, type Patch, type PortId } from '../modules/definitions.ts';

export const requiredConnections: readonly Connection[] = [
  { from: 'oscillator:out', to: 'filter:in' },
  { from: 'filter:out', to: 'output:in' },
];

export function routesForPatch(patch: Patch): Connection[] {
  const modules = modulesForPatch(patch);
  const audio = modules.filter(id => id !== 'lfo' && id !== 'sequencer');
  const routes = audio.slice(0, -1).map((id, i) => ({ from: `${id}:out` as PortId, to: `${audio[i + 1]}:in` as PortId }));
  if (modules.includes('lfo')) routes.push({ from: 'lfo:out', to: 'filter:mod' });
  if (modules.includes('sequencer')) routes.push({ from: 'sequencer:out', to: 'oscillator:pitch' });
  return routes;
}

export function connectPorts(connections: Connection[], a: PortId, b: PortId, allowed: readonly Connection[] = requiredConnections): Connection[] | null {
  if (!ports[a] || !ports[b] || ports[a].direction === ports[b].direction || ports[a].kind !== ports[b].kind) return null;
  const from = ports[a].direction === 'out' ? a : b;
  const to = ports[a].direction === 'in' ? a : b;
  if (!allowed.some(c => c.from === from && c.to === to)) return null;
  return [...connections.filter(c => c.from !== from && c.to !== to), { from, to }];
}

export function disconnectPort(connections: Connection[], port: PortId): Connection[] {
  return connections.filter(c => c.from !== port && c.to !== port);
}

export function isCompletePatch(patch: Patch, required = routesForPatch(patch)): boolean {
  return patch.connections.length === required.length && required.every(required =>
    patch.connections.some(c => c.from === required.from && c.to === required.to));
}

export function clonePatch(patch: Patch): Patch {
  return { parameters: { ...patch.parameters }, connections: patch.connections.map(c => ({ ...c })), ...(patch.modules ? { modules: [...patch.modules] } : {}) };
}
