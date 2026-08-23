# MISSION: MCL-protolab — Prototype Runtime Foundation bauen

- Version: 1.0 (2026-08-23, aus Brainstorm-Session mit Ben verdichtet; Design: `docs/plans/2026-08-23-runtime-foundation-design.md`)
- Zielstatus: `runtime_verified`
- Ziel-Repo: `DYAI2025/MCL-protolab` (NUR dieses; Stop, falls anders)
- Workspace: `~/Projects/MCL-protolab`

## ROLE

Du bist verantwortlicher Senior Game/Runtime Architect UND Implementierungsagent. Du analysierst nicht nur — du implementierst, führst aus, testest und bringst die Foundation real bis `runtime_verified`. Am Ende kann ein Entwickler oder Coding-Agent frisch klonen und mit wenigen dokumentierten Befehlen eine lokal spielbare Third-Person-Testumgebung starten.

## §0 INTAKE

1. `git clone https://github.com/DYAI2025/MCL-protolab.git ~/Projects/MCL-protolab` (bzw. vorhandenen Clone auf `origin/master` aktualisieren; fremde lokale Änderungen niemals überschreiben).
2. Lies vollständig: `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/architecture/**` (bes. ADR-0002), `docs/experiments/EXPERIMENT_CONTRACT.md`, `docs/assets/ASSET_REGISTRY_CONTRACT.md`, `schemas/**`, `runtime-adapters/README.md`, sowie Design + diese Mission unter `docs/plans/`.
3. Falls Atlassian verfügbar: Confluence `32604163` (MCL_protolab), `21594115` (Seite 12, Parent), MLOA 02; Jira MCL-1. Truth-Hierarchie: GitHub = Implementierungswahrheit, Jira = Scope-/Statuswahrheit, Confluence MLOA = Design-SSoT.
4. Erfinde keine Fakten. Kennzeichne durchgehend: OBSERVED / ASSUMPTION / MISSING / BLOCKER.
5. Hinweis: Ältere Konzeptdokumente (ADR-0002, DECISION_SUMMARY, README_CONCEPT) verwenden den historischen Konzeptnamen `DYAI2025/mcl-prototype-lab` — gemeint ist DIESES Repo (`DYAI2025/MCL-protolab`). Kein Stop-Condition-Fall.

## §1 PROTOTYPE RUNTIME EXCEPTION (erteilt)

Für diesen Auftrag gilt ausdrücklich (erteilt von Ben, 2026-08-23): `MCL-protolab` darf eine konkrete Game-/3D-Runtime für disposable Gameplay-Prototypen verwenden. Diese Entscheidung entscheidet NICHT die spätere Produktengine, NICHT MCL-1, NICHT Minecraft vs. Standalone; sie darf später vollständig verworfen werden und gilt ausschließlich für das Prototype Lab. Dokumentiere diese Grenze in `docs/architecture/ADR-0003-runtime-foundation.md`. Die Runtime-Auswahl darf niemals still zur Produktarchitektur erklärt werden.

## §2 HAUPTZIEL

Kleinstmögliche vollständige Prototype-Runtime für die Schleife:

```
Idee -> Experiment anlegen -> lokal starten -> Third-Person spielen -> Assets laden
-> Mechanik beobachten -> Parameter ändern -> Reset -> erneut spielen
```

Optimierungsziel: **Learning speed > production architecture.** Spätere Experimente (zhalm-forest-v1, bandit-camp-v1, dragon-flight-v1, smith-crafting-v1) setzen hierauf auf, sind aber NICHT Teil dieses Auftrags.

## §3 RUNTIME-ENTSCHEIDUNG: PlayCanvas-first verify

Entschieden im Brainstorm: kein 4-Kandidaten-Deep-Research. Stattdessen:

1. Verifiziere **PlayCanvas Engine standalone** (npm `playcanvas`) gegen AKTUELLE offizielle Docs: Engine-Version, Node-Anforderung, TypeScript-Support, Vite-Weg, Lizenz (MIT erwartet), Third-Person-Machbarkeit, GLB/glTF-Pipeline, Ammo.js-Physics-Integration, WebGL/WebGPU-Status, lokale Build-/Dev-Kommandos.
2. Erfüllt PlayCanvas alle Hard Requirements → verwende es.
3. Nur bei dokumentiertem HARD BLOCKER → Fallback **Babylon.js** (gleiches Verify-Verfahren).
4. Godot/Unity werden im ADR kurz abgehandelt (Editor-zentriert, kein npm/Vite-Loop, schwache Agent-Iteration/Browser-Smoke-Automation) — keine eigene Recherche-Runde.

Hard Requirements: lokal ausführbar; kein Cloud-Zwang (Cloud-Editor darf weder Start- noch Build- noch Test-Voraussetzung sein; ein optionaler MCP-/Editor-Workflow darf später ergänzt werden); Agent kann Projektdateien direkt ändern; Third-Person; 3D-Asset-Import; Collision/Physics; Animation möglich; Audio; schnelle Reload-Schleife; Git-tauglich; automatisierbare Gates; kostenfrei; keine Abhängigkeit zu `MC_legends`.

Baseline: `git clone -> install -> dev -> localhost -> spielen`.

## §4 STACK (fixiert im Design)

- Vite + TypeScript strict, vanilla DOM (kein React, kein UI-Framework).
- Physics: Ammo.js über die PlayCanvas-Rigidbody-/Collision-Komponenten; wasm lokal gebundelt, kein CDN.
- Node LTS gepinnt: `.nvmrc` + `engines`-Feld; `package-lock.json` committed; keine global installierten geheimen Voraussetzungen.
- ESLint + `tsc --noEmit` + Vitest + Playwright.
- GLB als bevorzugtes 3D-Format (nach Docs-Verify). Foundation nutzt ausschließlich Engine-Primitives; falls doch ein Test-GLB nötig wird: nur eindeutig lizenzierbar, Herkunft in der Registry dokumentiert. Keine ungeklärten Downloads. Keine Franchise-Ikonografie.
- Authoring-Tools (Blockbench, Blender, …) sind KEINE Runtime-Abhängigkeit. Der Asset-Pfad muss den Tausch ermöglichen: Placeholder → Registry-ID → Experiment; später eigenes Asset → gleiche Registry-ID/neue Version → Experiment ohne Gameplay-Rewrite.

## §5 ARCHITEKTUR

```
src/shell/      bootstrap, experiment-router, reset
src/runtime/    player/, camera/, input/, physics/, rendering/, audio/, assets/
src/core/       events/, state/, config/ (tunables), debug/
src/mechanics/  nur README.md (Promotion-Regel)
experiments/    _template/, playground/
assets/         registry/ (+ Ordner je kind)
runtime-adapters/  dokumentierte Adapter-Entscheidung
schemas/        bestehende Schemas weiterverwenden
tests/          unit/, architecture/, smoke/
docs/           architecture/, experiments/, assets/, runtime/, plans/
```

Regeln:

- Experiment first, abstraction second. Keine vorsorglichen Frameworks (ECS, Quest, Inventory, Multiplayer, Universal-AI, Universal-Engine-Adapter). Mechanik-Promotion erst nach ≥2 unabhängigen Experimenten.
- `src/runtime/` darf PlayCanvas direkt kennen — keine Engine-Abstraktionsschicht.
- Experiment-Interface: `{ id, init(ctx), reset(ctx), destroy(ctx), tunables }`.
- Events: typisierter Mini-Emitter; nur Events mit real existierendem Consumer (initial: `PLAYER_MOVED`, `EXPERIMENT_RESET`; Consumer = Debug-Inspector). Keine Event-Taxonomie auf Vorrat.
- Architekturgrenzen (per Test/Lint prüfbar, wenn wirtschaftlich): experiments → runtime/core ok; runtime enthält keine Experiment-/Zhalm-Logik; core kennt keine konkreten Experimente; Registry unabhängig von Experimenten; `MC_legends` ist keine Abhängigkeit.
- Agent-Friendliness: klare Ordner, kurze Dateien, kleine Module, keine Magic Factories/Reflection/tiefen Hierarchien.

## §6 ZU IMPLEMENTIEREN

A. **Bootstrap** — ein dokumentierter Startbefehl (z. B. `npm install && npm run dev`); nur Kommandos dokumentieren, die du real eingerichtet und ausgeführt hast.

B. **Third-Person-Player** — sichtbare Placeholder-Capsule; WASD; Ground-Check; Collision; Gravity; Jump; Sprint optional. Kein finales Movement-System, keine Animation.

C. **Third-Person-Kamera** — folgt dem Spieler; horizontale Rotation; vertikal mit sinnvoller Begrenzung; sinnvolle Distanz; leicht erhöhte Action-Adventure-Kamera, keine Shooter-Over-the-Shoulder.

D. **Playground-Experiment** — Boden, mehrere Hindernisse, Rampe/Höhenunterschied, mindestens ein physisch simuliertes Objekt (dynamischer Rigidbody), Licht, Orientierungspunkte. Primitive Geometrie genügt; keine Avaloria-Welt.

E. **Experiment-Registry/-Loader** — `playground` registriert; neue Experimente ohne Umbau registrierbar: erstellen → registrieren → laden → resetten. Kein Plugin-System. Jedes Experiment validiert gegen `schemas/experiment.schema.json` und deklariert `design_status` + `source_refs`.

F. **Debug-Inspector (First-Class)** — DOM-Overlay: EXPERIMENT (id, Reset-Button), PLAYER (Position, Movement-State, Speed), RUNTIME (FPS/Frame-Time). Kein finales Game-UI.

G. **Reset/Replay** — Button und/oder Taste; Spielerposition, Experiment-State und temporäre Entities zuverlässig auf Ausgangszustand.

H. **Tunables** — einfacher Config-Mechanismus, live über den Inspector änderbar, nicht persistiert. Initial: `player.walkSpeed`, `player.sprintSpeed`, `player.jumpForce`, `camera.distance`, `camera.sensitivity`. Keine Zhalm-/Combat-Werte auf Vorrat.

I. **Asset-Registry verdrahtet** — Gameplay-Code referenziert stabile IDs (z. B. `character.hero.placeholder`, `environment.test.crate`), niemals Dateipfade. Metadaten je Asset: `asset_id, kind, path, format, status, version, source, license, provenance, fallback_asset_id` (Schema: `schemas/asset-registry.schema.json`). Primitives werden als Registry-Einträge mit Status `placeholder` geführt.

## §7 AUTOMATED GATES

Alle real ausführen; Reihenfolge: install → lint → typecheck → unit → build → smoke.

- ESLint; `tsc --noEmit`; Vitest für reine Logik (Registry, Tunables, Events, Reset-State); Production-Build.
- **Playwright-Smoke** beweist mindestens: App startet; Runtime initialisiert; Canvas/Scene existiert; Playground lädt; keine fatalen Startup-Errors; synthetischer Movement-Input erzeugt nachweisbares Positions-Delta; Screenshot wird als Artefakt gespeichert. Ein Test-Hook (z. B. window-Flag für Position) ist erlaubt — er ersetzt nicht den manuellen Gate.
- Keine grünen Fake-Tests. `not_run` ist nicht `passed`.

## §8 MANUELLER RUNTIME-GATE

Führe die Runtime real aus und beweise: (1) startet, (2) Playground sichtbar, (3) Spieler sichtbar, (4) Movement, (5) Kamera, (6) Collision/Gravity (inkl. dynamisches Objekt anstoßen), (7) Reset, (8) Inspector zeigt Live-Daten, (9) Production-Build läuft. Screenshot als Runtime-Evidence speichern.

## §9 FRESH-CLONE-GATE

Dokumentiere in `docs/runtime/SETUP.md`: Tool-/Runtime-Versionen, Install-, Start-, Build-, Test-, Smoke-Kommandos. Verifiziere den kompletten Weg aus einem frischen Clone (separates Verzeichnis) bevor du `runtime_verified` meldest.

## §10 DOKUMENTATION

- `docs/architecture/ADR-0003-runtime-foundation.md`: gewählte Runtime + Version, geprüfte Alternativen, Gründe, Prototype-only-Grenze, Konsequenzen, Risiken, Review-Trigger.
- `docs/runtime/SETUP.md`, `docs/runtime/VALIDATION.md` (nur real ausgeführte Gates mit Ergebnis).
- `README.md` + `AGENTS.md` aktualisieren: exakte verifizierte Kommandos; AGENTS.md kurz halten (automatisch durchsetzbare Regeln gehören in Tests/Lint, nicht in Prosa).
- `CLAUDE.md` aktualisieren (Kommandos, Struktur), Grenz-Regeln beibehalten.

## §11 NICHT BAUEN

Kein Backend, DB, Auth, Cloud-Deployment, Multiplayer, persistente Welt, Analytics, Feature-Flags, Microservices (Ausnahme nur als begründeter BLOCKER). Kein Zhalm-Gameplay, Combat, Inventory, Crafting, Quests, Dragon-System, Economy, NPC-Dialog, Savegame-Framework, finale Avaloria-Welt. Einziger Gameplay-Inhalt: **Third-Person-Playground zur Runtime-Validierung.**

## §12 GIT/DELIVERY

- Branch: `feat/prototype-runtime-foundation` (nie direkt auf `master` arbeiten).
- Keine Force-Pushes, keine History-Rewrites, keine fremden Änderungen löschen, keine Secrets.
- Atomare Commits; Push; **Draft-PR** gegen `master`; danach Remote-State erneut lesen. Kein Self-Merge ohne ausdrückliche Autorisierung.

## §13 EVIDENCE-DISZIPLIN

- Für jedes Gate: exaktes Kommando + Raw-Output verbatim in den Abschlussbericht (nicht paraphrasieren, nicht durch Urteile ersetzen). Weicht ein Output von der Erwartung ab: tatsächlichen Wert berichten und stoppen, nicht den Check anpassen.
- Ein Subagent-Report ist ein Claim, keine Evidence — Akzeptanzkriterien selbst nachmessen.
- Keine private Chain-of-Thought; stattdessen kurze Decision Notes: Evidence / Decision / Reason / Validation.

## §14 STOP CONDITIONS

Stoppe mit BLOCKER, falls: Ziel-Repo ≠ `DYAI2025/MCL-protolab`; fremde nicht isolierbare Änderungen überschrieben würden; ein Secret gefunden wird; keine geprüfte Runtime die Hard Requirements erfüllt; Runtime nur mit Cloud-Zwang funktioniert; ein Asset ohne geklärte Lizenz nötig wäre; Build/Runtime nach begrenzter Ursachenanalyse weiter fehlschlägt. Keine Probleme verstecken, keine Gates abschwächen.

## §15 ARBEITSWEISE

Selbständig. Keine Rückfragen, wenn Repository, ADR, Confluence, Jira oder offizielle Runtime-Doku den Punkt eindeutig auflösen. Kleine reversible Lücken: begründete ASSUMPTION dokumentieren. Scope-verändernde Entscheidungen: BLOCKER melden.

## §16 DEFINITION OF DONE

NICHT fertig, wenn: nur Engine gewählt / nur Generator gelaufen / nur Architekturdateien / Build grün ohne spielbares Gameplay / Player nicht steuerbar / nur Cloud-Editor / Tests nicht real ausgeführt.

Fertig, wenn alle Checkboxen real erfüllt:

**Foundation:** Runtime gewählt + ADR-0003 ▢ · Exception dokumentiert ▢ · reproduzierbare Installation ▢ · Pins/Lockfile ▢ · README aktuell ▢
**Runtime:** startet lokal ▢ · Playground lädt ▢ · Player sichtbar ▢ · Movement ▢ · Kamera ▢ · Collision/Gravity ▢ · Reset ▢ · Inspector ▢ · Tunables ▢
**Architecture:** Experiment-Registry ▢ · Template ▢ · Asset-Registry verdrahtet ▢ · Playground isoliert ▢ · keine Backend-Abhängigkeit ▢ · keine Universal-Abstraktion ▢
**Quality:** lint ▢ · typecheck ▢ · unit ▢ · build ▢ · smoke ▢ · manueller Runtime-Test ▢ · Fresh-Clone-Gate ▢

## §17 ABSCHLUSSBERICHT

Exakt diese Abschnitte: Runtime Decision (Engine, Version, Gründe, Verworfene) · Architecture (Struktur, Module, Grenzen) · Implementation (Dateien) · Commands Executed (je: command, result, PASS/FAIL/NOT_RUN) · Runtime Evidence (real gestartet? Player bewegt? Kamera/Collision/Reset geprüft? Screenshot?) · Validation (lint/typecheck/tests/build/smoke/manual) · Git (Branch, Commits, Push, PR) · Remaining Risks · **Final Status**: genau einer aus BLOCKED / GENERATED / STRUCTURALLY_VALID / BUILDABLE / TESTED / RUNTIME_VERIFIED + Ein-Satz-Begründung.

## PRIMARY SUCCESS CONDITION

Ein neuer Coding-Agent öffnet das Repo und kann ohne Runtime-Neuerfindung direkt beauftragt werden: „Erstelle Experiment `zhalm-forest-v1`." Third-Person, Kamera, Input, Physics, Asset-Loading, Experiment-Loading, Debugging, Tunables und Reset funktionieren dann bereits.
