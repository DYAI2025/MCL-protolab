import { FOG_EXP2, FOG_NONE, Color } from 'playcanvas';
import type { AppBase } from 'playcanvas';

/** scene.fog has NO setter — mutate the FogParams object it returns. */
export function setFog(app: AppBase, color: Color, density: number): void {
  app.scene.fog.type = FOG_EXP2;
  app.scene.fog.color = color;
  app.scene.fog.density = density;
}

export function clearFog(app: AppBase): void {
  app.scene.fog.type = FOG_NONE;
}
