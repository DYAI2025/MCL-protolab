import { describe, expect, it } from 'vitest';
import exampleWorldState from '../../../states/example-world-state.json';
import zhalmWorldState from '../../../states/zhalm-forest-initial.json';
import exampleTransition from '../../../transitions/example-state-transition.json';
import type { StateTransition, WorldState } from './contracts.ts';
import { canonicalJson, cloneJson, deepFreeze } from './json.ts';
import { ALLOWED_OPERATIONS, applyOperation, applyTransition, replayTransitions } from './transition-engine.ts';

const zhalm = zhalmWorldState as WorldState;

const setFlag = (transitionId: string, flagRef: string, value = true): StateTransition => ({
  transition_id: transitionId,
  source_state_ref: 'zhalm-forest-v1',
  proposal_ref: `proposal-for-${transitionId}`,
  operations: [{ op: 'SET_WORLD_FLAG', flag_ref: flagRef, value }],
  source_refs: ['MLOA:64815106'],
  revision: 1,
});

const activateClusterB = setFlag('t-cluster-b', 'zhalm.cluster-b.active');
const regroup = setFlag('t-regroup', 'zhalm.network.regrouping');

describe('applyTransition', () => {
  it('sets a declared flag, increments the revision and returns a before/after diff', () => {
    const result = applyTransition(zhalm, activateClusterB);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.world_flags['zhalm.cluster-b.active']).toBe(true);
    expect(result.state.revision).toBe(2);
    expect(result.diff).toEqual([
      { path: ['world_flags', 'zhalm.cluster-b.active'], before: false, after: true },
      { path: ['revision'], before: 1, after: 2 },
    ]);
  });

  it('never mutates the input state', () => {
    const frozenInput = deepFreeze(cloneJson(zhalm));
    const before = canonicalJson(frozenInput);
    applyTransition(frozenInput, activateClusterB);
    expect(canonicalJson(frozenInput)).toBe(before);
  });

  it('returns a frozen result state', () => {
    const result = applyTransition(zhalm, activateClusterB);
    expect(result.ok && Object.isFrozen(result.state.world_flags)).toBe(true);
  });

  it('rejects a flag the state does not declare', () => {
    expect(applyTransition(zhalm, setFlag('t-unknown', 'zhalm.druhen.awakened'))).toMatchObject({ ok: false, reason: 'UNKNOWN_FLAG' });
  });

  it('rejects a transition addressed to a different state', () => {
    const foreign = { ...activateClusterB, source_state_ref: 'glade-initial-state' };
    expect(applyTransition(zhalm, foreign)).toMatchObject({ ok: false, reason: 'STATE_REF_MISMATCH' });
  });

  it('rejects a free-form state replacement because it is not a contract operation', () => {
    const smuggled = { ...activateClusterB, operations: [{ op: 'REPLACE_STATE', state: { world_flags: {} } }] };
    expect(applyTransition(zhalm, smuggled)).toMatchObject({ ok: false, reason: 'TRANSITION_INVALID' });
  });

  it('rejects writing a flag whose current value is not boolean', () => {
    const odd = { ...cloneJson(zhalm), world_flags: { 'zhalm.mood': 'restless' } };
    expect(applyTransition(odd, setFlag('t-mood', 'zhalm.mood'))).toMatchObject({ ok: false, reason: 'FLAG_NOT_BOOLEAN' });
  });

  it('rejects an invalid world state instead of transforming it', () => {
    expect(applyTransition({ ...cloneJson(zhalm), revision: 0 }, activateClusterB)).toMatchObject({ ok: false, reason: 'STATE_INVALID' });
  });
});

describe('operation allowlist', () => {
  it('contains exactly the MCL-81 vocabulary', () => {
    expect(ALLOWED_OPERATIONS).toEqual(['SET_WORLD_FLAG']);
  });

  it('refuses any operation without an allowlisted handler', () => {
    const draft = cloneJson(zhalm);
    const result = applyOperation(draft, { op: 'DELETE_ENTITY', entity_ref: 'player' } as never);
    expect(result).toMatchObject({ ok: false, reason: 'OPERATION_NOT_ALLOWED' });
    expect(canonicalJson(draft)).toBe(canonicalJson(zhalm));
  });
});

describe('replayTransitions', () => {
  it('produces byte-identical target states for the same start state and transition list', () => {
    const first = replayTransitions(zhalm, [activateClusterB, regroup]);
    const second = replayTransitions(cloneJson(zhalm), [cloneJson(activateClusterB), cloneJson(regroup)]);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(canonicalJson(first.state)).toBe(canonicalJson(second.state));
    expect(first.state.revision).toBe(3);
    expect(first.diffs).toHaveLength(2);
  });

  it('stops at the first rejected transition and reports its index', () => {
    const result = replayTransitions(zhalm, [activateClusterB, setFlag('t-bad', 'zhalm.unknown'), regroup]);
    expect(result).toMatchObject({ ok: false, index: 1, reason: 'UNKNOWN_FLAG' });
  });

  it('treats an empty transition list as the identity replay', () => {
    const result = replayTransitions(zhalm, []);
    expect(result.ok && canonicalJson(result.state)).toBe(canonicalJson(zhalm));
  });

  it('replays the MCL-81 example chain (ReplayRef start state + transition)', () => {
    const result = replayTransitions(exampleWorldState as WorldState, [exampleTransition]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.world_flags['zhalm-network-alert-active']).toBe(true);
  });
});
