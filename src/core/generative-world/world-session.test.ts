import { describe, expect, it } from 'vitest';
import zhalmWorldState from '../../../states/zhalm-forest-initial.json';
import networkAlert from '../../../world-events/zhalm-network-alert.json';
import noiseEmitted from '../../../world-events/zhalm-noise-emitted.json';
import type { StateTransition } from './contracts.ts';
import { canonicalJson } from './json.ts';
import { createWorldSession } from './world-session.ts';

const setFlag = (transitionId: string, flagRef: string): StateTransition => ({
  transition_id: transitionId,
  source_state_ref: 'zhalm-forest-v1',
  proposal_ref: `proposal-for-${transitionId}`,
  operations: [{ op: 'SET_WORLD_FLAG', flag_ref: flagRef, value: true }],
  source_refs: ['MLOA:64815106'],
  revision: 1,
});

describe('world session (ledger + transition engine)', () => {
  it('records observed events and applied transitions with provenance', () => {
    const session = createWorldSession(zhalmWorldState);
    expect(session.observe(noiseEmitted).ok).toBe(true);
    expect(session.observe(networkAlert).ok).toBe(true);
    expect(session.apply(setFlag('t-cluster-b', 'zhalm.cluster-b.active')).ok).toBe(true);

    const entries = session.ledger.entries();
    expect(entries.map((entry) => entry.kind)).toEqual(['OBSERVED_EVENT', 'OBSERVED_EVENT', 'TRANSITION_APPLIED']);
    const applied = entries[2];
    expect(applied?.kind === 'TRANSITION_APPLIED' && applied.transition.transition_id).toBe('t-cluster-b');
    expect(applied?.kind === 'TRANSITION_APPLIED' && [applied.from_revision, applied.to_revision]).toEqual([1, 2]);
    expect(session.state().world_flags['zhalm.cluster-b.active']).toBe(true);
  });

  it('records a rejected transition and leaves the state untouched', () => {
    const session = createWorldSession(zhalmWorldState);
    const before = canonicalJson(session.state());
    const result = session.apply(setFlag('t-bad', 'zhalm.druhen.awakened'));
    expect(result).toMatchObject({ ok: false, reason: 'UNKNOWN_FLAG' });
    expect(canonicalJson(session.state())).toBe(before);
    expect(session.ledger.entries().at(-1)).toMatchObject({ kind: 'TRANSITION_REJECTED', transition_id: 't-bad', reason: 'UNKNOWN_FLAG' });
  });

  it('resets to a byte-identical copy of the initial state', () => {
    const session = createWorldSession(zhalmWorldState);
    session.apply(setFlag('t-cluster-b', 'zhalm.cluster-b.active'));
    session.apply(setFlag('t-regroup', 'zhalm.network.regrouping'));
    session.reset();
    expect(canonicalJson(session.state())).toBe(canonicalJson(zhalmWorldState));
    expect(session.appliedTransitions()).toEqual([]);
    expect(session.ledger.entries().at(-1)).toMatchObject({ kind: 'RESET', to_revision: 1 });
  });

  it('replays the applied transitions from the initial state to the current state without any provider', () => {
    const session = createWorldSession(zhalmWorldState);
    session.apply(setFlag('t-cluster-b', 'zhalm.cluster-b.active'));
    session.apply(setFlag('t-investigate', 'zhalm.guardian.investigating'));
    const replay = session.replay();
    expect(replay.ok).toBe(true);
    if (replay.ok) expect(canonicalJson(replay.state)).toBe(canonicalJson(session.state()));
  });

  it('refuses to start from an invalid initial state', () => {
    expect(() => createWorldSession({ state_id: 'broken' })).toThrow(/invalid initial WorldState/);
  });
});
