import { describe, expect, it, vi } from 'vitest';
import { createEmitter } from './emitter.ts';

type TestEvents = {
  PLAYER_MOVED: { x: number; y: number; z: number };
  EXPERIMENT_RESET: { id: string };
};

describe('createEmitter', () => {
  it('delivers a payload to a subscriber', () => {
    const bus = createEmitter<TestEvents>();
    const spy = vi.fn();
    bus.on('PLAYER_MOVED', spy);
    bus.emit('PLAYER_MOVED', { x: 1, y: 2, z: 3 });
    expect(spy).toHaveBeenCalledExactlyOnceWith({ x: 1, y: 2, z: 3 });
  });

  it('stops delivering after unsubscribe', () => {
    const bus = createEmitter<TestEvents>();
    const spy = vi.fn();
    const off = bus.on('EXPERIMENT_RESET', spy);
    off();
    bus.emit('EXPERIMENT_RESET', { id: 'playground' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('isolates listeners of different events', () => {
    const bus = createEmitter<TestEvents>();
    const moved = vi.fn();
    bus.on('PLAYER_MOVED', moved);
    bus.emit('EXPERIMENT_RESET', { id: 'playground' });
    expect(moved).not.toHaveBeenCalled();
  });

  it('clear() removes every listener', () => {
    const bus = createEmitter<TestEvents>();
    const spy = vi.fn();
    bus.on('PLAYER_MOVED', spy);
    bus.clear();
    bus.emit('PLAYER_MOVED', { x: 0, y: 0, z: 0 });
    expect(spy).not.toHaveBeenCalled();
  });
});
