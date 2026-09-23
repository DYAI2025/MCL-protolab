/**
 * JSON helpers for the deterministic generative-world core (MCL-82).
 *
 * canonicalJson is the byte-level identity used by replay, reset and diff
 * evidence: object keys are sorted, arrays keep their order. It throws on
 * values plain JSON cannot represent instead of silently dropping them, so a
 * lossy state never looks equal to a complete one.
 */

export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError(`canonicalJson: number ${String(value)} is not finite`);
      return JSON.stringify(value);
    case 'undefined':
      throw new TypeError('canonicalJson: undefined is not representable in JSON');
    case 'object': {
      if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record).sort();
      return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
    }
    default:
      throw new TypeError(`canonicalJson: ${typeof value} is not representable in JSON`);
  }
}

/** Independent deep copy of a JSON value. */
export function cloneJson<T>(value: T): T {
  return JSON.parse(canonicalJson(value)) as T;
}

/** Recursively freezes a JSON value in place and returns it. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
