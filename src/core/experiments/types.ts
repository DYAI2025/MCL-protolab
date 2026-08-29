export interface ExperimentContext {
  /** Populated by src/runtime. Opaque here on purpose: src/core must not import the engine. */
  readonly scene: unknown;
  readonly tunables: { get(key: string): number };
}

export interface Experiment {
  readonly id: string;
  init(ctx: ExperimentContext): void;
  reset(ctx: ExperimentContext): void;
  destroy(ctx: ExperimentContext): void;
  readonly tunables: Record<string, number>;
}
