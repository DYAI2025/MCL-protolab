import type { Experiment, ExperimentContext } from './types.ts';

interface EmitterLike { emit(event: 'EXPERIMENT_RESET', payload: { id: string }): void }

export function createExperimentRegistry(emitter?: EmitterLike) {
  const experiments = new Map<string, Experiment>();
  let active: Experiment | null = null;

  return {
    register(experiment: Experiment): void {
      if (experiments.has(experiment.id)) {
        throw new Error(`Experiment "${experiment.id}" is already registered.`);
      }
      experiments.set(experiment.id, experiment);
    },
    ids(): string[] { return [...experiments.keys()]; },
    activeId(): string | null { return active?.id ?? null; },
    load(id: string, ctx: ExperimentContext): void {
      const next = experiments.get(id);
      if (!next) {
        throw new Error(`Unknown experiment "${id}". Registered: ${[...experiments.keys()].join(', ') || '(none)'}`);
      }
      active?.destroy(ctx);
      active = next;
      next.init(ctx);
    },
    reset(ctx: ExperimentContext): void {
      if (!active) return;
      active.reset(ctx);
      emitter?.emit('EXPERIMENT_RESET', { id: active.id });
    },
  };
}

export type ExperimentRegistry = ReturnType<typeof createExperimentRegistry>;
