import { describe, expect, it } from 'vitest';
import { formatInspector } from './inspector-state.ts';

describe('formatInspector', () => {
  it('rounds position to 2 decimals so the overlay does not jitter', () => {
    const out = formatInspector({ experimentId: 'playground', position: { x: 1.23456, y: 0.5, z: -3.9999 }, speed: 4.567, movementState: 'jog', fps: 59.6 });
    expect(out.position).toBe('1.23, 0.50, -4.00');
  });

  it('renders fps as an integer', () => {
    expect(formatInspector({ experimentId: 'x', position: { x: 0, y: 0, z: 0 }, speed: 0, movementState: 'idle', fps: 59.6 }).fps).toBe('60');
  });

  it('shows a placeholder when no experiment is loaded', () => {
    expect(formatInspector({ experimentId: null, position: { x: 0, y: 0, z: 0 }, speed: 0, movementState: 'idle', fps: 0 }).experimentId).toBe('(none)');
  });
});
