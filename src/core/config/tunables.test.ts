import { describe, expect, it, vi } from 'vitest';
import { createTunables } from './tunables.ts';

const defaults = {
  'player.walkSpeed': { value: 5, min: 0, max: 20, step: 0.1 },
  'player.sprintSpeed': { value: 8, min: 0, max: 30, step: 0.1 },
  'player.jumpForce': { value: 600, min: 0, max: 2000, step: 10 },
  'camera.distance': { value: 5, min: 1.5, max: 15, step: 0.1 },
  'camera.sensitivity': { value: 0.15, min: 0.01, max: 1, step: 0.01 },
} as const;

describe('createTunables', () => {
  it('returns the declared default', () => {
    expect(createTunables(defaults).get('player.walkSpeed')).toBe(5);
  });

  it('sets a new value', () => {
    const t = createTunables(defaults);
    t.set('player.walkSpeed', 9);
    expect(t.get('player.walkSpeed')).toBe(9);
  });

  it('clamps to the declared range instead of throwing', () => {
    const t = createTunables(defaults);
    t.set('camera.distance', 999);
    expect(t.get('camera.distance')).toBe(15);
    t.set('camera.distance', -4);
    expect(t.get('camera.distance')).toBe(1.5);
  });

  it('notifies subscribers on change', () => {
    const t = createTunables(defaults);
    const spy = vi.fn();
    t.subscribe(spy);
    t.set('player.jumpForce', 700);
    expect(spy).toHaveBeenCalledExactlyOnceWith('player.jumpForce', 700);
  });

  it('reset() restores every default', () => {
    const t = createTunables(defaults);
    t.set('player.walkSpeed', 12);
    t.set('camera.distance', 9);
    t.reset();
    expect(t.get('player.walkSpeed')).toBe(5);
    expect(t.get('camera.distance')).toBe(5);
  });

  it('exposes descriptors so the inspector can build sliders without hardcoding ranges', () => {
    const d = createTunables(defaults).descriptors();
    expect(d.map((x) => x.key)).toContain('camera.sensitivity');
    expect(d.find((x) => x.key === 'camera.sensitivity')?.max).toBe(1);
  });
});
