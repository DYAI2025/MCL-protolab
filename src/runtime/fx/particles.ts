import { Curve, CurveSet, EMITTERSHAPE_SPHERE, Entity, Vec3 } from 'playcanvas';

export interface ParticleSpec {
  numParticles: number;
  lifetime: number;
  /** Seconds BETWEEN births, not particles per second. Smaller = more particles. */
  rate: number;
  rate2?: number;
  emitterRadius: number;
  colorCurve: number[][];
  alphaCurve: number[];
  scaleCurve: number[];
  velocity: Vec3;
}

export function addParticles(parent: Entity, name: string, spec: ParticleSpec): Entity {
  const e = new Entity(name);
  e.addComponent('particlesystem', {
    numParticles: spec.numParticles,
    lifetime: spec.lifetime,
    rate: spec.rate,
    rate2: spec.rate2 ?? spec.rate,
    emitterShape: EMITTERSHAPE_SPHERE,
    emitterRadius: spec.emitterRadius,
    colorGraph: new CurveSet(spec.colorCurve),
    alphaGraph: new Curve(spec.alphaCurve),
    scaleGraph: new Curve(spec.scaleCurve),
    localVelocityGraph: new CurveSet([[0, spec.velocity.x], [0, spec.velocity.y], [0, spec.velocity.z]]),
    autoPlay: true,
    loop: true,
  });
  parent.addChild(e);
  return e;
}
