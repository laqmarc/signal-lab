# Signal Lab

Un laboratori de puzzles de síntesi musical amb **24 experiments, 6 capítols i 10 màquines**. Escolta un so objectiu, connecta el circuit i ajusta els controls fins a recrear-lo.

## Executar en local

Node.js 22.18+ o 24+ i npm:

```sh
npm install
npm run dev
npm run build    # TypeScript + compilació a dist/
npm run preview  # Serveix la compilació
npm test         # Proves de lògica, campanya i persistència
```

Obre l'adreça de Vite, normalment http://127.0.0.1:5173. Les úniques dependències són TypeScript i Vite per al desenvolupament. No hi ha backend, fonts remotes, llibreries d'àudio ni serveis externs.

## Com jugar

1. Tria un experiment al selector **ELS EXPERIMENTS**. Tots estan disponibles; l'ordre proposat introdueix els conceptes gradualment.
2. Prem **PLAY TARGET**. La durada de cada frase apareix al botó.
3. Uneix els connectors il·luminats amb clics o arrossegant cables. La guia explica el següent pas i també admet connectar en ordre invers.
4. Ajusta els knobs i prem **PLAY MY SOUND**. Els cables violetes porten control: LFO → FILTER MOD i SEQUENCER → OSCILLATOR PITCH.
5. Prem **CHECK**. Cada control actiu rep una pista de direcció, sense mostrar el valor objectiu. El 100% completa el nivell i habilita **SEGÜENT EXPERIMENT**.

| Capítol | Nivells | Aprenentatge |
| --- | --- | --- |
| Els fonaments | 1–4 | Ones, to i filtre |
| La forma del temps | 5–8 | Envelope i Noise |
| Moviment i textura | 9–12 | LFO i Distortion |
| Espais i ecos | 13–16 | Delay i Reverb |
| Petites melodies | 17–20 | Sequencer, intervals i tempo |
| El laboratori complet | 21–24 | Combinacions de màquines |

## Màquines

| Màquina | Controls | Efecte real |
| --- | --- | --- |
| OSCILLATOR | sine, square, sawtooth, triangle; frequency | Genera una ona periòdica |
| FILTER | cutoff, resonance | Filtre lowpass |
| ENVELOPE | attack, release | Entrada i desaparició del volum |
| LFO | rate, depth | Modula la freqüència del filtre amb una ona lenta |
| NOISE | level | Genera soroll blanc |
| DISTORTION | drive | Saturació amb una corba de waveshaping |
| DELAY | time, mix | Eco amb feedback fix de 0,3 |
| REVERB | decay, mix | Convolució amb una resposta impulsional generada |
| SEQUENCER | tempo, step 1–4 | Repeteix quatre notes, en semitons sobre la freqüència base |
| OUTPUT | — | Sortida d'àudio |

Envelope fa una entrada, una breu fase sostinguda i una sortida. Quan comparteix patch amb Sequencer, sosté la frase abans del release. Delay i Reverb disposen d'un tram final per escoltar les cues; tota reproducció té durada limitada i fade final. Noise i les respostes de Reverb utilitzen una llavor fixa perquè target i jugador siguin reproduïbles.

Controls:

- Arrossega els knobs verticalment; **Shift** afina. També pots escriure el valor.
- **Tab**, fletxes, **Page Up/Down** i **Home/End** permeten jugar amb teclat. Enter/Espai activa els connectors; **Esc** cancel·la una connexió pendent.
- Clica un connector ocupat per retirar-ne el cable. Un patch incomplet, inclosos els cables de control, no sona i puntua 0%.
- Els controls de timbre, volum, modulació i mescla s'actualitzen durant la reproducció del jugador. **Attack, release, decay, tempo i notes aturen la frase: torna a prémer PLAY per escoltar la nova configuració.** Canviar cables també atura la veu.
- Una reproducció substitueix l'anterior. Canviar de nivell o ocultar la pàgina atura l'àudio. Editar el patch no altera el target.
- **Reinicia el patch** restaura controls i cables, conservant el rècord. Si edites després de CHECK, el resultat s'etiqueta **RESULTAT ANTERIOR** fins a tornar a comprovar-lo.

## Progrés

Cada experiment conserva el patch, l'última comprovació, el millor resultat i els passos d'aprenentatge. El selector mostra els rècords i el nombre de nivells completats. Es recupera l'últim experiment visitat sense autoplay. El primer nivell manté el seu identificador, revisió i format de desat: les partides de la versió anterior continuen funcionant.

Les dades són locals al navegador i a l'origen: `localhost`, `127.0.0.1` i ports diferents tenen partides separades. No hi ha compte ni sincronització. Si l'emmagatzematge falla, el joc ho indica i permet continuar jugant. Les dades invàlides s'ignoren. Cada escriptura conserva el rècord més alt que ja hi havia desat, encara que vingui d'una altra pestanya.

## Arquitectura

```text
src/
  audio/engine.ts          Graf Web Audio, veus, textures i cicle de vida
  modules/definitions.ts   Màquines, ports, tipus i rangs dels controls
  connections/patch.ts     Rutes d'àudio/control i validació de connexions
  levels/first-signal.ts   Contracte Level i primer experiment compatible
  levels/catalog.ts        Campanya de 24 experiments i últim nivell visitat
  scoring/score.ts         Comparació dels paràmetres actius i pistes
  progress/storage.ts      Desat per nivell, validació i recuperació
  ui/lab.ts               Panells, selector, progrés i interaccions
  ui/knob.ts              Controls de ratolí, tacte, teclat i valors numèrics
  ui/cables.ts            Cables SVG i interacció dels connectors
  ui/guidance.ts          Guia contextual d'aprenentatge
  style.css              Panells físics i distribució adaptable
```

`Patch.modules` enumera les màquines disponibles. Les màquines d'àudio segueixen aquest ordre; LFO i Sequencer tenen rutes de control pròpies. Només es connecten els nodes indicats als cables. La UI i la puntuació deriven els controls de les definicions dels mòduls. Afegir un experiment amb màquines existents només requereix definir-lo al catàleg.

El motor rep una còpia del patch. Target i jugador utilitzen el mateix constructor `createVoice`, guany de sortida 0,045 i fades. La UI disposa listeners i observadors en canviar de nivell, i el motor tanca el context anterior.

El desat usa `localStorage`, esquema versionat i una revisió per nivell. Canvis incompatibles d'objectiu, controls o puntuació han d'incrementar `Level.revision`. Es validen màquines, rangs, passos i cables abans de restaurar. Els ajustos es desen després de 180 ms; CHECK, reinici, navegació i sortida desen immediatament els canvis pendents.

## Puntuació

No s'utilitza FFT ni comparació d'àudio. Només puntuen els paràmetres de les màquines presents: en un nivell Noise no es puntuen waveform ni frequency.

Els pesos són 30 per waveform, 30 per frequency, 25 per cutoff, 15 per resonance i 15 per cada control addicional. Es normalitzen pel total de pesos actius. Waveform exigeix coincidència; frequency i cutoff utilitzen distàncies logarítmiques i la resta distàncies lineals dins el seu rang.

El 100% exigeix circuit complet i valors exactes. Qualsevol diferència queda com a màxim al 99%. Les pistes indiquen quin control convé pujar, baixar o canviar. LEDs, traça i barres són indicadors d'activitat, no analitzadors del senyal.

## Validació

- `npm test`: **30 proves** de connexions, controls, puntuació, aprenentatge, persistència i campanya. Inclou resoldre els 24 nivells seguint pistes, validar tots els targets, rebutjar cables incompatibles i recuperar cada partida independentment.
- Amb Vite actiu, `/tests/audio.html` → **Executa les proves**: **15 proves** amb Web Audio real. Renderitzen els 24 objectius, comproven senyals finits, absència de saturació als casos provats, silenci final, determinisme i efecte de cada control nou. També cobreixen canvis en viu, veus incompletes i finalització/aturada de fonts Noise, LFO i Sequencer. La prova del cicle de vida emet sons breus; la resta renderitza fora de línia.
- Proves manuals al navegador en un origen separat de la partida de l'usuari: selector, solució d'Envelope i Sequencer al 100%, cable PITCH obligatori, controls temporals, avanç i restauració del resultat després de recarregar.

- Distribució estreta revisada a 390 px amb les vuit màquines del nivell final: sense desbordament horitzontal de pàgina, panells ni controls.
