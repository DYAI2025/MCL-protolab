# Design: Prototype Runtime Foundation

- Datum: 2026-08-23
- Status: user-approved (Brainstorm-Session mit Ben, 2026-08-23)
- Ausführung: separater Lauf per `docs/plans/2026-08-23-runtime-foundation-mission.md`
- Governance: Prototype Runtime Exception erteilt (siehe Mission §1); MCL-1 bleibt offen und wird hierdurch NICHT entschieden.

## Kontext und Quellen

- Confluence MLOA 12 (`21594115`): Family-MVP läuft auf VPS/Coolify; Protolab bleibt vollständig davon isoliert (keine Runtime-Abhängigkeit zu `MC_legends`).
- Confluence `32604163` "MCL_protolab – Prototyping- und Architekturplattform": Stufenmodell 0–5, Experiment-first, Statusleiter `generated → structurally_valid → buildable → tested → runtime_verified`.
- Jira MCL-1: Produktformat offen. Die Exception erlaubt eine disposable Prototype-Runtime, keine Produktengine.
- Repo-Stand bei Design: `DYAI2025/MCL-protolab@e28904c` = Konzeptpaket (Schemas, Contracts, ADR-0002). Diese Design-Session strukturiert `package/` → Repo-Root um (Stufe 0 mit dem Commit dieser Dokumente abgeschlossen).

## Entscheidungen aus dem Brainstorm

| Frage | Entscheidung |
|---|---|
| Seeding | Konzeptpaket wird Repo-Root; Design + Mission werden auf `master` committed, damit eine frische Session nur `git clone` braucht |
| Engine-Auswahl-Tiefe | PlayCanvas-first verify: Hard Requirements gegen aktuelle offizielle Docs prüfen; Babylon.js nur bei Hard-Blocker; Godot/Unity kurz im ADR |
| Ausführung | Nicht in der Design-Session; späterer Lauf arbeitet die Mission ab |
| Plan-Form | Verfeinerter autonomer Mission-Prompt (kein Milestone-Plan) |

## S1 — Stack

| Ebene | Wahl | Grund |
|---|---|---|
| Engine | PlayCanvas Engine standalone (npm `playcanvas`, MIT) | Erfüllt Hard Requirements auf Papier; im Lauf gegen offizielle Docs zu verifizieren |
| Fallback | Babylon.js | Nur bei dokumentiertem Hard-Blocker |
| Build | Vite + TypeScript strict, vanilla DOM (kein React) | Kürzeste Iterationsschleife, minimale Boilerplate, agent-lesbar |
| Physics | Ammo.js über PlayCanvas Rigidbody/Collision-Komponenten; wasm lokal gebundelt, kein CDN | Zhalm-Chase braucht später echte Physics; Eigenbau-Kollision wäre Doppelarbeit |
| Player | Kinematische Capsule, WASD, Ground-Check, Gravity, Jump; Sprint optional | Foundation-Scope, kein finales Movement-System |
| Repro | Node LTS gepinnt (`.nvmrc` + `engines`), `package-lock.json` committed | Fresh-Clone-Gate |
| Statik | ESLint + `tsc --noEmit` | |
| Unit | Vitest für reine Logik (Registry, Tunables, Events, Reset-State) | |
| Smoke | Playwright: App startet, Canvas existiert, keine fatalen Console-Errors, synthetisches WASD erzeugt Positions-Delta, Screenshot als Evidence | |
| Assets | GLB als bevorzugtes 3D-Format (gegen Docs verifizieren); Foundation nutzt nur Engine-Primitives; Registry-Einträge Status `placeholder` (Schema-Enum) | Keine ungeklärten Downloads |

## S2 — Architektur

Semantische Grenzen (Zielstruktur):

```
src/shell/      bootstrap, experiment-router, reset
src/runtime/    player, camera, input, physics, rendering, audio, assets   (kennt PlayCanvas direkt)
src/core/       events, state, config/tunables, debug
src/mechanics/  nur README (Promotion erst nach >=2 Experimenten)
experiments/    _template/, playground/
assets/         registry/ + Asset-Ordner
schemas/        experiment + asset-registry (bestehend)
```

- Keine universelle Engine-Abstraktionsschicht. `runtime-adapters/` dokumentiert die getroffene Adapter-Entscheidung.
- Experiment-Interface: `{ id, init(ctx), reset(ctx), destroy(ctx), tunables }`.
- Events: typisierter Mini-Emitter; nur Events mit realem Consumer (initial `PLAYER_MOVED`, `EXPERIMENT_RESET`; Consumer = Debug-Inspector).
- Debug-Inspector: DOM-Overlay — Experiment-ID + Reset-Button, Player-Position/-State/-Speed, FPS. Tunables live änderbar, nirgends persistiert.
- Architekturregeln (testbar): experiments → runtime/core erlaubt; runtime enthält keine Experiment-Logik; core kennt keine konkreten Experimente; keine Abhängigkeit zu `MC_legends`.

## S3 — Seeding und Git

- Diese Session: Umstrukturierung `package/*` → Root, Planungsartefakte nach `docs/architecture/planning-run/`, Design + Mission + angepasstes `CLAUDE.md` → Commit auf `master`.
- Ausführungs-Lauf: Branch `feat/prototype-runtime-foundation`, Draft-PR gegen `master`, kein Self-Merge, keine Force-Pushes.
- Workspace: `~/Projects/MCL-protolab`.
- Vom Lauf zu erzeugende Doku: `docs/architecture/ADR-0003-runtime-foundation.md` (Exception + Engine-Entscheidung + Alternativen), `docs/runtime/SETUP.md`, `docs/runtime/VALIDATION.md` (nur real ausgeführte Gates), aktualisiertes `README.md`/`AGENTS.md` mit verifizierten Kommandos.

## S4 — Validierung und Evidence

Gates (alle real auszuführen): install → eslint → tsc → vitest → build → Playwright-Smoke → manueller Runtime-Test (9 Punkte, siehe Mission §8) → Fresh-Clone-Nachvollzug.

Evidence-Disziplin: Raw-Output verbatim in den Abschlussbericht; `not_run` ist niemals `passed`; Screenshot als Runtime-Evidence; Statusleiter endet erst bei `runtime_verified`, wenn manuell gespielt wurde.

## Risiken

- Ammo.js/wasm-Setup unter Vite kostet erfahrungsgemäß die meiste Integrationszeit (Asset-Pfade, Ladereihenfolge). Fallback wäre erst Babylon, nicht Eigenbau-Physik.
- PlayCanvas-Docs-Verify kann Abweichungen zur Annahme ergeben (z. B. empfohlener Scaffold-Weg); Mission erlaubt begründete ASSUMPTIONS bei kleinen reversiblen Lücken.
- Playwright-Movement-Test kann an Pointer-Lock/Fokus-Details scheitern; Smoke darf dafür einen Test-Hook (z. B. window-Flag) nutzen, solange der manuelle Gate zusätzlich real gespielt wird.

## Review-Trigger

Unverändert aus ADR-0002 / Confluence `32604163`; zusätzlich: Wird die Localhost-Iterationszeit mit PlayCanvas nachweislich zu langsam, ist das ein Review-Trigger für den Adapter.
