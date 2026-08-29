import { LINECAP_ROUND, LINEJOIN_ROUND, LINEWIDTH_WORLD, WideLine, WideLineRenderer } from 'playcanvas';
import type { AppBase, Color, Vec3 } from 'playcanvas';

export interface TrailSpec {
  /** Ring-buffer capacity — oldest points fall off the tail. */
  maxPoints: number;
  /** World-unit width at the head; tapers to 0 at the tail. */
  width: number;
  color: Color;
  /** Minimum distance a new point must be from the last before it is recorded. */
  minDistance?: number;
}

export interface Trail {
  push(position: Vec3): void;
  clear(): void;
  destroy(): void;
}

/**
 * There is no trail renderer in 2.21.4. WideLine + WideLineRenderer with
 * widthUnits = LINEWIDTH_WORLD gives camera-facing world-unit ribbons in one
 * draw call. Alpha is IGNORED — this fades by driving RGB toward black and
 * per-point width toward 0. Each trail owns its renderer instance because any
 * line change dirties the whole renderer.
 */
export function createTrail(app: AppBase, spec: TrailSpec): Trail {
  const renderer = new WideLineRenderer(app);
  renderer.widthUnits = LINEWIDTH_WORLD;
  renderer.depthWrite = false;

  const line = new WideLine();
  line.join = LINEJOIN_ROUND;
  line.cap = LINECAP_ROUND;

  const minDistance = spec.minDistance ?? 0.15;
  const points: Array<{ x: number; y: number; z: number }> = [];
  let added = false;

  const rebuild = (): void => {
    if (points.length < 2) {
      if (added) { renderer.remove(line); added = false; }
      return;
    }
    const positions: number[] = [];
    const colors: number[] = [];
    const widths: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (!p) continue;
      // 0 at the tail, 1 at the head — fade colour to black and width to 0.
      const t = points.length === 1 ? 1 : i / (points.length - 1);
      positions.push(p.x, p.y, p.z);
      colors.push(spec.color.r * t, spec.color.g * t, spec.color.b * t);
      widths.push(spec.width * t);
    }
    line.set(positions, colors, widths);
    if (!added) { renderer.add(line); added = true; }
  };

  return {
    push(position: Vec3): void {
      const last = points[points.length - 1];
      if (last) {
        const d = Math.hypot(position.x - last.x, position.y - last.y, position.z - last.z);
        if (d < minDistance) return;
      }
      points.push({ x: position.x, y: position.y, z: position.z });
      while (points.length > spec.maxPoints) points.shift();
      rebuild();
    },
    clear(): void {
      points.length = 0;
      rebuild();
    },
    destroy(): void {
      renderer.destroy();
    },
  };
}
