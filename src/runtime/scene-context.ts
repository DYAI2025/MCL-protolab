import type { AppBase, Vec3 } from 'playcanvas';

/**
 * The concrete scene surface src/runtime hands to experiments through
 * ExperimentContext.scene. Core keeps the field opaque (unknown); experiments
 * cast it back to this type.
 */
export interface SceneContext {
  readonly app: AppBase;
  movePlayerTo(position: Vec3): void;
}
