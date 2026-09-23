import { describe, expect, it } from 'vitest';
import exampleBranchNode from '../../../branches/example-branch-node.json';
import exampleDirectorRun from '../../../director-runs/example-director-run.json';
import exampleCanonProjection from '../../../projections/example-canon-projection.json';
import exampleDirectorProposal from '../../../proposals/example-director-proposal.json';
import exampleReplayRef from '../../../replays/example-replay-ref.json';
import exampleWorldState from '../../../states/example-world-state.json';
import zhalmWorldState from '../../../states/zhalm-forest-initial.json';
import exampleStateTransition from '../../../transitions/example-state-transition.json';
import zhalmNetworkAlert from '../../../world-events/zhalm-network-alert.json';
import zhalmNoiseEmitted from '../../../world-events/zhalm-noise-emitted.json';
import zhalmSensorTriggered from '../../../world-events/zhalm-sensor-triggered.json';
import { validateContract } from './validation.ts';

describe('validateContract', () => {
  it('accepts every committed contract document with the runtime validators', () => {
    expect(validateContract('CanonProjection', exampleCanonProjection)).toEqual({ ok: true });
    expect(validateContract('WorldState', exampleWorldState)).toEqual({ ok: true });
    expect(validateContract('WorldState', zhalmWorldState)).toEqual({ ok: true });
    expect(validateContract('WorldEvent', zhalmNoiseEmitted)).toEqual({ ok: true });
    expect(validateContract('WorldEvent', zhalmSensorTriggered)).toEqual({ ok: true });
    expect(validateContract('WorldEvent', zhalmNetworkAlert)).toEqual({ ok: true });
    expect(validateContract('DirectorRun', exampleDirectorRun)).toEqual({ ok: true });
    expect(validateContract('DirectorProposal', exampleDirectorProposal)).toEqual({ ok: true });
    expect(validateContract('StateTransition', exampleStateTransition)).toEqual({ ok: true });
    expect(validateContract('BranchNode', exampleBranchNode)).toEqual({ ok: true });
    expect(validateContract('ReplayRef', exampleReplayRef)).toEqual({ ok: true });
  });

  it('rejects a document with a missing required field and names the field', () => {
    const withoutId: Record<string, unknown> = { ...zhalmWorldState };
    delete withoutId['state_id'];
    const result = validateContract('WorldState', withoutId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join('\n')).toMatch(/state_id/);
  });

  it('rejects a smuggled property because every schema is closed', () => {
    const result = validateContract('DirectorProposal', { ...exampleDirectorProposal, new_state: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join('\n')).toMatch(/additional properties/);
  });

  it('rejects a transition operation outside the contract vocabulary', () => {
    const result = validateContract('StateTransition', {
      ...exampleStateTransition,
      operations: [{ op: 'REPLACE_STATE', flag_ref: 'x', value: true }],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects NaN and Infinity for numeric contract fields', () => {
    expect(validateContract('WorldState', { ...zhalmWorldState, revision: Infinity }).ok).toBe(false);
    expect(validateContract('DirectorProposal', { ...exampleDirectorProposal, confidence: Number.NaN }).ok).toBe(false);
  });

  it('rejects non-objects without throwing', () => {
    expect(validateContract('WorldEvent', null).ok).toBe(false);
    expect(validateContract('WorldEvent', 'NETWORK_ALERT').ok).toBe(false);
  });
});
