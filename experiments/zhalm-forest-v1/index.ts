import { Color, Entity, StandardMaterial, Vec3 } from 'playcanvas';
import type { AppBase } from 'playcanvas';
import type { CameraFrame } from 'playcanvas';
import type { Experiment, ExperimentContext } from '../../src/core/experiments/types.ts';
import { clearFog, setFog } from '../../src/runtime/fx/atmosphere.ts';
import { createPostChain } from '../../src/runtime/fx/post.ts';
import { emissiveMaterial, translucentMaterial } from '../../src/runtime/fx/emissive.ts';
import { addParticles } from '../../src/runtime/fx/particles.ts';
import type { SceneContext } from '../../src/runtime/scene-context.ts';
import type { WorldEvent } from '../../src/core/generative-world/contracts.ts';
import type { SelectionResult } from '../../src/core/generative-world/director-session.ts';
import { createSoundNetwork, type AlertLevel, type NodeSpec, type SoundNetwork } from '../../src/core/sound-network/network.ts';
import { mountDirectorPanel, type DirectorPanel } from './director/director-panel.ts';
import { createZhalmDirector, ZHALM_FLAGS } from './director/zhalm-director.ts';
import { createZhalmEventFactory, heardSensors } from './director/zhalm-events.ts';
import { CLUSTER_B_SPECS, NODE_SPECS } from './layout.ts';

const SPAWN = new Vec3(0, 1.2, 30);
const HEART_POSITION = new Vec3(0, 1.1, -32);
const DEN_POSITION = new Vec3(0, 0, -12);

// Director slice (MCL-85). A sensor "triggers" when its energy crosses this from below.
const SENSOR_TRIGGER_ENERGY = 0.5;
const REGROUP_POSITION = { x: 0, z: -29 }; // in front of the grove heart
const INVESTIGATE_COLOR = new Color(1.0, 0.6, 0.15);
const REGROUP_COLOR = new Color(0.3, 0.1, 0.9);
const LEVEL_RANK: Record<AlertLevel, number> = { calm: 0, suspicious: 1, alerted: 2 };
const higherLevel = (a: AlertLevel, b: AlertLevel): AlertLevel => (LEVEL_RANK[b] > LEVEL_RANK[a] ? b : a);

const NODE_BASE = 0.35;
const NODE_PEAK = 5;
const PULSE_COLOR = new Color(0.35, 0.05, 0.6);
const ALERT_COLORS: Record<string, Color> = {
  calm: new Color(0.35, 0.05, 0.6),
  suspicious: new Color(0.75, 0.2, 0.9),
  alerted: new Color(1.0, 0.1, 0.35),
};

const matte = (r: number, g: number, b: number) => {
  const m = new StandardMaterial();
  m.diffuse = new Color(r, g, b);
  m.update();
  return m;
};

export function createZhalmForestExperiment(): Experiment {
  let root: Entity | null = null;
  let appRef: AppBase | null = null;
  let onUpdate: ((dt: number) => void) | null = null;
  let chip: HTMLElement | null = null;
  let post: CameraFrame | null = null;
  let panel: DirectorPanel | null = null;
  let pendingRun: AbortController | null = null;

  return {
    id: 'zhalm-forest-v1',
    tunables: {
      'zhalm.walkNoise': 3, 'zhalm.sprintNoise': 9, 'zhalm.linkRange': 14, 'zhalm.pulseSpeed': 10,
      'zhalm.alertDecay': 0.12, 'zhalm.investigateSpeed': 3, 'zhalm.chaseSpeed': 6.5, 'zhalm.catchDistance': 1.4,
    },

    init(ctx: ExperimentContext) {
      const scene = ctx.scene as SceneContext;
      const app = scene.app;
      const tunables = ctx.tunables;
      appRef = app;

      root = new Entity('zhalm-forest');
      app.root.addChild(root);

      // --- terrain -------------------------------------------------------
      const ground = new Entity('ground');
      ground.setLocalScale(80, 0.4, 90);
      ground.setPosition(0, -0.2, 0);
      ground.addComponent('render', { type: 'box', material: matte(0.1, 0.16, 0.1) });
      ground.addComponent('collision', { type: 'box', halfExtents: new Vec3(40, 0.2, 45) });
      ground.addComponent('rigidbody', { type: 'static' });
      root.addChild(ground);

      // Deterministic tree ring-field (golden-angle spiral, no randomness).
      const trunkMaterial = matte(0.16, 0.12, 0.1);
      const canopyMaterial = matte(0.08, 0.2, 0.12);
      for (let i = 0; i < 34; i++) {
        const angle = i * 2.39996; // golden angle
        const radius = 8 + (i % 17) * 2.1;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius * 1.15 - 2;
        // Keep the spawn lane, heart plaza and den clear.
        if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 6) continue;
        if (Math.hypot(x - HEART_POSITION.x, z - HEART_POSITION.z) < 7) continue;
        if (Math.hypot(x - DEN_POSITION.x, z - DEN_POSITION.z) < 5) continue;
        const height = 5 + (i % 5);
        const trunk = new Entity(`tree-${i}`);
        trunk.setLocalScale(0.7, height, 0.7);
        trunk.setPosition(x, height / 2, z);
        trunk.addComponent('render', { type: 'cylinder', material: trunkMaterial });
        trunk.addComponent('collision', { type: 'cylinder', radius: 0.4, height });
        trunk.addComponent('rigidbody', { type: 'static' });
        root.addChild(trunk);
        const canopy = new Entity(`canopy-${i}`);
        canopy.setLocalScale(3.4, 2.6, 3.4);
        canopy.setPosition(x, height + 0.8, z);
        canopy.addComponent('render', { type: 'sphere', material: canopyMaterial });
        root.addChild(canopy);
      }

      const moon = new Entity('moon-light');
      moon.addComponent('light', { type: 'directional', color: new Color(0.55, 0.6, 0.85), intensity: 1.1, castShadows: true, shadowDistance: 70, shadowBias: 0.2, normalOffsetBias: 0.05 });
      moon.setEulerAngles(55, -30, 0);
      root.addChild(moon);

      // Darker than pre-ACES values: TONEMAP_ACES2 lifts the low end, so the
      // night reads grey unless fog/sky start deeper.
      setFog(app, new Color(0.018, 0.026, 0.038), 0.022);

      // Night sky: match the camera clear color to the fog so the horizon
      // dissolves instead of showing the daytime playground blue.
      const cameraEntity = app.root.findByName('camera') as Entity | null;
      if (cameraEntity?.camera) {
        cameraEntity.camera.clearColor = new Color(0.018, 0.026, 0.038);
        // V2 look pass (MLOA:22544386): cinematic tone mapping + restrained
        // bloom so node pulses and the grove heart bloom against the night.
        post = createPostChain(app, cameraEntity.camera, 0.025);
      }

      // --- sound network -------------------------------------------------
      const network: SoundNetwork = createSoundNetwork(NODE_SPECS, {
        linkRange: tunables.get('zhalm.linkRange'),
        pulseSpeed: tunables.get('zhalm.pulseSpeed'),
        suspicionThreshold: 0.5,
        alertThreshold: 1.6,
        decayPerSecond: tunables.get('zhalm.alertDecay'),
        energyDecayPerSecond: 0.8,
      });

      // Cluster b listens only after the director's "second sensor cluster" reaction.
      const networkB: SoundNetwork = createSoundNetwork(CLUSTER_B_SPECS, {
        linkRange: tunables.get('zhalm.linkRange'),
        pulseSpeed: tunables.get('zhalm.pulseSpeed'),
        suspicionThreshold: 0.5,
        alertThreshold: 1.6,
        decayPerSecond: tunables.get('zhalm.alertDecay'),
        energyDecayPerSecond: 0.8,
      });

      const nodeVisuals = new Map<string, { material: StandardMaterial; shown: number }>();
      const rootMaterial = matte(0.13, 0.1, 0.16);
      const clusterB = new Entity('zhalm-cluster-b');
      clusterB.enabled = false;
      root.addChild(clusterB);
      const addSensor = (spec: NodeSpec, parent: Entity): void => {
        const socket = new Entity(`socket-${spec.id}`);
        socket.setLocalScale(1.1, 0.5, 1.1);
        socket.setPosition(spec.x, 0.25, spec.z);
        socket.addComponent('render', { type: 'cone', material: rootMaterial });
        parent.addChild(socket);
        const material = emissiveMaterial(PULSE_COLOR, NODE_BASE);
        const orb = new Entity(`node-${spec.id}`);
        orb.setLocalScale(0.55, 0.55, 0.55);
        orb.setPosition(spec.x, 0.85, spec.z);
        orb.addComponent('render', { type: 'sphere', material });
        parent.addChild(orb);
        nodeVisuals.set(spec.id, { material, shown: NODE_BASE });
      };
      for (const spec of NODE_SPECS) addSensor(spec, root);
      for (const spec of CLUSTER_B_SPECS) addSensor(spec, clusterB);

      // --- guardian ------------------------------------------------------
      const guardian = new Entity('guardian');
      guardian.setPosition(DEN_POSITION.x, 0, DEN_POSITION.z);
      root.addChild(guardian);
      const gTrunk = new Entity('g-trunk');
      gTrunk.setLocalScale(1.0, 2.8, 1.0);
      gTrunk.setLocalPosition(0, 1.4, 0);
      gTrunk.addComponent('render', { type: 'cylinder', material: matte(0.14, 0.1, 0.16) });
      guardian.addChild(gTrunk);
      for (const a of [0, 72, 144, 216, 288]) {
        const limb = new Entity(`g-limb-${a}`);
        limb.setLocalScale(0.3, 1.9, 0.3);
        const rad = (a * Math.PI) / 180;
        limb.setLocalPosition(Math.cos(rad) * 0.7, 2.4, Math.sin(rad) * 0.7);
        limb.setLocalEulerAngles(32 * Math.cos(rad + Math.PI / 2), 0, 32 * Math.sin(rad + Math.PI / 2));
        limb.addComponent('render', { type: 'cylinder', material: matte(0.14, 0.1, 0.16) });
        guardian.addChild(limb);
      }
      const coreMaterial = emissiveMaterial(ALERT_COLORS['calm']!, 2.5);
      const core = new Entity('g-core');
      core.setLocalScale(0.6, 0.6, 0.6);
      core.setLocalPosition(0, 2.0, 0);
      core.addComponent('render', { type: 'sphere', material: coreMaterial });
      guardian.addChild(core);
      const coreLight = new Entity('g-light');
      coreLight.addComponent('light', { type: 'omni', color: ALERT_COLORS['calm'], intensity: 1.6, range: 9, castShadows: false });
      coreLight.setLocalPosition(0, 2.2, 0);
      guardian.addChild(coreLight);
      addParticles(guardian, 'g-motes', {
        numParticles: 24, lifetime: 2, rate: 0.09, emitterRadius: 1.4,
        colorCurve: [[0, 0.3, 1, 0.15], [0, 0.05, 1, 0.02], [0, 0.5, 1, 0.3]],
        alphaCurve: [0, 0, 0.4, 0.5, 1, 0],
        scaleCurve: [0, 0.05, 1, 0.09],
        velocity: new Vec3(0, 0.4, 0),
      });

      // --- grove heart (objective) --------------------------------------
      const heartMaterial = emissiveMaterial(new Color(1.0, 0.85, 0.3), 4);
      const heart = new Entity('grove-heart');
      heart.setLocalScale(0.9, 0.9, 0.9);
      heart.setPosition(HEART_POSITION);
      heart.addComponent('render', { type: 'sphere', material: heartMaterial });
      root.addChild(heart);
      const heartLight = new Entity('heart-light');
      heartLight.addComponent('light', { type: 'omni', color: new Color(1.0, 0.8, 0.3), intensity: 2.2, range: 12, castShadows: false });
      heartLight.setPosition(HEART_POSITION.x, HEART_POSITION.y + 1, HEART_POSITION.z);
      root.addChild(heartLight);

      // --- status chip (design instrument, not game UI) ------------------
      const host = document.getElementById('inspector');
      let levelValue: HTMLElement | null = null;
      let stimValue: HTMLElement | null = null;
      let scoreValue: HTMLElement | null = null;
      if (host) {
        chip = document.createElement('div');
        chip.style.cssText = 'background:rgba(13,17,23,0.82);padding:10px 14px;margin:0 10px 10px;border-radius:8px;font-size:12px;min-width:230px;max-width:280px;';
        const heading = document.createElement('h2');
        heading.textContent = 'ZHALM NETWORK';
        heading.style.cssText = 'margin:0 0 4px;font-size:11px;letter-spacing:0.08em;opacity:0.6;';
        const mkRow = (label: string) => {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;justify-content:space-between;gap:12px;';
          const name = document.createElement('span');
          name.textContent = label;
          name.style.opacity = '0.75';
          const value = document.createElement('span');
          value.style.cssText = 'font-variant-numeric:tabular-nums;';
          row.append(name, value);
          chip?.append(row);
          return value;
        };
        chip.append(heading);
        levelValue = mkRow('alert');
        stimValue = mkRow('stimulation');
        scoreValue = mkRow('heart / caught');
        const hint = document.createElement('div');
        hint.textContent = 'Reach the golden grove heart. Sprinting is loud.';
        hint.style.cssText = 'margin-top:4px;opacity:0.55;font-size:11px;';
        chip.append(hint);
        host.append(chip);
      }

      // --- generative world director (MCL-85) ----------------------------
      // Sound-network signals become observed WorldEvents; a NETWORK_ALERT
      // starts a FakeProvider run; the policy gate decides what is selectable;
      // a human choice changes world flags, and the forest reacts to the flags.
      const director = createZhalmDirector();
      const worldEvents = createZhalmEventFactory(() => new Date().toISOString());
      const flagIs = (flag: string): boolean => director.state().world_flags[flag] === true;
      let cycleEventIds: string[] = [];
      const cycleTriggered = new Set<string>();
      let lastLevel: AlertLevel = 'calm';
      let runOrigin: { x: number; z: number } | null = null;
      let investigateTarget: { x: number; z: number } | null = null;
      let searchPhase = 0;
      let regroupPhase = 0;
      let guardianMode = 'calm';

      const record = (event: WorldEvent): void => {
        const result = director.observe(event);
        if (!result.ok) {
          // A bridge bug must be loud: the e2e suite fails on console errors.
          console.error(`[zhalm director] event rejected: ${result.reason} — ${result.detail}`);
          return;
        }
        cycleEventIds = [...cycleEventIds, event.event_id].slice(-12);
      };

      const emitNoise = (x: number, z: number, radius: number): void => {
        const listening: Array<{ net: SoundNetwork; specs: readonly NodeSpec[] }> = [{ net: network, specs: NODE_SPECS }];
        if (flagIs(ZHALM_FLAGS.clusterB)) listening.push({ net: networkB, specs: CLUSTER_B_SPECS });
        const heard: string[] = [];
        const triggered: string[] = [];
        for (const { net, specs } of listening) {
          const ids = heardSensors(specs, x, z, radius);
          const before = new Map(ids.map((id) => [id, net.nodeEnergy(id)]));
          net.noiseAt(x, z, radius);
          heard.push(...ids);
          for (const id of ids) {
            if ((before.get(id) ?? 0) < SENSOR_TRIGGER_ENERGY && net.nodeEnergy(id) >= SENSOR_TRIGGER_ENERGY) triggered.push(id);
          }
        }
        if (heard.length === 0) return;
        const noise = worldEvents.noiseEmitted(x, z, radius, heard);
        record(noise);
        for (const id of triggered) {
          cycleTriggered.add(id);
          record(worldEvents.sensorTriggered(id, noise.event_id));
        }
      };

      const onNetworkAlert = (origin: { x: number; z: number }): void => {
        record(worldEvents.networkAlert('alerted', origin, [...cycleTriggered]));
        const eventIds = cycleEventIds;
        cycleEventIds = [];
        cycleTriggered.clear();
        const open = director.activeRun();
        if (pendingRun || (open && !open.resolved)) return; // proposals are already waiting for a human choice
        const controller = new AbortController();
        pendingRun = controller;
        panel?.showRunning();
        director.startRun(eventIds, controller.signal).then((run) => {
          if (pendingRun !== controller) return; // reset or destroyed meanwhile
          pendingRun = null;
          runOrigin = origin;
          panel?.showRun(run);
        }).catch((error: unknown) => {
          if (pendingRun === controller) pendingRun = null;
          console.error('[zhalm director] run failed', error);
        });
      };

      const selectProposal = (proposalId: string): SelectionResult => {
        const result = director.select(proposalId);
        if (result.ok && result.transition.operations.some((operation) => operation.flag_ref === ZHALM_FLAGS.investigating)) {
          investigateTarget = runOrigin;
        }
        panel?.showResult(result);
        const run = director.activeRun();
        if (run) panel?.showRun(run);
        return result;
      };

      if (host) {
        panel = mountDirectorPanel(host, (proposalId) => { selectProposal(proposalId); });
        panel.showIdle();
      }

      // --- simulation loop ----------------------------------------------
      const player = app.root.findByName('player') as Entity | null;
      let wins = 0;
      let catches = 0;
      let noiseTimer = 0;
      let wanderPhase = 0;
      const rings: Array<{ entity: Entity; age: number; radius: number }> = [];

      const spawnRing = (x: number, z: number, radius: number): void => {
        if (!root) return;
        const ring = new Entity('noise-ring');
        ring.setPosition(x, 0.06, z);
        ring.setLocalScale(0.5, 0.05, 0.5);
        ring.addComponent('render', { type: 'cylinder', material: translucentMaterial(new Color(0.7, 0.4, 1.0), 0.22) });
        root.addChild(ring);
        rings.push({ entity: ring, age: 0, radius });
      };

      const resetRun = (): void => {
        network.reset();
        networkB.reset();
        scene.movePlayerTo(SPAWN);
        guardian.setPosition(DEN_POSITION.x, 0, DEN_POSITION.z);
      };

      onUpdate = (dt: number) => {
        network.update(dt);
        networkB.update(dt);

        // player noise emission
        if (player?.rigidbody) {
          noiseTimer += dt;
          const v = player.rigidbody.linearVelocity;
          const speed = Math.hypot(v.x, v.z);
          if (noiseTimer >= 0.35 && speed > 0.6) {
            noiseTimer = 0;
            const walkSpeed = tunables.get('player.walkSpeed');
            const loud = speed > walkSpeed + 0.6 ? tunables.get('zhalm.sprintNoise') : tunables.get('zhalm.walkNoise');
            const p = player.getPosition();
            emitNoise(p.x, p.z, loud);
            spawnRing(p.x, p.z, loud);
          }
        }

        // expanding noise rings
        for (let i = rings.length - 1; i >= 0; i--) {
          const ring = rings[i]!;
          ring.age += dt;
          const t = ring.age / 0.6;
          if (t >= 1) { ring.entity.destroy(); rings.splice(i, 1); continue; }
          const s = 0.5 + (ring.radius * 2 - 0.5) * t;
          ring.entity.setLocalScale(s, 0.05, s);
        }

        // director reactions: the forest reads the world flags (MCL-85)
        const clusterBActive = flagIs(ZHALM_FLAGS.clusterB);
        const regrouping = flagIs(ZHALM_FLAGS.regrouping);
        if (clusterB.enabled !== clusterBActive) clusterB.enabled = clusterBActive;
        regroupPhase += dt;

        // node glow follows network energy (write materials only on change);
        // a regrouping network pulses dimmed and in sync instead
        const regroupGlow = NODE_BASE * (0.6 + 0.9 * (0.5 + 0.5 * Math.sin(regroupPhase * 1.8)));
        const glowTargets: Array<[string, number]> = [
          ...NODE_SPECS.map((spec): [string, number] => [
            spec.id,
            regrouping ? regroupGlow : NODE_BASE + network.nodeEnergy(spec.id) * (NODE_PEAK - NODE_BASE),
          ]),
          ...CLUSTER_B_SPECS.map((spec): [string, number] => [spec.id, NODE_BASE + networkB.nodeEnergy(spec.id) * (NODE_PEAK - NODE_BASE)]),
        ];
        for (const [id, target] of glowTargets) {
          const visual = nodeVisuals.get(id)!;
          if (Math.abs(target - visual.shown) > 0.05) {
            visual.shown = target;
            visual.material.emissiveIntensity = target;
            visual.material.update();
          }
        }

        // alert level across the listening clusters; entering 'alerted' is a NETWORK_ALERT
        const loudest = clusterBActive && LEVEL_RANK[networkB.level()] > LEVEL_RANK[network.level()] ? networkB : network;
        const level = clusterBActive ? higherLevel(network.level(), networkB.level()) : network.level();
        if (level === 'alerted' && lastLevel !== 'alerted') onNetworkAlert(loudest.lastNoise() ?? { x: 0, z: 0 });
        lastLevel = level;

        // guardian: a selected director reaction overrides the alert-level state machine
        const gp = guardian.getPosition();
        let target: { x: number; z: number } | null = null;
        let speed = 0;
        if (regrouping) {
          guardianMode = 'regrouping';
          target = REGROUP_POSITION;
          speed = tunables.get('zhalm.investigateSpeed') + 1.5;
        } else if (investigateTarget && flagIs(ZHALM_FLAGS.investigating)) {
          guardianMode = 'investigating';
          const toSource = Math.hypot(investigateTarget.x - gp.x, investigateTarget.z - gp.z);
          if (toSource > 2.6) {
            target = investigateTarget;
            speed = tunables.get('zhalm.investigateSpeed');
          } else {
            searchPhase += dt * 0.9;
            target = { x: investigateTarget.x + Math.cos(searchPhase) * 2.5, z: investigateTarget.z + Math.sin(searchPhase) * 2.5 };
            speed = 1.6;
          }
        } else {
          guardianMode = level;
          if (level === 'calm') {
            wanderPhase += dt * 0.25;
            target = { x: DEN_POSITION.x + Math.cos(wanderPhase) * 4, z: DEN_POSITION.z + Math.sin(wanderPhase) * 4 };
            speed = 1.2;
          } else if (level === 'suspicious') {
            target = loudest.lastNoise();
            speed = tunables.get('zhalm.investigateSpeed');
          } else if (player) {
            const pp = player.getPosition();
            const toPlayer = Math.hypot(pp.x - gp.x, pp.z - gp.z);
            target = toPlayer < 22 ? { x: pp.x, z: pp.z } : loudest.lastNoise();
            speed = tunables.get('zhalm.chaseSpeed');
          }
        }
        if (target) {
          const dx = target.x - gp.x;
          const dz = target.z - gp.z;
          const distance = Math.hypot(dx, dz);
          if (distance > 0.4) {
            const step = Math.min(speed * dt, distance);
            guardian.setPosition(gp.x + (dx / distance) * step, 0, gp.z + (dz / distance) * step);
            guardian.setEulerAngles(0, (-Math.atan2(dz, dx) * 180) / Math.PI + 90, 0);
          }
        }

        // guardian visual state: amber while investigating, deep violet while regrouping
        const guardianColor = guardianMode === 'regrouping'
          ? REGROUP_COLOR
          : guardianMode === 'investigating' ? INVESTIGATE_COLOR : ALERT_COLORS[level]!;
        if (!coreMaterial.emissive.equals(guardianColor)) {
          coreMaterial.emissive = guardianColor;
          coreMaterial.emissiveIntensity = guardianMode === 'calm' ? 2.5 : 4;
          coreMaterial.update();
          if (coreLight.light) coreLight.light.color = guardianColor;
        }

        // catch / win
        if (player) {
          const pp = player.getPosition();
          if (Math.hypot(pp.x - gp.x, pp.z - gp.z) < tunables.get('zhalm.catchDistance')) {
            catches += 1;
            resetRun();
          } else if (Math.hypot(pp.x - HEART_POSITION.x, pp.z - HEART_POSITION.z) < 1.8) {
            wins += 1;
            resetRun();
          }
        }

        // status chip
        if (levelValue) levelValue.textContent = level;
        if (stimValue) stimValue.textContent = network.stimulation().toFixed(2);
        if (scoreValue) scoreValue.textContent = `${wins} / ${catches}`;
      };
      app.on('update', onUpdate);

      // Test hook — deterministic access for the smoke suite (mission §7).
      (window as unknown as Record<string, unknown>).__zhalm = {
        level: () => network.level(),
        stimulation: () => network.stimulation(),
        // Same path as player movement: sound network + observed WorldEvents.
        noiseAt: (x: number, z: number, radius: number) => emitNoise(x, z, radius),
        nodeEnergy: (id: string) => (NODE_SPECS.some((spec) => spec.id === id) ? network.nodeEnergy(id) : networkB.nodeEnergy(id)),
        guardianPosition: () => {
          const p = guardian.getPosition();
          return { x: p.x, y: p.y, z: p.z };
        },
        lastNoise: () => network.lastNoise(),
        score: () => ({ wins, catches }),
        director: {
          flags: () => ({ ...director.state().world_flags }),
          revision: () => director.state().revision,
          observedTypes: () => director.ledger.observed().map((event) => event.event_type),
          ledgerKinds: () => director.ledger.entries().map((entry) => entry.kind),
          runStatus: () => director.activeRun()?.status ?? null,
          proposals: () => (director.activeRun()?.proposals ?? []).map((view) => ({
            id: view.proposal.proposal_id,
            intent: view.proposal.transition_intent.join(' '),
            summary: view.proposal.summary,
            status: view.gate.status,
            reasons: [...view.gate.reasons],
          })),
          select: (proposalId: string) => {
            const result = selectProposal(proposalId);
            return result.ok ? { ok: true } : { ok: false, reason: result.reason };
          },
          guardianMode: () => guardianMode,
          clusterBActive: () => clusterB.enabled,
        },
      };

      scene.movePlayerTo(SPAWN);
    },

    reset(ctx: ExperimentContext) {
      // Full rebuild keeps reset deterministic AND lets retuned network
      // tunables (linkRange, pulseSpeed, decay) take effect.
      this.destroy(ctx);
      this.init(ctx);
    },

    destroy() {
      if (appRef && onUpdate) appRef.off('update', onUpdate);
      onUpdate = null;
      if (pendingRun) { pendingRun.abort(); pendingRun = null; }
      panel?.destroy();
      panel = null;
      if (post) { post.destroy(); post = null; }
      if (appRef) {
        clearFog(appRef);
        const cameraEntity = appRef.root.findByName('camera') as Entity | null;
        if (cameraEntity?.camera) cameraEntity.camera.clearColor = new Color(0.48, 0.72, 0.9);
      }
      chip?.remove();
      chip = null;
      delete (window as unknown as Record<string, unknown>).__zhalm;
      root?.destroy();
      root = null;
      appRef = null;
    },
  };
}
