import { CULLFACE_NONE } from 'playcanvas';
import type { Entity, Material, RenderComponent } from 'playcanvas';

/** World-space vertical bounds over all render mesh instances (reads fresh). */
export function worldBoundsY(entity: Entity): { minY: number; maxY: number } {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const component of entity.findComponents('render') as RenderComponent[]) {
    for (const meshInstance of component.meshInstances) {
      const aabb = meshInstance.aabb; // world-space, lazily synced on read
      minY = Math.min(minY, aabb.center.y - aabb.halfExtents.y);
      maxY = Math.max(maxY, aabb.center.y + aabb.halfExtents.y);
    }
  }
  return { minY, maxY };
}

/**
 * Scales a (typically normalized) generated model to a target world height and
 * drops its lowest point onto groundY. Measure → scale → re-measure → settle;
 * self-correcting, no stale transform math.
 */
export function fitToHeight(entity: Entity, targetHeight: number, groundY: number): void {
  const before = worldBoundsY(entity);
  const height = before.maxY - before.minY;
  if (!Number.isFinite(height) || height <= 0.001) return;
  const factor = targetHeight / height;
  entity.setLocalScale(factor, factor, factor);
  const after = worldBoundsY(entity);
  if (Number.isFinite(after.minY)) {
    const p = entity.getPosition();
    entity.setPosition(p.x, p.y + (groundY - after.minY), p.z);
  }
}

/**
 * Generated candidate meshes (TRELLIS/Tripo pipelines) can ship with inverted
 * winding — without this they cull themselves invisible. Review-only fix; an
 * approved asset gets its winding corrected in cleanup.
 */
export function disableCulling(entity: Entity): void {
  const seen = new Set<Material>();
  for (const component of entity.findComponents('render') as RenderComponent[]) {
    for (const meshInstance of component.meshInstances) {
      const material = meshInstance.material as Material;
      if (seen.has(material)) continue;
      seen.add(material);
      material.cull = CULLFACE_NONE;
      material.update();
    }
  }
}
