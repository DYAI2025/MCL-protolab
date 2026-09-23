import { describe, expect, it } from 'vitest';
import { canonicalJson, cloneJson, deepFreeze } from './json.ts';

describe('canonicalJson', () => {
  it('sorts object keys at every depth', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it('produces identical bytes for the same content in a different insertion order', () => {
    const first = { flags: { x: true, y: false }, id: 'w', list: [3, 1, 2] };
    const second = { list: [3, 1, 2], id: 'w', flags: { y: false, x: true } };
    expect(canonicalJson(first)).toBe(canonicalJson(second));
  });

  it('keeps array order, because order is meaningful', () => {
    expect(canonicalJson([2, 1])).not.toBe(canonicalJson([1, 2]));
  });

  it('round-trips through JSON.parse without loss', () => {
    const value = { s: 'ä"\\', n: -1.5, b: false, z: null, nested: [{ k: 'v' }] };
    expect(JSON.parse(canonicalJson(value))).toEqual(value);
  });

  it('throws instead of silently dropping values JSON cannot represent', () => {
    expect(() => canonicalJson({ a: undefined })).toThrow(/undefined/);
    expect(() => canonicalJson([undefined])).toThrow(/undefined/);
    expect(() => canonicalJson({ n: Number.NaN })).toThrow(/finite/);
    expect(() => canonicalJson({ f: () => 1 })).toThrow(/function/);
  });
});

describe('cloneJson', () => {
  it('returns an equal but independent copy', () => {
    const original = { a: { b: [1, 2] } };
    const copy = cloneJson(original);
    expect(copy).toEqual(original);
    copy.a.b.push(3);
    expect(original.a.b).toEqual([1, 2]);
  });
});

describe('deepFreeze', () => {
  it('freezes nested objects and arrays so accidental mutation throws', () => {
    const frozen = deepFreeze({ a: { b: [1] } });
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.a)).toBe(true);
    expect(Object.isFrozen(frozen.a.b)).toBe(true);
    expect(() => { (frozen.a.b as number[]).push(2); }).toThrow(TypeError);
  });
});
