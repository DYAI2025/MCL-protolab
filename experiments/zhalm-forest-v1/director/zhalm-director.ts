import zhalmCanon from '../../../projections/zhalm-forest-canon.json';
import activateSecondCluster from '../../../proposals/zhalm-activate-second-cluster.json';
import druhenProtectionDemo from '../../../proposals/zhalm-druhen-protection-demo.json';
import guardianInvestigates from '../../../proposals/zhalm-guardian-investigates.json';
import retreatRegroup from '../../../proposals/zhalm-retreat-regroup.json';
import zhalmInitialState from '../../../states/zhalm-forest-initial.json';
import type { CanonProjection } from '../../../src/core/generative-world/contracts.ts';
import type { DirectorScope } from '../../../src/core/generative-world/director-context.ts';
import { createDirectorSession, type RunView } from '../../../src/core/generative-world/director-session.ts';
import { createFakeProvider } from '../../../src/core/generative-world/fake-provider.ts';
import type { PolicyScope } from '../../../src/core/generative-world/policy-gate.ts';

/**
 * Zhalm-forest configuration of the generative world director (MCL-85):
 * checked-in canon projection, experiment-local intent catalog, and a
 * FakeProvider answering NETWORK_ALERT with three reactions plus one
 * demonstration the policy gate must reject. All reactions are TENTATIVE
 * prototype hypotheses, not design decisions.
 */

export const ZHALM_FLAGS = {
  investigating: 'zhalm.guardian.investigating',
  clusterB: 'zhalm.cluster-b.active',
  regrouping: 'zhalm.network.regrouping',
} as const;

export const ZHALM_POLICY_SCOPE: PolicyScope = {
  experiment_id: 'zhalm-forest-v1',
  allowed_kinds: ['world_reaction'],
  flag_prefixes: ['zhalm.'],
  intent_catalog: [
    { intent: 'guardian_investigates_noise', operations: [{ op: 'SET_WORLD_FLAG', flag_ref: ZHALM_FLAGS.investigating, value: true }] },
    { intent: 'activate_second_sensor_cluster', operations: [{ op: 'SET_WORLD_FLAG', flag_ref: ZHALM_FLAGS.clusterB, value: true }] },
    { intent: 'network_retreat_regroup', operations: [{ op: 'SET_WORLD_FLAG', flag_ref: ZHALM_FLAGS.regrouping, value: true }] },
  ],
};

export const ZHALM_DIRECTOR_SCOPE: DirectorScope = {
  experiment_id: 'zhalm-forest-v1',
  canon_fact_keys: ['zhalm-sensor-network', 'zhalm-large-and-sensor-elements', 'zhalm-network-pulse'],
  event_types: ['NOISE_EMITTED', 'SENSOR_TRIGGERED', 'NETWORK_ALERT'],
};

export const ZHALM_REACTION_FIXTURE_ID = 'zhalm-reactions-v1';

export function createZhalmDirector() {
  return createDirectorSession({
    initial_state: zhalmInitialState,
    // JSON imports widen tuples to string[]; createDirectorSession validates the
    // projection against canon-projection.schema.json and throws if it is invalid.
    canon: zhalmCanon as unknown as CanonProjection,
    director_scope: ZHALM_DIRECTOR_SCOPE,
    policy_scope: ZHALM_POLICY_SCOPE,
    provider: createFakeProvider({
      fixture_id: ZHALM_REACTION_FIXTURE_ID,
      proposal_sets: { NETWORK_ALERT: [guardianInvestigates, activateSecondCluster, retreatRegroup, druhenProtectionDemo] },
    }),
  });
}

export type ZhalmDirector = ReturnType<typeof createZhalmDirector>;

/**
 * True only while a completed run offers at least one accepted, unresolved
 * proposal. A failed, aborted or exhausted run must not block the next alert.
 */
export function awaitingChoice(run: RunView | null): boolean {
  return run !== null
    && run.status === 'STOPPED'
    && !run.resolved
    && run.proposals.some((view) => view.gate.status === 'accepted');
}
