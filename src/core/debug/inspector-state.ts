export interface InspectorSnapshot {
  experimentId: string | null;
  position: { x: number; y: number; z: number };
  speed: number;
  movementState: 'idle' | 'walk' | 'jog';
  fps: number;
}

export function formatInspector(s: InspectorSnapshot) {
  const f = (n: number) => n.toFixed(2);
  return {
    experimentId: s.experimentId ?? '(none)',
    position: `${f(s.position.x)}, ${f(s.position.y)}, ${f(s.position.z)}`,
    speed: f(s.speed),
    movementState: s.movementState,
    fps: String(Math.round(s.fps)),
  };
}
