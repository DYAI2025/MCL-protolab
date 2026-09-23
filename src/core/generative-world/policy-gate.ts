import type { CanonProjection, DirectorProposal, StateTransition, StateTransitionOperation, WorldState } from './contracts.ts';
import { cloneJson, deepFreeze } from './json.ts';
import { validateContract } from './validation.ts';

/**
 * Proposal Policy Gate (MCL-84; Confluence 64815106 §4.6, 69697537 D3/D5/D10–D12).
 *
 * Every rule is evaluated and written to the audit trace; a proposal is
 * accepted only without any reason code. Only an accepted result can be
 * compiled into a StateTransition. transition_intent tokens are opaque — the
 * experiment's intent catalog is the only thing that turns them into
 * allowlisted operations.
 */

export const POLICY_GATE_VERSION = 'mcl-84-policy-gate-v1';

export type GateReasonCode =
  | 'SCHEMA_INVALID'
  | 'KIND_NOT_ALLOWED'
  | 'SOURCE_REFS_MISSING'
  | 'REQUIRED_FACT_MISSING'
  | 'CANON_PROMOTION_FORBIDDEN'
  | 'DESIGN_STATUS_INVALID'
  | 'NOT_ACTIONABLE'
  | 'UNKNOWN_INTENT'
  | 'UNKNOWN_FLAG'
  | 'SCOPE_VIOLATION'
  | 'PRECONDITION_UNSUPPORTED'
  | 'PRECONDITION_FAILED'
  | 'UNKNOWN_ENTITY'
  | 'UNKNOWN_LOCATION'
  | 'PRIVACY_OR_SECRET_FIELD';

export type GateRule =
  | 'schema'
  | 'privacy'
  | 'kind'
  | 'source_refs'
  | 'required_facts'
  | 'canon_promotion'
  | 'intents'
  | 'scope'
  | 'preconditions';

export interface GateCheck {
  readonly rule: GateRule;
  readonly outcome: 'passed' | 'failed' | 'skipped';
  readonly detail: string;
}

export interface GateResult {
  readonly gate_version: string;
  readonly proposal_id: string | null;
  readonly status: 'accepted' | 'rejected';
  readonly reasons: readonly GateReasonCode[];
  readonly checks: readonly GateCheck[];
  /** Operations the proposal's intents compile to; empty unless accepted. */
  readonly operations: readonly StateTransitionOperation[];
}

export interface IntentCatalogEntry {
  readonly intent: string;
  readonly operations: readonly StateTransitionOperation[];
}

export interface PolicyScope {
  readonly experiment_id: string;
  readonly allowed_kinds: readonly string[];
  /** A compiled operation may only touch flags under one of these prefixes. */
  readonly flag_prefixes: readonly string[];
  readonly intent_catalog: readonly IntentCatalogEntry[];
}

export interface GateInput {
  readonly canon: CanonProjection;
  readonly state: WorldState;
  readonly scope: PolicyScope;
}

/** design_status values a derived proposal may carry. STATED would claim confirmed canon. */
const PROPOSAL_DESIGN_STATUSES = ['TENTATIVE', 'AMBIGUOUS', 'CONFLICT'];

const SECRET_KEY = /^(api[_-]?key|apikey|secret|client[_-]?secret|token|access[_-]?token|refresh[_-]?token|password|passwd|authorization|cookie|session[_-]?id|email|phone|child[_-]?name|real[_-]?name|address)$/i;
const SECRET_VALUE = /\bBearer\s+[A-Za-z0-9._~+/-]+=*|\bsk-[A-Za-z0-9_-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bdata:(audio|image|video)\/[a-z0-9.+-]+;base64,|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Paths of secret- or private-data-like keys and values anywhere in a JSON value. */
function privacyFindings(value: unknown, path = '$'): string[] {
  if (typeof value === 'string') return SECRET_VALUE.test(value) ? [path] : [];
  if (Array.isArray(value)) return value.flatMap((item, index) => privacyFindings(item, `${path}[${index}]`));
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, child]) => [
      ...(SECRET_KEY.test(key) ? [`${path}.${key}`] : []),
      ...privacyFindings(child, `${path}.${key}`),
    ]);
  }
  return [];
}

export function evaluateProposal(proposal: unknown, input: GateInput): GateResult {
  const checks: GateCheck[] = [];
  const reasons: GateReasonCode[] = [];
  const check = (rule: GateRule, failures: Array<[GateReasonCode, string]>, passDetail: string): void => {
    for (const [code] of failures) if (!reasons.includes(code)) reasons.push(code);
    checks.push({
      rule,
      outcome: failures.length === 0 ? 'passed' : 'failed',
      detail: failures.length === 0 ? passDetail : failures.map(([code, detail]) => `${code}: ${detail}`).join('; '),
    });
  };
  const skip = (rule: GateRule, detail: string): void => {
    checks.push({ rule, outcome: 'skipped', detail });
  };

  const schema = validateContract('DirectorProposal', proposal);
  check('schema', schema.ok ? [] : [['SCHEMA_INVALID', schema.errors.join('; ')]], 'valid DirectorProposal');

  const leaks = privacyFindings(proposal);
  check('privacy', leaks.length === 0 ? [] : [['PRIVACY_OR_SECRET_FIELD', `secret- or private-data-like content at ${leaks.join(', ')}`]], 'no secret or private data');

  const proposalId = isRecord(proposal) && typeof proposal['proposal_id'] === 'string' ? proposal['proposal_id'] : null;
  let operations: StateTransitionOperation[] = [];

  if (!schema.ok) {
    for (const rule of ['kind', 'source_refs', 'required_facts', 'canon_promotion', 'intents', 'scope', 'preconditions'] as const) {
      skip(rule, 'not evaluated: proposal is not schema-valid');
    }
  } else {
    const valid = proposal as DirectorProposal;
    const { canon, state, scope } = input;

    check('kind', scope.allowed_kinds.includes(valid.kind) ? [] : [['KIND_NOT_ALLOWED', `kind "${valid.kind}" is not allowed in ${scope.experiment_id}`]], `kind "${valid.kind}" allowed`);

    check('source_refs', valid.source_refs.length > 0 ? [] : [['SOURCE_REFS_MISSING', 'proposal cites no source']], `${valid.source_refs.length} source ref(s)`);

    const missingFacts = valid.required_facts.filter((fact) => !Object.hasOwn(canon.facts, fact));
    check(
      'required_facts',
      missingFacts.length === 0 ? [] : [['REQUIRED_FACT_MISSING', `not in canon projection ${canon.projection_id}: ${missingFacts.join(', ')}`]],
      `all required facts present in ${canon.projection_id}`,
    );

    const promotion: Array<[GateReasonCode, string]> = [];
    if (valid.design_status === 'STATED') promotion.push(['CANON_PROMOTION_FORBIDDEN', 'a derived proposal cannot declare STATED (confirmed) design']);
    else if (!PROPOSAL_DESIGN_STATUSES.includes(valid.design_status)) promotion.push(['DESIGN_STATUS_INVALID', `unknown design_status "${valid.design_status}"`]);
    check('canon_promotion', promotion, `design_status ${valid.design_status}`);

    const intentFailures: Array<[GateReasonCode, string]> = [];
    const compiled: StateTransitionOperation[] = [];
    const unknownIntents = valid.transition_intent.filter((token) => !scope.intent_catalog.some((entry) => entry.intent === token));
    if (unknownIntents.length > 0) intentFailures.push(['UNKNOWN_INTENT', `not in the intent catalog: ${unknownIntents.join(', ')}`]);
    for (const token of valid.transition_intent) {
      const entry = scope.intent_catalog.find((candidate) => candidate.intent === token);
      if (entry) compiled.push(...entry.operations.map((operation) => cloneJson(operation)));
    }
    if (valid.transition_intent.length === 0 || (unknownIntents.length === 0 && compiled.length === 0)) {
      intentFailures.push(['NOT_ACTIONABLE', 'proposal names no applicable intent']);
    }
    check('intents', intentFailures, `${compiled.length} operation(s) from ${valid.transition_intent.join(', ')}`);

    if (compiled.length === 0) {
      skip('scope', 'no compiled operations to check');
    } else {
      const scopeFailures: Array<[GateReasonCode, string]> = [];
      for (const operation of compiled) {
        if (!scope.flag_prefixes.some((prefix) => operation.flag_ref.startsWith(prefix))) {
          scopeFailures.push(['SCOPE_VIOLATION', `flag "${operation.flag_ref}" is outside ${scope.experiment_id}`]);
        }
        if (!Object.hasOwn(state.world_flags, operation.flag_ref)) {
          scopeFailures.push(['UNKNOWN_FLAG', `flag "${operation.flag_ref}" is not declared in ${state.state_id}`]);
        }
      }
      check('scope', scopeFailures, 'all operations stay inside the experiment scope');
    }

    const preconditionFailures: Array<[GateReasonCode, string]> = [];
    valid.state_preconditions.forEach((precondition, index) => {
      const keys = isRecord(precondition) ? Object.keys(precondition).sort().join(',') : '';
      const record = isRecord(precondition) ? precondition : {};
      if (keys === 'equals,flag_ref' && typeof record['flag_ref'] === 'string' && typeof record['equals'] === 'boolean') {
        const flag = record['flag_ref'];
        if (!Object.hasOwn(state.world_flags, flag)) preconditionFailures.push(['UNKNOWN_FLAG', `precondition ${index}: flag "${flag}" is not declared`]);
        else if (state.world_flags[flag] !== record['equals']) preconditionFailures.push(['PRECONDITION_FAILED', `precondition ${index}: "${flag}" is not ${String(record['equals'])}`]);
      } else if (keys === 'entity_ref' && typeof record['entity_ref'] === 'string') {
        if (!Object.hasOwn(state.entities, record['entity_ref'])) preconditionFailures.push(['UNKNOWN_ENTITY', `precondition ${index}: entity "${record['entity_ref']}" does not exist`]);
      } else if (keys === 'location_ref' && typeof record['location_ref'] === 'string') {
        if (!Object.hasOwn(state.locations, record['location_ref'])) preconditionFailures.push(['UNKNOWN_LOCATION', `precondition ${index}: location "${record['location_ref']}" does not exist`]);
      } else {
        preconditionFailures.push(['PRECONDITION_UNSUPPORTED', `precondition ${index} is not {flag_ref, equals}, {entity_ref} or {location_ref}`]);
      }
    });
    check('preconditions', preconditionFailures, `${valid.state_preconditions.length} precondition(s) hold`);

    operations = compiled;
  }

  const accepted = reasons.length === 0;
  return deepFreeze({
    gate_version: POLICY_GATE_VERSION,
    proposal_id: proposalId,
    status: accepted ? 'accepted' : 'rejected',
    reasons,
    checks,
    operations: accepted ? operations : [],
  });
}

export type CompileResult =
  | { ok: true; transition: StateTransition }
  | { ok: false; reason: 'GATE_NOT_ACCEPTED' | 'GATE_PROPOSAL_MISMATCH'; detail: string };

/** The only bridge from a proposal to the transition engine: requires an accepted gate result. */
export function compileTransition(gate: GateResult, proposal: DirectorProposal, state: WorldState, transitionId: string): CompileResult {
  if (gate.status !== 'accepted') {
    return { ok: false, reason: 'GATE_NOT_ACCEPTED', detail: `gate rejected ${gate.proposal_id ?? 'proposal'}: ${gate.reasons.join(', ')}` };
  }
  if (gate.proposal_id !== proposal.proposal_id) {
    return { ok: false, reason: 'GATE_PROPOSAL_MISMATCH', detail: `gate result is for ${gate.proposal_id ?? 'nothing'}, not ${proposal.proposal_id}` };
  }
  const [first, ...rest] = gate.operations;
  if (!first) return { ok: false, reason: 'GATE_NOT_ACCEPTED', detail: 'accepted gate result carries no operations' };
  return {
    ok: true,
    transition: deepFreeze({
      transition_id: transitionId,
      source_state_ref: state.state_id,
      proposal_ref: proposal.proposal_id,
      operations: [cloneJson(first), ...rest.map((operation) => cloneJson(operation))],
      source_refs: [...proposal.source_refs],
      revision: 1,
    }),
  };
}
