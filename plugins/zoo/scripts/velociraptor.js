#!/usr/bin/env node

const fs = require('fs');
const THREE = require('/tmp/node_modules/three');

const globalScale = 1/8;
const _makeDebugBoxMesh = i => new THREE.Box3().setFromCenterAndSize(
  new THREE.Vector3(1.75 * (i === 0 ? -1 : 1), 4.6, 0).multiplyScalar(globalScale),
  new THREE.Vector3(2, 10, 6).multiplyScalar(globalScale)
);
const dyCutoffBoxes = [
  _makeDebugBoxMesh(0),
  _makeDebugBoxMesh(1),
];
const splitX = 0;
const splitZ = 100;
const dhCutoffBox = new THREE.Box3().setFromCenterAndSize(
  new THREE.Vector3(0, 12, -6).multiplyScalar(globalScale),
  new THREE.Vector3(2.2, 8, 8).multiplyScalar(globalScale)
);

const o = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const {geometries: geometriesJson} = o;
const geometries = geometriesJson.map(geometry => {
  const {data: {attributes: {position: {array: positionsArray}, normal: {array: normalsArray}, uv: {array: uvsArray}}, index: {array: indicesArray}}} = geometry;

  const result = new Buffer(
    6 * 4 +
    positionsArray.length * 4 +
    normalsArray.length * 4 +
    uvsArray.length * 4 +
    positionsArray.length / 3 * 4 * 4 +
    positionsArray.length / 3 * 4 * 4 +
    indicesArray.length * 2 +
    3 * 4
  );
  let byteOffset = 0;

  const header = Uint32Array.from([
    positionsArray.length,
    normalsArray.length,
    uvsArray.length,
    positionsArray.length / 3 * 4,
    positionsArray.length / 3 * 4,
    indicesArray.length,
  ]);
  new Uint32Array(result.buffer, byteOffset, 6).set(header);
  byteOffset += header.length * 4;

  const positions = Float32Array.from(positionsArray);
  /* const yOffset = 1.25 * 8;
  for (let i = 0; i < positions.length / 3; i++) {
    positions[i * 3 + 1] += yOffset;
  } */
  /* for (let i = 0; i < positions.length / 3; i++) {
    positions[i * 3 + 2] *= -1;
  } */
  const g = new THREE.BufferGeometry();
  g.addAttribute('position', new THREE.BufferAttribute(positions, 3));
  /* g.applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(
    new THREE.Quaternion()
      .setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, -1)
      )
  )); */
  const scale = 1.5 * globalScale;
  g.applyMatrix(new THREE.Matrix4().makeScale(scale, scale, scale));
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (let i = 0; i < positions.length / 3; i++) {
    min.x = Math.min(positions[i * 3 + 0], min.x);
    min.y = Math.min(positions[i * 3 + 1], min.y);
    min.z = Math.min(positions[i * 3 + 2], min.z);
    max.x = Math.max(positions[i * 3 + 0], max.x);
    max.y = Math.max(positions[i * 3 + 1], max.y);
    max.z = Math.max(positions[i * 3 + 2], max.z);
  }
  for (let i = 0; i < positions.length / 3; i++) {
    positions[i * 3 + 1] -= min.y;
  }
console.warn('min y', min.y);

  new Float32Array(result.buffer, byteOffset, positions.length).set(positions);
  byteOffset += positions.length * 4;

  const normals = Float32Array.from(normalsArray);
  new Float32Array(result.buffer, byteOffset, normals.length).set(normals);
  byteOffset += normals.length * 4;

  const uvs = Float32Array.from(uvsArray);
  new Float32Array(result.buffer, byteOffset, uvs.length).set(uvs);
  byteOffset += uvs.length * 4;

  const indices = Uint16Array.from(indicesArray);

  const dyVertices = {};
  for (let i = 0; i < positions.length / 3; i++) {
    const v = new THREE.Vector3().fromArray(positions, i * 3);

    if (dyCutoffBoxes.some(cutoffBox => cutoffBox.containsPoint(v))) {
      const k = v.toArray().join(':');
      dyVertices[k] = true;
    }
  }
  const bucketAcc = {};
  const bucketCount = {};
  for (let i = 0; i < positions.length / 3; i++) {
    const v = new THREE.Vector3().fromArray(positions, i * 3);
    const k = v.toArray().join(':');
    if (dyVertices[k]) {
      const bucketIndex = (() => {
        if (v.x <= splitX && v.z <= splitZ) {
          return 1;
        } else if (v.x > splitX && v.z <= splitZ) {
          return 2;
        } else if (v.x <= splitX && v.z > splitZ) {
          return 3;
        } else /*if (v.x > splitX && v.z > splitZ)*/ {
          return 4;
        }
      })();
      let bucket = bucketAcc[bucketIndex];
      if (bucket === undefined) {
        bucket = new THREE.Vector3(0, -Infinity, 0);
        bucketAcc[bucketIndex] = bucket;
        bucketCount[bucketIndex] = 0;
      }
      bucket.x += v.x;
      bucket.y = Math.max(v.y, bucket.y);
      bucket.z += v.z;
      bucketCount[bucketIndex]++;
    }
  }

  const dys = new Float32Array(positions.length / 3 * 4);
  let numMatches = 0;
  for (let i = 0; i < positions.length / 3; i++) {
    const v = new THREE.Vector3().fromArray(positions, i * 3);
    const k = v.toArray().join(':');

    const baseIndex = i * 4;
    if (dyVertices[k]) {
      const bucketIndex = (() => {
        if (v.x <= splitX && v.z <= splitZ) {
          return 1;
        } else if (v.x > splitX && v.z <= splitZ) {
          return 2;
        } else if (v.x <= splitX && v.z > splitZ) {
          return 3;
        } else /*if (v.x > splitX && v.z > splitZ)*/ {
          return 4;
        }
      })();
      const bucket = bucketAcc[bucketIndex];
      const count = bucketCount[bucketIndex];
      dys[baseIndex + 0] = v.x - bucket.x / count;
      dys[baseIndex + 1] = v.y - bucket.y;
      dys[baseIndex + 2] = v.z - bucket.z / count;
      dys[baseIndex + 3] = bucketIndex;
      numMatches++;
    } else {
      dys[baseIndex + 0] = 0;
      dys[baseIndex + 1] = 0;
      dys[baseIndex + 2] = 0;
      dys[baseIndex + 3] = 0;
    }
  }
  new Float32Array(result.buffer, byteOffset, dys.length).set(dys);
  byteOffset += dys.length * 4;
console.warn(numMatches / (positions.length / 3));

  const dhVertices = {};
  for (let i = 0; i < positions.length / 3; i++) {
    const v = new THREE.Vector3().fromArray(positions, i * 3);

    if (dhCutoffBox.containsPoint(v)) {
      const k = v.toArray().join(':');
      dhVertices[k] = true;
    }
  }
  const dhBucket = new THREE.Vector3(0, Infinity, -Infinity);
  let dhBucketCount = 0;
  for (let i = 0; i < positions.length / 3; i++) {
    const v = new THREE.Vector3().fromArray(positions, i * 3);
    const k = v.toArray().join(':');
    if (dhVertices[k]) {
      dhBucket.x += v.x;
      dhBucket.y = Math.min(v.y, dhBucket.y);
      dhBucket.z = Math.max(v.z, dhBucket.z);
      dhBucketCount++;
    }
  }
  dhBucket.x /= dhBucketCount;

  const dhs = new Float32Array(positions.length / 3 * 4);
  let numMatches2 = 0;
  for (let i = 0; i < positions.length / 3; i++) {
    const v = new THREE.Vector3().fromArray(positions, i * 3);
    const k = v.toArray().join(':');

    const baseIndex = i * 4;
    if (dhVertices[k]) {
      dhs[baseIndex + 0] = dhBucket.x;
      dhs[baseIndex + 1] = dhBucket.y;
      dhs[baseIndex + 2] = dhBucket.z;
      dhs[baseIndex + 3] = 1;
      numMatches2++;
    } else {
      dhs[baseIndex + 0] = 0;
      dhs[baseIndex + 1] = 0;
      dhs[baseIndex + 2] = 0;
      dhs[baseIndex + 3] = 0;
    }
  }
  new Float32Array(result.buffer, byteOffset, dhs.length).set(dhs);
  byteOffset += dhs.length * 4;
console.warn(numMatches2 / (positions.length / 3));

  new Uint16Array(result.buffer, byteOffset, indices.length).set(indices);
  byteOffset += indices.length * 2;

  new Float32Array(result.buffer, byteOffset, 3).set(Float32Array.from([
    max.x - min.x,
    max.y - min.y,
    max.z - min.z,
  ]));
  byteOffset += 3 * 4;

  return result;
});

process.stdout.write(geometries[0]);
