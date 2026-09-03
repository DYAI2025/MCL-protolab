import { describe, expect, it, vi } from 'vitest';
import { createExperimentRegistry } from './registry.ts';
import type { Experiment, ExperimentContext } from './types.ts';

const ctx = {} as ExperimentContext;

function fakeExperiment(id: string): Experiment & { calls: string[] } {
  const calls: string[] = [];
  return {
    id, calls,
    init: () => { calls.push('init'); },
    reset: () => { calls.push('reset'); },
    destroy: () => { calls.push('destroy'); },
    tunables: {},
  };
}

describe('createExperimentRegistry', () => {
  it('registers and lists ids', () => {
    const r = createExperimentRegistry();
    r.register(fakeExperiment('playground'));
    r.register(fakeExperiment('creature-fx-gallery'));
    expect(r.ids()).toEqual(['playground', 'creature-fx-gallery']);
  });

  it('rejects a duplicate id loudly', () => {
    const r = createExperimentRegistry();
    r.register(fakeExperiment('playground'));
    expect(() => r.register(fakeExperiment('playground'))).toThrow(/already registered/i);
  });

  it('throws a listing error for an unknown id instead of failing silently', () => {
    const r = createExperimentRegistry();
    r.register(fakeExperiment('playground'));
    expect(() => r.load('nope', ctx)).toThrow(/nope.*playground/s);
  });

  it('init()s on load', () => {
    const r = createExperimentRegistry();
    const e = fakeExperiment('playground');
    r.register(e);
    r.load('playground', ctx);
    expect(e.calls).toEqual(['init']);
    expect(r.activeId()).toBe('playground');
  });

  it('destroys the previous experiment before initialising the next', () => {
    const r = createExperimentRegistry();
    const a = fakeExperiment('a');
    const b = fakeExperiment('b');
    r.register(a); r.register(b);
    r.load('a', ctx);
    r.load('b', ctx);
    expect(a.calls).toEqual(['init', 'destroy']);
    expect(b.calls).toEqual(['init']);
  });

  it('reset() calls the active experiment reset, not init', () => {
    const r = createExperimentRegistry();
    const e = fakeExperiment('playground');
    r.register(e);
    r.load('playground', ctx);
    r.reset(ctx);
    expect(e.calls).toEqual(['init', 'reset']);
  });

  it('reset() with nothing loaded is a no-op, not a crash', () => {
    expect(() => createExperimentRegistry().reset(ctx)).not.toThrow();
  });

  it('emits EXPERIMENT_RESET through the injected emitter', () => {
    const emit = vi.fn();
    const r = createExperimentRegistry({ emit });
    r.register(fakeExperiment('playground'));
    r.load('playground', ctx);
    r.reset(ctx);
    expect(emit).toHaveBeenCalledWith('EXPERIMENT_RESET', { id: 'playground' });
  });
});
