import { connectPorts, disconnectPort, requiredConnections } from '../connections/patch.ts';
import { ports, type Connection, type PortId } from '../modules/definitions.ts';

interface Point { x: number; y: number }
const svgNS = 'http://www.w3.org/2000/svg';

export class CableUI {
  private lifecycle = new AbortController();
  private observer: ResizeObserver;
  private routes: readonly Connection[];
  private root: HTMLElement;
  private svg: SVGSVGElement;
  private connections: Connection[] = [];
  private pending: PortId | null = null;
  private cursor: Point | null = null;
  private onChange: (connections: Connection[]) => void;
  private announce: (message: string) => void;

  constructor(root: HTMLElement, onChange: (connections: Connection[]) => void, announce: (message: string) => void, routes = requiredConnections) {
    this.routes = routes;
    this.root = root;
    this.svg = root.querySelector<SVGSVGElement>('.cables')!;
    this.onChange = onChange;
    this.announce = announce;
    let drag: { port: PortId; x: number; y: number; moved: boolean; pointer: number } | null = null;
    let suppressClick = false;
    root.querySelectorAll<HTMLButtonElement>('[data-port]').forEach(button => {
      const port = button.dataset.port as PortId;
      button.addEventListener('click', () => {
        if (suppressClick) return;
        if (this.pending) this.finish(port);
        else if (this.connections.some(c => c.from === port || c.to === port)) {
          this.commit(disconnectPort(this.connections, port));
          announce('Cable desconnectat. Clica dos connectors per tornar-los a unir.');
        } else this.select(port);
      });
      button.addEventListener('pointerdown', event => {
        if (event.button === 0) drag = { port, x: event.clientX, y: event.clientY, moved: false, pointer: event.pointerId };
      });
    });
    const listen = <K extends keyof WindowEventMap>(name: K, handler: (event: WindowEventMap[K]) => void) => window.addEventListener(name, handler, { signal: this.lifecycle.signal });
    listen('pointermove', event => {
      if (!drag || drag.pointer !== event.pointerId) return;
      if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
      drag.moved = true;
      this.pending = drag.port;
      const rect = this.root.getBoundingClientRect();
      this.cursor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      this.draw();
    });
    listen('pointerup', event => {
      if (!drag || drag.pointer !== event.pointerId) return;
      if (drag.moved) {
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 0);
        const button = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-port]');
        if (button) this.finish(button.dataset.port as PortId);
        else this.cancel();
      }
      drag = null;
    });
    listen('pointercancel', () => { drag = null; this.cancel(); });
    listen('keydown', event => { if (event.key === 'Escape') { drag = null; this.cancel(); } });
    this.observer = new ResizeObserver(() => this.draw());
    this.observer.observe(root);
  }

  dispose(): void { this.lifecycle.abort(); this.observer.disconnect(); }

  setConnections(connections: Connection[]): void {
    this.connections = connections;
    this.pending = null;
    this.cursor = null;
    this.draw();
  }

  private select(port: PortId): void {
    this.pending = port;
    this.cursor = null;
    this.announce('Ara clica el connector il·luminat. Esc per cancel·lar.');
    this.draw();
  }

  private cancel(): void {
    const hadPending = this.pending !== null;
    this.pending = null;
    this.cursor = null;
    this.draw();
    if (hadPending) this.announce('Connexió cancel·lada. Clica OUT i després IN per connectar.');
  }

  private finish(port: PortId): void {
    if (!this.pending || port === this.pending) { this.cancel(); return; }
    const next = connectPorts(this.connections, this.pending, port, this.routes);
    if (!next) {
      this.cancel();
      this.announce('Aquesta connexió no és vàlida. Tria el connector il·luminat; els cables violetes van a MOD o PITCH.');
      return;
    }
    this.commit(next);
    this.announce(next.length === this.routes.length ? 'Circuit complet. Ja pots escoltar el teu so.' : 'Cable connectat. Continua pels connectors il·luminats.');
  }

  private commit(connections: Connection[]): void {
    this.setConnections(connections);
    this.onChange(connections);
  }

  private point(port: PortId): Point {
    const rect = this.root.querySelector<HTMLElement>(`[data-port="${port}"]`)!.getBoundingClientRect();
    const parent = this.root.getBoundingClientRect();
    return { x: rect.left + rect.width / 2 - parent.left, y: rect.top + rect.height / 2 - parent.top };
  }

  private path(from: Point, to: Point, color: string, preview = false): void {
    const path = document.createElementNS(svgNS, 'path');
    const sag = Math.min(90, Math.max(48, Math.abs(to.x - from.x) * 0.3));
    const d = Math.abs(to.y - from.y) > 130
      ? `M ${from.x} ${from.y} Q ${from.x} ${from.y + 42}, ${from.x - 24} ${from.y + 42} L 8 ${from.y + 42} L 8 ${to.y + 42} L ${to.x - 24} ${to.y + 42} Q ${to.x} ${to.y + 42}, ${to.x} ${to.y}`
      : `M ${from.x} ${from.y} C ${from.x} ${from.y + sag}, ${to.x} ${to.y + sag}, ${to.x} ${to.y}`;
    path.setAttribute('d', d);
    path.setAttribute('class', preview ? 'cable cable-preview' : 'cable cable-shadow');
    path.setAttribute('stroke', preview ? color : '#080a09');
    this.svg.append(path);
    if (!preview) {
      const wire = path.cloneNode() as SVGPathElement;
      wire.setAttribute('class', 'cable cable-wire');
      wire.setAttribute('stroke', color);
      this.svg.append(wire);
      const highlight = path.cloneNode() as SVGPathElement;
      highlight.setAttribute('class', 'cable cable-highlight');
      highlight.setAttribute('stroke', '#ffffff');
      this.svg.append(highlight);
    }
  }

  private draw(): void {
    this.svg.replaceChildren();
    this.svg.setAttribute('viewBox', `0 0 ${this.root.clientWidth} ${this.root.clientHeight}`);
    const nextCable = this.routes.find(required => !this.connections.some(c => c.from === required.from && c.to === required.to));
    this.root.querySelectorAll<HTMLElement>('[data-port]').forEach(button => {
      const port = button.dataset.port as PortId;
      const connection = this.connections.find(c => c.from === port || c.to === port);
      const valid = this.pending && port !== this.pending && connectPorts(this.connections, this.pending, port, this.routes) !== null;
      button.classList.toggle('connected', !!connection);
      button.classList.toggle('selected', this.pending === port);
      button.classList.toggle('compatible', !!valid);
      button.classList.toggle('suggested', !this.pending && port === nextCable?.from);
      button.style.setProperty('--cable-color', connection && ports[connection.from].kind === 'control' ? '#b6a1dc' : connection?.from === 'filter:out' ? '#a6c9d3' : '#d9b16f');
      button.setAttribute('aria-pressed', String(this.pending === port));
      button.setAttribute('aria-label', `${ports[port].label}${connection ? ', connectat; clica per desconnectar' : ', lliure'}`);
    });
    for (const c of this.connections) this.path(this.point(c.from), this.point(c.to), ports[c.from].kind === 'control' ? '#b6a1dc' : c.from === 'filter:out' ? '#a6c9d3' : '#d9b16f');
    if (this.pending && this.cursor) this.path(this.point(this.pending), this.cursor, '#d0e9a4', true);
  }
}
