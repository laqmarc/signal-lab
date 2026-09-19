import { ports, type Connection, type Patch, type PortId } from '../modules/definitions.ts';

export const requiredConnections: readonly Connection[] = [
  { from: 'oscillator:out', to: 'filter:in' },
  { from: 'filter:out', to: 'output:in' },
];

// The level limits the topology; new levels can supply their own allowed routes.
export function connectPorts(connections: Connection[], a: PortId, b: PortId): Connection[] | null {
  if (ports[a].direction === ports[b].direction) return null;
  const from = ports[a].direction === 'out' ? a : b;
  const to = ports[a].direction === 'in' ? a : b;
  if (!requiredConnections.some(c => c.from === from && c.to === to)) return null;
  return [...connections.filter(c => c.from !== from && c.to !== to), { from, to }];
}

export function disconnectPort(connections: Connection[], port: PortId): Connection[] {
  return connections.filter(c => c.from !== port && c.to !== port);
}

export function isCompletePatch(patch: Patch): boolean {
  return patch.connections.length === requiredConnections.length && requiredConnections.every(required =>
    patch.connections.some(c => c.from === required.from && c.to === required.to));
}

export function clonePatch(patch: Patch): Patch {
  return { parameters: { ...patch.parameters }, connections: patch.connections.map(c => ({ ...c })) };
}
