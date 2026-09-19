import { AudioEngine } from '../audio/engine.ts';
import { clonePatch, isCompletePatch } from '../connections/patch.ts';
import { firstSignal } from '../levels/first-signal.ts';
import { moduleDefinitions, waveforms, type ParameterId, type PortId, type Waveform } from '../modules/definitions.ts';
import { scorePatch, type ScoreResult } from '../scoring/score.ts';
import { CableUI } from './cables.ts';
import { getGuidance, type LearningState } from './guidance.ts';
import { bindKnob, knobMarkup } from './knob.ts';

const playIcon = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 9 6-9 6Z" fill="currentColor"/></svg>';
const wavePaths: Record<Waveform, string> = {
  sine: 'M2 16 C8 0 14 0 20 16 S32 32 38 16 S50 0 56 16',
  square: 'M2 25 V7 H15 V25 H29 V7 H43 V25 H56',
  sawtooth: 'M2 25 19 7 V25 L37 7 V25 L55 7 V25',
  triangle: 'M2 16 11 6 29 26 47 6 56 16',
};
const waveHints: Record<Waveform, string> = { sine: 'Sine · suau i pur', square: 'Square · buit i electrònic', sawtooth: 'Sawtooth · brillant i aspre', triangle: 'Triangle · suau i càlid' };
const waveSvg = (wave: Waveform) => `<svg viewBox="0 0 58 32" aria-hidden="true"><path d="${wavePaths[wave]}"/></svg>`;
const jackMarkup = (port: PortId) => `<div class="jack-group"><span>${port.endsWith(':out') ? 'OUT' : 'IN'}</span><button class="jack" data-port="${port}" type="button"><span></span></button></div>`;

export function mountLab(root: HTMLElement): void {
  const level = firstSignal;
  let patch = clonePatch(level.initial);
  let playing: 'target' | 'player' | null = null;
  let request = 0;
  let lastResult: ScoreResult | null = null;
  const learning: LearningState = { heardTarget: false, heardPlayer: false, checked: false, solved: false };
  const engine = new AudioEngine();
  const moduleMarkup = moduleDefinitions.map((module, index) => {
    const content = module.id === 'oscillator'
      ? `<div class="wave-selector" role="group" aria-label="Forma d’ona">${waveforms.map(w => `<button type="button" class="wave-button" data-wave="${w}" aria-label="${w}" aria-pressed="${w === patch.parameters.waveform}">${waveSvg(w)}<span>${w}</span></button>`).join('')}</div><p id="wave-hint" class="wave-hint">${waveHints[patch.parameters.waveform]}</p><div class="osc-knob">${knobMarkup('frequency', patch.parameters.frequency)}</div>`
      : module.id === 'filter'
        ? `<div class="filter-type"><span class="mini-led"></span> LOW PASS <span class="filter-line"><svg viewBox="0 0 72 25" aria-hidden="true"><path d="M1 6h29c13 0 16 3 20 12l4 5h17"/></svg></span></div><div class="filter-knobs">${knobMarkup('cutoff', patch.parameters.cutoff)}${knobMarkup('resonance', patch.parameters.resonance)}</div><p class="filter-note">Deixa passar els greus.<br/>Suavitza els aguts.</p>`
        : `<div class="output-display"><div class="display-heading"><span>SIGNAL</span><span id="signal-caption">NO INPUT</span></div><div class="signal-trace" aria-hidden="true"><svg viewBox="0 0 220 65"><path class="trace-idle" d="M0 33h220"/><path class="trace-active" d="M0 33h18l7-8 9 18 12-33 15 45 15-40 15 29 12-17 9 6h16l8-16 12 32 13-41 13 41 10-30 9 14h27"/></svg></div><div class="meter" aria-hidden="true">${'<i></i>'.repeat(18)}</div></div><div class="speaker" aria-hidden="true"><div class="speaker-center"></div></div><p class="output-note">Aquí arriba el teu so.</p>`;
    return `<section class="module module-${module.id}" aria-labelledby="title-${module.id}"><i class="screw screw-tl" aria-hidden="true"></i><i class="screw screw-tr" aria-hidden="true"></i><i class="screw screw-bl" aria-hidden="true"></i><i class="screw screw-br" aria-hidden="true"></i><header class="module-header"><div><span class="module-number">0${index + 1} / ${module.id === 'oscillator' ? 'SOURCE' : module.id === 'filter' ? 'SHAPE' : 'LISTEN'}</span><h2 id="title-${module.id}">${module.title}</h2><p>${module.description}</p></div><span class="module-led" data-led="${module.id}" aria-hidden="true"></span></header><div class="module-body">${content}</div><div class="patch-bay">${module.ports.map(jackMarkup).join('')}<span class="bay-label">${module.id === 'oscillator' ? 'AUDIO SOURCE' : module.id === 'filter' ? 'AUDIO PROCESSOR' : 'AUDIO OUTPUT'}</span></div></section>`;
  }).join('');

  root.innerHTML = `<div class="app-shell">
    <header class="topbar"><a class="brand" href="./" aria-label="Signal Lab, inici"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M2 16h6l4-11 9 22 4-11h5"/></svg><span>SIGNAL<span class="brand-light">LAB</span></span></a><span class="topbar-description">UN PETIT LABORATORI DE SO</span><div class="prototype-badge"><span></span> PROTOTIP 01</div></header>
    <main>
      <div class="level-intro"><div><p class="eyebrow">EXPERIMENT 001 <span>/</span> EL PRIMER PATCH</p><h1>${level.title}<span>.</span></h1><p class="intro-description">${level.description}</p></div><div class="level-tag"><span class="tiny-grid" aria-hidden="true">▦</span> NIVELL 01 <span>/ 01</span></div></div>
      <section class="target-card" aria-label="So objectiu"><div class="target-label"><span class="target-symbol" aria-hidden="true">◎</span><div><span class="eyebrow">EL TEU OBJECTIU</span><h2>Escolta. I torna'l a crear.</h2><p>Pots escoltar-lo tantes vegades com vulguis.</p></div></div><div class="target-wave" aria-hidden="true">${Array.from({length: 39}, (_, i) => `<i style="--h:${8 + Math.abs(Math.sin(i * 1.9)) * (Math.sin(i / 38 * Math.PI) * 32)}px;--delay:${i * 25}ms"></i>`).join('')}</div><button id="play-target" class="button target-button">${playIcon}<span>PLAY TARGET</span><small>02 s</small></button></section>
      <div class="workbench-heading"><h2>El teu laboratori</h2><span><i class="status-dot"></i><span id="connection-count">0 / 2 CABLES</span></span></div>
      <ol class="steps"><li data-step="1"><b>1</b><span><strong>Connecta</strong> els connectors amb cables.</span></li><li data-step="2"><b>2</b><span><strong>Ajusta</strong> els knobs i escolta.</span></li><li data-step="3"><b>3</b><span><strong>Compara</strong> el so amb l’objectiu.</span></li></ol>
      <p class="learning-guide" id="learning-guide" role="status"></p>
      <div class="rack" id="rack"><div class="rack-rail rail-top" aria-hidden="true"></div><div class="modules">${moduleMarkup}</div><svg class="cables" aria-hidden="true"></svg><div class="rack-rail rail-bottom" aria-hidden="true"></div><div class="rack-caption" aria-hidden="true"><span>SL–01</span><span>MODULAR SOUND LABORATORY</span><span>●</span></div></div>
      <div class="cable-instructions"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4v5a6 6 0 0 0 12 0V4M2 3h4M14 3h4"/></svg><p id="connection-help" role="status">Clica OUT i després IN, o arrossega un cable. Clica un connector ocupat per desconnectar.</p></div>
      <div class="transport"><button class="reset-button" id="reset"><span aria-hidden="true">↺</span> Reinicia el patch</button><p class="transport-note" id="patch-status"><span class="status-dot"></span> El so necessita un camí.</p><div class="transport-actions"><button id="play-player" class="button player-button">${playIcon}<span>PLAY MY SOUND</span></button><button id="check" class="button check-button"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-8"/></svg> CHECK</button></div></div>
      <section id="result" class="result" aria-label="Resultat de la comparació"><div class="result-overview"><div class="score-block"><span class="eyebrow" id="score-label">COINCIDÈNCIA</span><div><strong id="score">—</strong><span>%</span></div></div><div class="result-content"><h3 id="result-title">Cada ajust et porta més a prop.</h3><p id="result-hint">Escolta l’objectiu, construeix el teu so i prem CHECK.</p><div class="score-track"><div id="score-fill"></div></div></div><div class="result-stamp" id="result-stamp" aria-hidden="true">◎</div></div><div class="parameter-feedback" id="parameter-feedback" aria-label="Pistes per paràmetre" hidden></div></section><p class="sr-only" id="result-announcement" role="status" aria-live="polite"></p>
    </main><footer class="footer"><span>ESCOLTA. CONNECTA. DESCOBREIX.</span><span>Arrossega els knobs ↕ <span class="footer-separator">/</span> Shift per afinar <span class="footer-separator">/</span> També pots escriure els valors</span></footer>
  </div>`;

  const get = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const setHelp = (message: string) => { get('#connection-help').textContent = message; };
  const updateGuidance = () => {
    const guide = getGuidance(patch, learning);
    get('#learning-guide').textContent = guide.text;
    root.querySelectorAll<HTMLElement>('[data-step]').forEach(step => {
      const number = Number(step.dataset.step);
      const done = learning.solved || (number === 1 ? isCompletePatch(patch) : number === 2 ? learning.heardPlayer : false);
      step.classList.toggle('step-done', done);
      step.classList.toggle('step-current', number === guide.step);
      if (number === guide.step) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
    get('#play-target').classList.toggle('suggested-action', guide.action === 'target');
    get('#play-player').classList.toggle('suggested-action', guide.action === 'player');
    get('#check').classList.toggle('suggested-action', guide.action === 'check');
  };
  const setPlayback = (state: typeof playing) => {
    playing = state;
    root.dataset.playing = state ?? '';
    get('#play-target').classList.toggle('is-playing', state === 'target');
    get('#play-player').classList.toggle('is-playing', state === 'player');
    get('#play-target span').textContent = state === 'target' ? 'STOP TARGET' : 'PLAY TARGET';
    get('#play-player span').textContent = state === 'player' ? 'STOP MY SOUND' : 'PLAY MY SOUND';
    get('#signal-caption').textContent = state === 'player' ? 'PLAYING' : isCompletePatch(patch) ? 'READY' : 'NO INPUT';
  };
  const stop = () => { request++; engine.stop(); setPlayback(null); };
  const clearResult = () => {
    lastResult = null;
    learning.checked = false;
    learning.solved = false;
    get('#result').classList.remove('solved', 'stale');
    get('#score-label').textContent = 'COINCIDÈNCIA';
    get('#score').textContent = '—';
    get('#score-fill').style.width = '0%';
    get('#result-title').textContent = 'Cada ajust et porta més a prop.';
    get('#result-hint').textContent = 'Prem CHECK per comparar el patch actual amb l’objectiu.';
    get('#result-stamp').textContent = '◎';
    get('#result-announcement').textContent = '';
    get('#parameter-feedback').hidden = true;
    get('#parameter-feedback').replaceChildren();
  };
  const changed = (topology = false) => {
    if (topology && playing === 'player') stop();
    else if (playing === 'player') engine.updateParameters(patch.parameters);
    learning.heardPlayer = playing === 'player';
    learning.checked = false;
    learning.solved = false;
    if (lastResult) {
      get('#result').classList.remove('solved');
      get('#result').classList.add('stale');
      get('#score-label').textContent = 'RESULTAT ANTERIOR';
      get('#result-title').textContent = 'Has ajustat el patch.';
      get('#result-hint').textContent = 'Aquesta puntuació és de l’última comprovació. Prem CHECK per valorar els canvis.';
      get('#result-stamp').textContent = '↻';
      get('#parameter-feedback').hidden = true;
      get('#result-announcement').textContent = '';
    }
    updateGuidance();
  };
  const updateConnections = () => {
    const complete = isCompletePatch(patch);
    get('#connection-count').textContent = `${patch.connections.length} / 2 CABLES`;
    get('#patch-status').innerHTML = `<span class="status-dot ${complete ? 'ready' : ''}"></span> ${complete ? 'Circuit complet. Fes-lo sonar.' : 'El so necessita un camí.'}`;
    root.dataset.connected = String(complete);
    if (playing !== 'player') get('#signal-caption').textContent = complete ? 'READY' : 'NO INPUT';
    root.querySelectorAll<HTMLElement>('[data-led]').forEach(led => led.classList.toggle('on', complete));
  };
  const cables = new CableUI(get('#rack'), connections => {
    patch.connections = connections;
    changed(true);
    updateConnections();
  }, setHelp);
  const knobSetters = (['frequency', 'cutoff', 'resonance'] as ParameterId[]).map(id =>
    ({ id, set: bindKnob(root, id, patch.parameters[id], value => { patch.parameters[id] = value; changed(); }) }));
  const updateWaveform = () => {
    root.querySelectorAll<HTMLElement>('[data-wave]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.wave === patch.parameters.waveform)));
    get('#wave-hint').textContent = waveHints[patch.parameters.waveform];
  };
  root.querySelectorAll<HTMLButtonElement>('[data-wave]').forEach(button => button.addEventListener('click', () => {
    if (patch.parameters.waveform === button.dataset.wave) return;
    patch.parameters.waveform = button.dataset.wave as Waveform;
    updateWaveform(); changed();
  }));
  const play = async (kind: 'target' | 'player') => {
    if (playing === kind) { stop(); return; }
    stop();
    if (kind === 'player' && !isCompletePatch(patch)) {
      setHelp('Encara no arriba cap so a OUTPUT. Connecta OSCILLATOR OUT → FILTER IN i FILTER OUT → OUTPUT IN.');
      return;
    }
    const current = request;
    setPlayback(kind);
    try {
      const started = await engine.play(kind === 'target' ? level.target : patch, level.duration, () => {
        if (current === request) setPlayback(null);
      });
      if (!started && current === request) setPlayback(null);
      if (started && current === request) {
        if (kind === 'target') learning.heardTarget = true;
        else learning.heardPlayer = true;
        updateGuidance();
      }
    } catch {
      if (current !== request) return;
      stop();
      setHelp('No s’ha pogut iniciar l’àudio. Torna a prémer PLAY en un navegador compatible amb Web Audio.');
    }
  };
  get('#play-target').addEventListener('click', () => { void play('target'); });
  get('#play-player').addEventListener('click', () => { void play('player'); });
  get('#check').addEventListener('click', () => {
    const result = scorePatch(patch, level.target);
    lastResult = result;
    learning.checked = result.complete;
    learning.solved = result.solved;
    get('#result').classList.remove('stale');
    get('#score-label').textContent = 'COINCIDÈNCIA';
    get('#score').textContent = String(result.score);
    get('#score-fill').style.width = `${result.score}%`;
    get('#result-title').textContent = result.solved ? 'Experiment completat.' : !result.complete ? 'Primer, connecta les màquines.' : result.score >= 80 ? 'Ja gairebé el tens.' : 'El so comença a prendre forma.';
    get('#result-hint').textContent = result.hint;
    get('#result').classList.toggle('solved', result.solved);
    get('#result-stamp').textContent = result.solved ? '✓' : '◎';
    get('#result-announcement').textContent = `${result.score}%. ${result.hint}`;
    const icons = { match: '✓', change: '↔', up: '↑', down: '↓' };
    get('#parameter-feedback').innerHTML = result.feedback.map(item => `<div class="feedback-item ${item.direction === 'match' ? 'feedback-match' : ''}"><div class="feedback-title"><strong>${item.label}</strong><span>${item.percent}%</span></div><span class="feedback-control">${item.control}</span><div class="feedback-meter" aria-hidden="true"><i style="width:${item.percent}%"></i></div><p><span aria-hidden="true">${icons[item.direction]}</span> ${item.instruction}</p></div>`).join('');
    get('#parameter-feedback').hidden = !result.complete;
    updateGuidance();
  });
  get('#reset').addEventListener('click', () => {
    stop();
    patch = clonePatch(level.initial);
    learning.heardPlayer = false;
    cables.setConnections(patch.connections);
    knobSetters.forEach(({ id, set }) => set(patch.parameters[id]));
    updateWaveform(); updateConnections(); clearResult();
    setHelp('Patch reiniciat. Clica OUT i després IN, o arrossega un cable.');
    updateGuidance();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
  updateConnections();
  updateGuidance();
}
