import type { DirectorContext, DirectorProvider } from './director-context.ts';
import { cloneJson } from './json.ts';

/**
 * Deterministic FakeProvider (MCL-83). Answers the latest context event with
 * a configured proposal set; proposal ids are namespaced with the run id so
 * repeated runs never collide. Failure, malformed output and a pending
 * provider can be simulated for lifecycle tests.
 */

export interface FakeProviderOptions {
  readonly fixture_id: string;
  /** Raw proposal templates per event_type. Templates are not trusted: the orchestrator validates them. */
  readonly proposal_sets: Readonly<Record<string, readonly unknown[]>>;
  readonly provider_id?: string;
  readonly fail_with?: string;
  readonly raw_response?: unknown;
  readonly hold_until_aborted?: boolean;
}

const namespaced = (template: unknown, runId: string): unknown => {
  const copy = cloneJson(template);
  if (copy !== null && typeof copy === 'object' && !Array.isArray(copy)) {
    const record = copy as Record<string, unknown>;
    if (typeof record['proposal_id'] === 'string') record['proposal_id'] = `${runId}:${record['proposal_id']}`;
  }
  return copy;
};

export function createFakeProvider(options: FakeProviderOptions): DirectorProvider {
  return {
    provider_id: options.provider_id ?? 'fake-director',
    model_or_fixture: options.fixture_id,

    propose(context: DirectorContext, signal: AbortSignal): Promise<unknown> {
      return new Promise((resolve, reject) => {
        const aborted = (): Error => new Error(`fake provider aborted run ${context.run_id}`);
        if (signal.aborted) {
          reject(aborted());
          return;
        }
        if (options.hold_until_aborted) {
          signal.addEventListener('abort', () => reject(aborted()), { once: true });
          return;
        }
        if (options.fail_with !== undefined) {
          reject(new Error(options.fail_with));
          return;
        }
        if (options.raw_response !== undefined) {
          resolve(cloneJson(options.raw_response));
          return;
        }
        const trigger = context.events.at(-1);
        const set = trigger !== undefined && Object.hasOwn(options.proposal_sets, trigger.event_type)
          ? options.proposal_sets[trigger.event_type] ?? []
          : [];
        resolve(set.map((template) => namespaced(template, context.run_id)));
      });
    },
  };
}
