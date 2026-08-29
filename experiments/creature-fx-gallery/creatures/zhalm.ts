import { Color, Entity, StandardMaterial, Vec3 } from 'playcanvas';
import { emissiveMaterial, translucentMaterial } from '../../../src/runtime/fx/emissive.ts';
import { addParticles } from '../../../src/runtime/fx/particles.ts';
import type { CreatureHandle } from '../creature-handle.ts';

// The Druhen/Zhalm naming conflict is design_status CONFLICT in the profile and
// is deliberately NOT resolved here — this file only renders the concept.

const bark = (r: number, g: number, b: number) => {
  const m = new StandardMaterial();
  m.diffuse = new Color(r, g, b);
  m.update();
  return m;
};

const PULSE_COLOR = new Color(0.35, 0.05, 0.6); // black-violet
const NODE_BASE_INTENSITY = 0.4;
const NODE_PEAK_INTENSITY = 5;

/**
 * Large plant/root placeholder plus smaller sensor/root nodes. The readability
 * carrier is a black-violet pulse travelling node -> node across the network.
 * States: 'idle' (dim nodes), 'pulse' (deterministic travelling wave restarting
 * at node 0 on activation) and 'crystallized' (material swap preview).
 */
export function buildZhalm(parent: Entity, position: { x: number; y: number; z: number }): CreatureHandle {
  const root = new Entity('zhalm');
  root.setPosition(position.x, position.y, position.z);
  parent.addChild(root);

  const trunkMaterial = bark(0.2, 0.16, 0.22);
  const trunk = new Entity('trunk');
  trunk.setLocalScale(1.1, 3.4, 1.1);
  trunk.setLocalPosition(0, 1.7, 0);
  trunk.addComponent('render', { type: 'cylinder', material: trunkMaterial });
  root.addChild(trunk);

  const limbs: Entity[] = [];
  for (const [angle, tilt] of [[0, 38], [80, 30], [150, 42], [225, 34], [300, 40]] as const) {
    const limb = new Entity(`limb-${angle}`);
    limb.setLocalScale(0.35, 2.4, 0.35);
    const rad = (angle * Math.PI) / 180;
    limb.setLocalPosition(Math.cos(rad) * 0.9, 2.6, Math.sin(rad) * 0.9);
    limb.setLocalEulerAngles(tilt * Math.cos(rad + Math.PI / 2), 0, tilt * Math.sin(rad + Math.PI / 2));
    limb.addComponent('render', { type: 'cylinder', material: trunkMaterial });
    root.addChild(limb);
    limbs.push(limb);
  }

  // Sensor/root nodes in a ring — the pulse travels across these in order.
  const nodes: Array<{ entity: Entity; material: StandardMaterial }> = [];
  const NODE_RING: Array<[number, number, number]> = [
    [2.2, 0.35, 0], [1.3, 0.3, 2.0], [-1.1, 0.35, 2.2], [-2.3, 0.3, -0.4], [0.4, 0.35, -2.3],
  ];
  for (let i = 0; i < NODE_RING.length; i++) {
    const [x, y, z] = NODE_RING[i]!;
    const material = emissiveMaterial(PULSE_COLOR, NODE_BASE_INTENSITY);
    const node = new Entity(`node-${i}`);
    node.setLocalScale(0.5, 0.5, 0.5);
    node.setLocalPosition(x, y, z);
    node.addComponent('render', { type: 'sphere', material });
    root.addChild(node);
    nodes.push({ entity: node, material });
  }

  const motes = addParticles(root, 'spore-motes', {
    numParticles: 30,
    lifetime: 2.5,
    rate: 0.08,
    emitterRadius: 2.2,
    colorCurve: [[0, 0.3, 1, 0.15], [0, 0.05, 1, 0.02], [0, 0.5, 1, 0.3]],
    alphaCurve: [0, 0, 0.4, 0.6, 1, 0],
    scaleCurve: [0, 0.04, 1, 0.08],
    velocity: new Vec3(0, 0.5, 0),
  });
  motes.setLocalPosition(0, 1.2, 0);

  const netLight = new Entity('net-light');
  netLight.addComponent('light', {
    type: 'omni', color: PULSE_COLOR, intensity: 1.0, range: 8, castShadows: false,
  });
  netLight.setLocalPosition(0, 2.2, 0);
  root.addChild(netLight);

  // Crystallization preview materials (swap, not new geometry).
  const crystalTrunk = translucentMaterial(new Color(0.75, 0.85, 1.0), 0.55);
  const crystalNode = emissiveMaterial(new Color(0.7, 0.85, 1.0), 2);

  const STATES = ['idle', 'pulse', 'crystallized'];
  let current = 'idle';
  let pulseTime = 0;
  const PULSE_STEP_S = 0.35; // deterministic: node i peaks at i * PULSE_STEP_S after activation

  const applyBaseMaterials = (): void => {
    const renderTrunk = trunk.render;
    if (renderTrunk) renderTrunk.material = trunkMaterial;
    for (const limb of limbs) {
      if (limb.render) limb.render.material = trunkMaterial;
    }
    for (const { entity, material } of nodes) {
      material.emissive = PULSE_COLOR;
      material.emissiveIntensity = NODE_BASE_INTENSITY;
      material.update();
      if (entity.render) entity.render.material = material;
    }
  };

  return {
    id: 'zhalm',
    root,
    states: () => [...STATES],
    state: () => current,
    setState(state) {
      if (!STATES.includes(state)) throw new Error(`zhalm: unknown state "${state}". Known: ${STATES.join(', ')}`);
      current = state;
      if (state === 'crystallized') {
        if (trunk.render) trunk.render.material = crystalTrunk;
        for (const limb of limbs) {
          if (limb.render) limb.render.material = crystalTrunk;
        }
        for (const { entity } of nodes) {
          if (entity.render) entity.render.material = crystalNode;
        }
        return;
      }
      applyBaseMaterials();
      pulseTime = 0;
    },
    setLayer(layer, enabled) {
      if (layer === 'emissive') { for (const { entity } of nodes) entity.enabled = enabled; }
      if (layer === 'particles') motes.enabled = enabled;
      if (layer === 'light') netLight.enabled = enabled;
      // no trail layer on this profile
    },
    update(dt) {
      if (current !== 'pulse') return;
      pulseTime += dt;
      const cycle = nodes.length * PULSE_STEP_S;
      const phase = pulseTime % cycle;
      for (let i = 0; i < nodes.length; i++) {
        // Distance of this node from the travelling pulse head, wrapped around the ring.
        const head = phase / PULSE_STEP_S;
        const distance = Math.min(Math.abs(head - i), nodes.length - Math.abs(head - i));
        const energy = Math.max(0, 1 - distance);
        const node = nodes[i]!;
        node.material.emissiveIntensity = NODE_BASE_INTENSITY + energy * (NODE_PEAK_INTENSITY - NODE_BASE_INTENSITY);
        node.material.update();
      }
    },
    destroy() { root.destroy(); },
  };
}
