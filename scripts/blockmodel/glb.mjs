/**
 * Deterministic block-model → GLB builder. No dependencies, no randomness,
 * no timestamps — identical spec input yields byte-identical GLB output,
 * which lets CI prove committed binaries match their specs.
 *
 * Spec shape (see assets/blockmodels/*.json):
 *   { name: string, cubes: [{ from: [x,y,z], to: [x,y,z], color: [r,g,b] }] }
 * Units are meters, Y-up (glTF convention, PlayCanvas convention).
 */

const FACES = [
  { normal: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },   // +z
  { normal: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },  // -z
  { normal: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },   // +x
  { normal: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },  // -x
  { normal: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },   // +y
  { normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },  // -y
];

const pad4 = (n) => (4 - (n % 4)) % 4;

export function buildGlb(spec) {
  // Group cubes by color — one glTF primitive + material per distinct color.
  const groups = new Map();
  for (const cube of spec.cubes) {
    const key = cube.color.join(',');
    if (!groups.has(key)) groups.set(key, { color: cube.color, cubes: [] });
    groups.get(key).cubes.push(cube);
  }

  const bufferParts = [];
  const bufferViews = [];
  const accessors = [];
  const materials = [];
  const primitives = [];
  let byteOffset = 0;

  const pushView = (bytes, target) => {
    const view = { buffer: 0, byteOffset, byteLength: bytes.byteLength };
    if (target) view.target = target;
    bufferViews.push(view);
    bufferParts.push(bytes);
    byteOffset += bytes.byteLength;
    const padding = pad4(byteOffset);
    if (padding) {
      bufferParts.push(new Uint8Array(padding));
      byteOffset += padding;
    }
    return bufferViews.length - 1;
  };

  for (const { color, cubes } of groups.values()) {
    const positions = [];
    const normals = [];
    const indices = [];
    for (const cube of cubes) {
      for (const face of FACES) {
        const base = positions.length / 3;
        for (const corner of face.corners) {
          positions.push(
            cube.from[0] + (cube.to[0] - cube.from[0]) * corner[0],
            cube.from[1] + (cube.to[1] - cube.from[1]) * corner[1],
            cube.from[2] + (cube.to[2] - cube.from[2]) * corner[2],
          );
          normals.push(...face.normal);
        }
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    if (positions.length / 3 > 65535) {
      throw new Error(`${spec.name}: primitive exceeds uint16 index range`);
    }

    const positionArray = new Float32Array(positions);
    const normalArray = new Float32Array(normals);
    const indexArray = new Uint16Array(indices);

    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], positions[i + axis]);
        max[axis] = Math.max(max[axis], positions[i + axis]);
      }
    }

    const positionView = pushView(new Uint8Array(positionArray.buffer), 34962);
    const normalView = pushView(new Uint8Array(normalArray.buffer), 34962);
    const indexView = pushView(new Uint8Array(indexArray.buffer), 34963);

    const positionAccessor = accessors.push({ bufferView: positionView, componentType: 5126, count: positions.length / 3, type: 'VEC3', min, max }) - 1;
    const normalAccessor = accessors.push({ bufferView: normalView, componentType: 5126, count: normals.length / 3, type: 'VEC3' }) - 1;
    const indexAccessor = accessors.push({ bufferView: indexView, componentType: 5123, count: indices.length, type: 'SCALAR' }) - 1;

    const material = materials.push({
      name: `color-${color.join('-')}`,
      pbrMetallicRoughness: { baseColorFactor: [...color, 1], metallicFactor: 0, roughnessFactor: 0.9 },
    }) - 1;

    primitives.push({
      attributes: { POSITION: positionAccessor, NORMAL: normalAccessor },
      indices: indexAccessor,
      material,
    });
  }

  const json = {
    asset: { version: '2.0', generator: 'mcl-protolab blockmodel builder' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: spec.name }],
    meshes: [{ name: spec.name, primitives }],
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: byteOffset }],
  };

  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPadding = pad4(jsonBytes.byteLength);
  const jsonChunkLength = jsonBytes.byteLength + jsonPadding;
  const binChunkLength = byteOffset;
  const totalLength = 12 + 8 + jsonChunkLength + 8 + binChunkLength;

  const out = new Uint8Array(totalLength);
  const dv = new DataView(out.buffer);
  let cursor = 0;
  dv.setUint32(cursor, 0x46546c67, true); cursor += 4; // 'glTF'
  dv.setUint32(cursor, 2, true); cursor += 4;
  dv.setUint32(cursor, totalLength, true); cursor += 4;
  dv.setUint32(cursor, jsonChunkLength, true); cursor += 4;
  dv.setUint32(cursor, 0x4e4f534a, true); cursor += 4; // 'JSON'
  out.set(jsonBytes, cursor); cursor += jsonBytes.byteLength;
  for (let i = 0; i < jsonPadding; i++) out[cursor++] = 0x20; // spaces
  dv.setUint32(cursor, binChunkLength, true); cursor += 4;
  dv.setUint32(cursor, 0x004e4942, true); cursor += 4; // 'BIN'
  for (const part of bufferParts) { out.set(part, cursor); cursor += part.byteLength; }

  return out;
}

/**
 * Blockbench "free" format export so every generated model stays hand-editable
 * in Blockbench. Geometry only — colors live in the GLB materials (Blockbench
 * cube `color` is just its 8-slot marker palette).
 */
export function buildBbmodel(spec) {
  const uuid = (index) => {
    const hex = (index + 1).toString(16).padStart(12, '0');
    return `00000000-0000-4000-8000-${hex}`;
  };
  return {
    meta: { format_version: '4.5', model_format: 'free', box_uv: false },
    name: spec.name,
    resolution: { width: 16, height: 16 },
    elements: spec.cubes.map((cube, index) => ({
      name: `cube_${index}`,
      type: 'cube',
      uuid: uuid(index),
      from: cube.from,
      to: cube.to,
      origin: [0, 0, 0],
      autouv: 0,
      color: index % 8,
      faces: Object.fromEntries(
        ['north', 'east', 'south', 'west', 'up', 'down'].map((face) => [face, { uv: [0, 0, 16, 16], texture: null }]),
      ),
    })),
    outliner: spec.cubes.map((_, index) => uuid(index)),
    textures: [],
  };
}
