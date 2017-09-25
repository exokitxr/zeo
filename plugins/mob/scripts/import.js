#!/usr/bin/env node

const THREE = require('./three.js');

const fs = require('fs');

const j = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const s = fs.readFileSync(process.argv[3], 'utf8');

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();

const positions = new Float32Array(j.geometries[0].data.attributes.position.array);
/* for (let i = 0; i < positions.length / 3; i++) {
  const temp = positions[i * 3 + 1];
  positions[i * 3 + 1] = positions[i * 3 + 2];
  positions[i * 3 + 2] = temp;
} */
const uvs = new Float32Array(j.geometries[0].data.attributes.uv.array);
const indices = new Uint16Array(j.geometries[0].data.index.array);

const boneIndices = new Int16Array(positions.length / 3);
const boneLines = s.split('\n').map(l => {
  const match = l.match(/^(\S+) <Vector \((.+), (.+), (.+)\)> <Vector \((.+), (.+), (.+)\)>$/);
  if (match) {
    const name = match[1];
    const startX = parseFloat(match[2]);
    const startY = parseFloat(match[3]);
    const startZ = parseFloat(match[4]);
    const endX = parseFloat(match[5]);
    const endY = parseFloat(match[6]);
    const endZ = parseFloat(match[7]);
    const line = new THREE.Line3(new THREE.Vector3(startX, startY, startZ), new THREE.Vector3(endX, endY, endZ));
    line.name = name;
    return line;
  } else {
    return null;
  }
}).filter(o => o);
const _getNearestBoneName = p => {
  let bestName = null;
  let bestDistance = Infinity;
  for (let i = 0; i < boneLines.length; i++) {
    const boneLine = boneLines[i];
    const distance = boneLine.closestPointToPoint(p, true, localVector2).distanceTo(p);
    if (distance <= bestDistance) {
      bestDistance = distance;
      bestName = boneLine.name;
    }
  }
  return bestName;
};
for (let i = 0; i < positions.length / 3; i++) {
  const boneName = _getNearestBoneName(localVector.fromArray(positions, i * 3));
  if (boneName === 'Thigh.l' || boneName === 'Leg.l') {
    boneIndices[i] = 0;
  } else if (boneName === 'Thigh.r' || boneName === 'Leg.r') {
    boneIndices[i] = 1;
  } else {
    boneIndices[i] = -1;
  }
}

/* const _getBoneLines = name => {
  const result = [];
  const queue = [bones.find(bone => bone.name === name)];
  while (queue.length > 0) {
    const bone = queue.shift();
    const boneIndex = bones.indexOf(bone);
    const nextBones = bones.filter(nextBone => nextBone.parent === boneIndex);
    const line = 
    boneIndices[bones.indexOf(bone)] = true;
  }
  return boneIndices;
};
const leftThighIndices = _findBoneIndices('Thigh.l');
const rightThighIndices = _findBoneIndices('Thigh.r');
const limbSkinIndices = Int16Array.from(skinIndices.map(skinIndex => {
  if (leftLegIndices[skinIndex]) {
    return 0;
  } else if (rightLegIndices[skinIndex]) {
    return 1;
  } else {
    return -1;
  }
})); */

let buffer = Uint32Array.from([positions.length]);
process.stdout.write(new Buffer(buffer.buffer, buffer.byteOffset, buffer.byteLength));
buffer = Uint32Array.from([uvs.length]);
process.stdout.write(new Buffer(buffer.buffer, buffer.byteOffset, buffer.byteLength));
buffer = Uint32Array.from([indices.length]);
process.stdout.write(new Buffer(buffer.buffer, buffer.byteOffset, buffer.byteLength));
buffer = Uint32Array.from([boneIndices.length]);
process.stdout.write(new Buffer(buffer.buffer, buffer.byteOffset, buffer.byteLength));

process.stdout.write(new Buffer(positions.buffer, positions.byteOffset, positions.byteLength));
process.stdout.write(new Buffer(uvs.buffer, uvs.byteOffset, uvs.byteLength));
process.stdout.write(new Buffer(indices.buffer, indices.byteOffset, indices.byteLength));
process.stdout.write(new Buffer(boneIndices.buffer, boneIndices.byteOffset, boneIndices.byteLength));
