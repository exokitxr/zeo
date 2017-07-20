#!/usr/bin/env node

const fs = require('fs');
// const THREE = require('/tmp/node_modules/three');

const o = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const {geometries: geometriesJson} = o;
const geometries = geometriesJson.map(geometry => {
  const {data: {attributes: {position: {array: positionsArray}, normal: {array: normalsArray}, uv: {array: uvsArray}}, index: {array: indicesArray}}} = geometry;

  const result = new Buffer(4 * 4 + positionsArray.length * 4 + normalsArray.length * 4 + uvsArray.length * 4 + indicesArray.length * 2);
  let byteOffset = 0;

  const header = Uint32Array.from([
    positionsArray.length,
    normalsArray.length,
    uvsArray.length,
    indicesArray.length,
  ]);
  new Uint32Array(result.buffer, byteOffset, 4).set(header);
  byteOffset += header.length * 4;

  const positions = Float32Array.from(positionsArray);
  /* const yOffset = 1.25 * 8;
  for (let i = 0; i < positions.length / 3; i++) {
    positions[i * 3 + 1] += yOffset;
  } */
  /* const g = new THREE.BufferGeometry();
  g.addAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(
    new THREE.Quaternion()
      .setFromUnitVectors(
        new THREE.Vector3(0, 0, -1),
        new THREE.Vector3(0, 0, 1)
      )
  )); */
  /* for (let i = 0; i < positions.length / 3; i++) {
    positions[i * 3 + 2] *= -1;
  }
  const g = new THREE.BufferGeometry();
  g.addAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(
    new THREE.Quaternion()
      .setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, -1)
      )
  )); */

  new Float32Array(result.buffer, byteOffset, positions.length).set(positions);
  byteOffset += positions.length * 4;

  const normals = Float32Array.from(normalsArray);
  new Float32Array(result.buffer, byteOffset, normals.length).set(normals);
  byteOffset += normals.length * 4;

  const uvs = Float32Array.from(uvsArray);
  new Float32Array(result.buffer, byteOffset, uvs.length).set(uvs);
  byteOffset += uvs.length * 4;

  const indices = Uint16Array.from(indicesArray);
  new Uint16Array(result.buffer, byteOffset, indices.length).set(indices);
  byteOffset += indices.length * 2;

  return result;
});

process.stdout.write(geometries[0]);
