import { BLEND_ADDITIVEALPHA, BLEND_NORMAL, Color, StandardMaterial } from 'playcanvas';

/** emissiveIntensity is the HDR lever — values above 1 are what actually bloom. */
export function emissiveMaterial(color: Color, intensity: number): StandardMaterial {
  const m = new StandardMaterial();
  m.diffuse = Color.BLACK;
  m.emissive = color;
  m.emissiveIntensity = intensity;
  m.update();
  return m;
}

/**
 * opacity alone does nothing — blendType must leave BLEND_NONE, and
 * semi-transparent surfaces almost always want depthWrite = false.
 */
export function translucentMaterial(color: Color, opacity: number, additive = false): StandardMaterial {
  const m = new StandardMaterial();
  m.diffuse = color;
  m.opacity = opacity;
  m.blendType = additive ? BLEND_ADDITIVEALPHA : BLEND_NORMAL;
  m.depthWrite = false;
  m.update();
  return m;
}
