export type ProtolabEvents = {
  PLAYER_MOVED: { x: number; y: number; z: number; speed: number };
  EXPERIMENT_RESET: { id: string };
};
