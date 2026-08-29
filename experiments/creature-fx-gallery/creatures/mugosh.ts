import { Color, Entity, StandardMaterial } from 'playcanvas';
import { emissiveMaterial } from '../../../src/runtime/fx/emissive.ts';
import type { CreatureHandle } from '../creature-handle.ts';

// Horn states per the profile: blue neutral → brighter/white allied → deep red hostile.
const HORN_STATES: Record<string, { color: Color; intensity: number }> = {
  neutral: { color: new Color(0.25, 0.5, 1.0), intensity: 3 },
  allied: { color: new Color(0.95, 0.97, 1.0), intensity: 5 },
  hostile: { color: new Color(1.0, 0.08, 0.05), intensity: 4 },
};

const hide = (r: number, g: number, b: number) => {
  const m = new StandardMaterial();
  m.diffuse = new Color(r, g, b);
  m.update();
  return m;
};

/**
 * Powerful quadruped, clearly stronger than the player but NOT a colossus
 * (body ~1.6x player height at the shoulder). The horn is the readability
 * carrier: relationship state must be legible before any AI exists.
 */
export function buildMugosh(parent: Entity, position: { x: number; y: number; z: number }): CreatureHandle {
  const root = new Entity('mugosh');
  root.setPosition(position.x, position.y, position.z);
  parent.addChild(root);

  const fur = hide(0.35, 0.28, 0.22);
  const darkFur = hide(0.24, 0.19, 0.15);

  const body = new Entity('body');
  body.setLocalScale(1.6, 1.3, 2.8);
  body.setLocalPosition(0, 1.6, 0);
  body.addComponent('render', { type: 'box', material: fur });
  root.addChild(body);

  const shoulders = new Entity('shoulders');
  shoulders.setLocalScale(1.9, 1.0, 1.1);
  shoulders.setLocalPosition(0, 2.0, -0.9);
  shoulders.addComponent('render', { type: 'box', material: fur });
  root.addChild(shoulders);

  for (const [x, z] of [[-0.6, -1.0], [0.6, -1.0], [-0.6, 1.0], [0.6, 1.0]] as const) {
    const leg = new Entity(`leg-${x}-${z}`);
    leg.setLocalScale(0.45, 1.0, 0.45);
    leg.setLocalPosition(x, 0.5, z);
    leg.addComponent('render', { type: 'box', material: darkFur });
    root.addChild(leg);
  }

  const head = new Entity('head');
  head.setLocalScale(0.9, 0.8, 0.9);
  head.setLocalPosition(0, 2.35, -1.55);
  head.addComponent('render', { type: 'box', material: darkFur });
  root.addChild(head);

  const hornMaterial = emissiveMaterial(HORN_STATES['neutral']!.color, HORN_STATES['neutral']!.intensity);
  const horn = new Entity('horn');
  horn.setLocalScale(0.3, 0.9, 0.3);
  horn.setLocalPosition(0, 2.95, -1.75);
  horn.setLocalEulerAngles(-25, 0, 0);
  horn.addComponent('render', { type: 'cone', material: hornMaterial });
  root.addChild(horn);

  const hornLight = new Entity('horn-light');
  hornLight.addComponent('light', {
    type: 'omni', color: HORN_STATES['neutral']!.color, intensity: 1.4, range: 6,
    castShadows: false,
  });
  hornLight.setLocalPosition(0, 3.1, -1.75);
  root.addChild(hornLight);

  let current = 'neutral';

  return {
    id: 'mugosh',
    root,
    states: () => Object.keys(HORN_STATES),
    state: () => current,
    setState(state) {
      const spec = HORN_STATES[state];
      if (!spec) throw new Error(`mugosh: unknown state "${state}". Known: ${Object.keys(HORN_STATES).join(', ')}`);
      current = state;
      hornMaterial.emissive = spec.color;
      hornMaterial.emissiveIntensity = spec.intensity;
      hornMaterial.update();
      if (hornLight.light) hornLight.light.color = spec.color;
    },
    setLayer(layer, enabled) {
      if (layer === 'emissive') horn.enabled = enabled;
      if (layer === 'light') hornLight.enabled = enabled;
      // no particles / trail layers on this profile
    },
    update() { /* static placeholder — relationship state is the whole show */ },
    destroy() { root.destroy(); },
  };
}
