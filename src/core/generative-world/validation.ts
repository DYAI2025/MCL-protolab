import Ajv2020 from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv/dist/2020.js';
import branchNodeSchema from '../../../schemas/branch-node.schema.json';
import canonProjectionSchema from '../../../schemas/canon-projection.schema.json';
import directorProposalSchema from '../../../schemas/director-proposal.schema.json';
import directorRunSchema from '../../../schemas/director-run.schema.json';
import replayRefSchema from '../../../schemas/replay-ref.schema.json';
import stateTransitionSchema from '../../../schemas/state-transition.schema.json';
import worldEventSchema from '../../../schemas/world-event.schema.json';
import worldStateSchema from '../../../schemas/world-state.schema.json';

/**
 * Runtime validators for the MCL-81 contracts. The same JSON Schemas that the
 * contract gate checks are compiled here, so the browser and Node enforce one
 * authoritative shape (Confluence 69697537, D2).
 */

export type ContractName =
  | 'CanonProjection'
  | 'WorldState'
  | 'WorldEvent'
  | 'DirectorRun'
  | 'DirectorProposal'
  | 'StateTransition'
  | 'BranchNode'
  | 'ReplayRef';

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

const ajv = new Ajv2020({ allErrors: true, strict: false });

const validators: Record<ContractName, ValidateFunction> = {
  CanonProjection: ajv.compile(canonProjectionSchema),
  WorldState: ajv.compile(worldStateSchema),
  WorldEvent: ajv.compile(worldEventSchema),
  DirectorRun: ajv.compile(directorRunSchema),
  DirectorProposal: ajv.compile(directorProposalSchema),
  StateTransition: ajv.compile(stateTransitionSchema),
  BranchNode: ajv.compile(branchNodeSchema),
  ReplayRef: ajv.compile(replayRefSchema),
};

export function validateContract(name: ContractName, value: unknown): ValidationResult {
  const validate = validators[name];
  if (validate(value)) return { ok: true };
  const errors = (validate.errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`);
  return { ok: false, errors: errors.length > 0 ? errors : [`${name} is invalid`] };
}
