# Signal Lab

Un únic nivell jugable de puzzles de síntesi musical. Escolta el so objectiu i recrea'l connectant tres màquines: **OSCILLATOR → FILTER → OUTPUT**.

## Executar en local

Requisits: Node.js 22.18+ o 24+ i npm. Des d'aquesta carpeta:

```sh
npm install
npm run dev
```

Obre l'adreça local que imprimeix Vite (normalment http://127.0.0.1:5173).

```sh
npm run build    # Comprovació TypeScript i compilació a dist/
npm run preview  # Servir la compilació localment
npm test         # Proves de connexions, controls i puntuació
```

Les úniques dependències directes són TypeScript i Vite, per al desenvolupament. L'aplicació no necessita dependències en temps d'execució, serveis externs, fonts remotes ni backend.

## Com jugar

1. Prem **PLAY TARGET** per escoltar una nota de dos segons.
2. Clica **OUT** de l'oscil·lador i **IN** del filtre. Després, **OUT** del filtre i **IN** de la sortida. També pots arrossegar els cables o fer les connexions en ordre invers.
3. Tria sine, square, sawtooth o triangle. Ajusta FREQUENCY, CUTOFF i RESONANCE.
4. Prem **PLAY MY SOUND** i compara'l amb l'objectiu.
5. Prem **CHECK**. Rebràs una puntuació de 0 a 100% i quatre pistes: forma d'ona, to, brillantor i caràcter. Cada pista indica si el control està encertat o si cal pujar-lo, baixar-lo o canviar l'ona. El 100% completa el nivell.

La guia sobre les màquines indica el següent pas. Un contorn discontinu assenyala el connector de sortida per on començar; en seleccionar-lo, s'il·lumina el connector compatible. La guia s'adapta encara que facis les connexions en un altre ordre.

Controls:

- Knobs: arrossega amunt/avall; mantén Shift per afinar. També pots escriure el valor numèric.
- Teclat: Tab per navegar; fletxes per ajustar un knob; Page Up/Down per fer passos més grans; Home/End per als extrems; Enter/Espai per activar un connector.
- Clica un connector ocupat per retirar-ne el cable. Esc cancel·la una connexió pendent.
- Torna a prémer el botó de reproducció per aturar el so. Una nova reproducció atura l'anterior. Durant PLAY MY SOUND, els knobs i la forma d'ona actualitzen la veu existent; els valors numèrics fan una transició curta i suau. La nota continua durant els seus dos segons originals. Canviar cables atura la nota del jugador. Ajustar el patch mentre sona l'objectiu no modifica el so objectiu.
- **Reinicia el patch** restaura els valors inicials, elimina els cables i atura l'àudio.

Després d'editar un patch ja avaluat, la puntuació es conserva amb l'etiqueta **RESULTAT ANTERIOR**. Les pistes antigues s'amaguen fins que tornes a prémer CHECK, per evitar confondre-les amb l'estat actual.

El patch comença desconnectat. Si falta un cable, PLAY MY SOUND no emet so i CHECK dona 0%. El joc no guarda la partida; recarregar la pàgina la reinicia.

## Arquitectura mínima

```text
src/
  audio/engine.ts          Web Audio, construcció del graf i cicle de vida de les notes
  modules/definitions.ts   Tipus, formes d'ona, ports, rangs i definicions dels mòduls
  connections/patch.ts     Connexions permeses, desconnexió i validació del patch
  levels/first-signal.ts   Definició de l'únic nivell, patch inicial i objectiu
  scoring/score.ts         Comparació de paràmetres i pistes, sense dependències de la UI
  ui/lab.ts               Estat del joc, panells i interaccions
  ui/knob.ts              Control per ratolí, tacte, teclat i entrada numèrica
  ui/cables.ts            Connexions per clic/arrossegament i representació SVG
  ui/guidance.ts          Guia d'aprenentatge segons el progrés del jugador
  style.css              Aparença dels panells i adaptació a pantalles estretes
  main.ts                Entrada de l'aplicació
```

L'estat `Patch` conté els paràmetres i una llista de connexions entre ports. La UI el modifica; el motor rep una còpia per cada reproducció i actualitzacions dels paràmetres durant la nota del jugador. La puntuació el compara amb l'objectiu del nivell, que no es modifica. No s'inclou cap mòdul addicional.

Per afegir mòduls més endavant cal ampliar els tipus i definicions, registrar els nodes d'àudio corresponents i definir les connexions del nou nivell. Els controls visuals, el graf d'àudio i l'avaluació es mantenen en fitxers separats.

## Àudio i puntuació

Tant l'objectiu com el jugador utilitzen `createVoice`: `OscillatorNode` → `BiquadFilterNode` de tipus lowpass → `GainNode` → sortida del navegador. Només es connecten els nodes indicats pels cables del patch. El guany fix de 0,045 i els fades d'entrada/sortida són idèntics per als dos sons. El context s'activa després de prémer PLAY; no hi ha autoplay.

No s'utilitza FFT ni cap anàlisi d'àudio per puntuar. Els gràfics i LEDs de la interfície són indicadors d'activitat, no oscil·loscopis ni mesuradors de nivell.

Amb el circuit complet, la puntuació és la suma ponderada de:

| Paràmetre | Pes | Similitud |
| --- | ---: | --- |
| Forma d'ona | 30% | Coincidència exacta |
| Freqüència | 30% | Distància logarítmica en octaves; 0 a partir de 2 octaves |
| Cutoff | 25% | Distància logarítmica en octaves; 0 a partir de 4 octaves |
| Resonance | 15% | Distància lineal sobre el rang 0,1–8 |

Les similituds es limiten a [0, 1]. El resultat es limita a [0, 100]; qualsevol diferència es queda com a màxim en 99%. El 100% exigeix tots els valors exactes. La pista correspon al paràmetre amb menys similitud i indica en quina direcció ajustar-lo.

Les quatre targetes mostren les similituds individuals abans d'aplicar els pesos. Cada targeta reserva el 100% per a la coincidència exacta. No es mostren valors objectiu ni pistes per paràmetre quan el circuit està incomplet.

## Validació

- `npm test`: 13 proves amb el runner integrat de Node. Comproven connexions invàlides, desconnexió, aïllament de l'objectiu, puntuació, límits, pistes individuals i guia d'aprenentatge, inclòs l'ordre invers de les connexions.
- Amb `npm run dev` actiu, obre `/tests/audio.html` i prem **Executa les proves**: 10 proves amb `OfflineAudioContext` i el motor real, sense emetre àudio. Comproven mostres idèntiques per al mateix patch, silenci quan falten cables, diferències entre formes d'ona, efecte dels controls, absència de saturació en els casos límit a 44,1/48 kHz i final de nota. També verifiquen els canvis en viu dels knobs i la forma d'ona sense reiniciar ni allargar la nota.
- Recorregut de UI comprovat al navegador: puntuació inicial de 0%, connexió per clic i arrossegament, knobs amb teclat i ratolí, valors numèrics, reproducció, canvi entre target/jugador, reinici i solució al 100%.

<details>
<summary>Solució del nivell (per a desenvolupament)</summary>

Sawtooth, frequency **220 Hz**, cutoff **900 Hz**, resonance **2,4 Q**, amb els dos cables connectats.

</details>

Referències tècniques: [Vite](https://vite.dev/guide/), [BiquadFilterNode](https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode) i [AudioContext.resume](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume).
