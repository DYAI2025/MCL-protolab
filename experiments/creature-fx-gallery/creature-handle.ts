import type { Entity } from 'playcanvas';

/**
 * What the gallery needs from one creature placeholder. Deliberately NOT a
 * creature framework: each profile module builds its own scene graph and owns
 * its own state logic (addendum §5 — no BaseCreature, no shared state machine).
 */
export type FxLayer = 'emissive' | 'particles' | 'trail' | 'light';

export interface CreatureHandle {
  readonly id: string;
  readonly root: Entity;
  states(): string[];
  state(): string;
  setState(state: string): void;
  setLayer(layer: FxLayer, enabled: boolean): void;
  update(dt: number): void;
  destroy(): void;
}
