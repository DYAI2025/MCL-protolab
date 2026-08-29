import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs module without type declarations
import { buildBbmodel, buildGlb } from './glb.mjs';

const SPEC = {
  name: 'test-model',
  cubes: [
    { from: [0, 0, 0], to: [1, 1, 1], color: [1, 0, 0] },
    { from: [0, 1, 0], to: [0.5, 1.5, 0.5], color: [0, 1, 0] },
    { from: [2, 0, 0], to: [3, 1, 1], color: [1, 0, 0] },
  ],
};

function parseGlb(bytes: Uint8Array) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const jsonLength = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)));
  return { dv, json, jsonLength };
}

describe('buildGlb', () => {
  it('emits a well-formed glTF 2.0 binary header', () => {
    const bytes = buildGlb(SPEC) as Uint8Array;
    const { dv } = parseGlb(bytes);
    expect(dv.getUint32(0, true)).toBe(0x46546c67); // 'glTF'
    expect(dv.getUint32(4, true)).toBe(2);
    expect(dv.getUint32(8, true)).toBe(bytes.byteLength);
  });

  it('groups cubes by color into one primitive + material each', () => {
    const { json } = parseGlb(buildGlb(SPEC) as Uint8Array);
    expect(json.meshes[0].primitives).toHaveLength(2); // red x2 cubes, green x1
    expect(json.materials).toHaveLength(2);
    expect(json.materials[0].pbrMetallicRoughness.baseColorFactor).toEqual([1, 0, 0, 1]);
  });

  it('writes correct vertex and index counts (24 verts / 36 indices per cube)', () => {
    const { json } = parseGlb(buildGlb(SPEC) as Uint8Array);
    const red = json.meshes[0].primitives[0];
    expect(json.accessors[red.attributes.POSITION].count).toBe(48); // 2 cubes
    expect(json.accessors[red.indices].count).toBe(72);
  });

  it('declares tight position bounds (required min/max)', () => {
    const { json } = parseGlb(buildGlb(SPEC) as Uint8Array);
    const red = json.meshes[0].primitives[0];
    expect(json.accessors[red.attributes.POSITION].min).toEqual([0, 0, 0]);
    expect(json.accessors[red.attributes.POSITION].max).toEqual([3, 1, 1]);
  });

  it('is byte-deterministic for identical input', () => {
    const a = buildGlb(SPEC) as Uint8Array;
    const b = buildGlb(SPEC) as Uint8Array;
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
});

describe('buildBbmodel', () => {
  it('mirrors every cube as an editable Blockbench element', () => {
    const bb = buildBbmodel(SPEC) as { elements: Array<{ from: number[]; to: number[] }>; outliner: string[] };
    expect(bb.elements).toHaveLength(3);
    expect(bb.elements[0]?.from).toEqual([0, 0, 0]);
    expect(bb.outliner).toHaveLength(3);
  });
});
