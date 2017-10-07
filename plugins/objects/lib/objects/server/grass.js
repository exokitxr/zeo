const {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,
} = require('../../constants/constants');
const NUM_POSITIONS_CHUNK = 200 * 1024;
const TEXTURE_SIZE = 512;

const {three: {THREE}, utils: {image: {jimp}}} = zeo;

const grass = objectApi => {
  const upVector = new THREE.Vector3(0, 1, 0);

  const rng = (() => {
    let i = 0;
    return () => objectApi.getHash('grass:' + i++) / 0xFFFFFFFF;
  })();

  const _requestGrassImg = () => {
    class Triangle {
      constructor(a, b, c) {
        this.a = a;
        this.b = b;
        this.c = c;
      }
    }

    const baseColor = new THREE.Color(0x8BC34A);
    const _isPointInTriangle = (p, tri) => {
      const {a: p0, b: p1, c: p2} = tri;
      const A = 1/2 * (-p1.y * p2.x + p0.y * (-p1.x + p2.x) + p0.x * (p1.y - p2.y) + p1.x * p2.y);
      const sign = A < 0 ? -1 : 1;
      const s = (p0.y * p2.x - p0.x * p2.y + (p2.y - p0.y) * p.x + (p0.x - p2.x) * p.y) * sign;
      const t = (p0.x * p1.y - p0.y * p1.x + (p0.y - p1.y) * p.x + (p1.x - p0.x) * p.y) * sign;

      return s > 0 && t > 0 && (s + t) < 2 * A * sign;
    };
    const _isPointInTriangles = (p, ts) => {
      for (let i = 0; i < ts.length; i++) {
        const t = ts[i];
        if (_isPointInTriangle(p, t)) {
          return true;
        }
      }
      return false;
    };

    const img = new jimp(TEXTURE_SIZE, TEXTURE_SIZE);
    const numBlades = 7;
    const numTrianglesPerBlade = 5;
    const numTriangles = numBlades * numTrianglesPerBlade;
    const triangles = Array(numTriangles);
    for (let i = 0; i < numBlades; i++) {
      const type = rng() < 0.5 ? -1 : 0;
      const flip = rng() < 0.5 ? -1 : 1;
      const w = (type === -1) ? 0.3 : 0.4;
      const h = type === -1 ? 0.6 : 0.25;
      const ox = (rng() * (1 - w)) + (flip === -1 ? w : 0);
      const sy = (1 / h) * (0.25 + rng() * 0.75);
      const points = (type === -1 ? [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0.1, 0),
        new THREE.Vector2(0.05, 0.2),
        new THREE.Vector2(0.15, 0.2),
        new THREE.Vector2(0.125, 0.4),
        new THREE.Vector2(0.2, 0.4),
        new THREE.Vector2(0.3, 0.6),
      ] : [
        new THREE.Vector2(0, 0.2),
        new THREE.Vector2(0.125, 0.125),
        new THREE.Vector2(0.1, 0),
        new THREE.Vector2(0.2, 0),
        new THREE.Vector2(0.2, 0.13),
        new THREE.Vector2(0.3, 0.13),
        new THREE.Vector2(0.4, 0.25),
      ]).map(v => v
        .multiply(new THREE.Vector2(flip, sy))
        .add(new THREE.Vector2(ox, 0))
      );

      for (let j = 0; j < numTrianglesPerBlade; j++) {
        const triangle = new Triangle(
          points[j + 0],
          points[j + 1],
          points[j + 2]
        );
        triangles[i * numTrianglesPerBlade + j] = triangle;
      }
    }

    for (let dy = 0; dy < TEXTURE_SIZE; dy++) {
      for (let dx = 0; dx < TEXTURE_SIZE; dx++) {
        img.setPixelColor(
          _isPointInTriangles(
            new THREE.Vector2(dx / TEXTURE_SIZE, 1 - (dy / TEXTURE_SIZE)),
            triangles
          ) ?
            ((baseColor.clone().multiplyScalar(0.3 + ((1 - (dy / TEXTURE_SIZE)) * 1)).getHex() << 8) | 0xFF)
          :
            0x00000000,
          dx,
          dy
        );
      }
    }
    return Promise.resolve(img);
  };
  const doublePlaneBufferGeometry = (() => {
    const planeBufferGeometry = new THREE.PlaneBufferGeometry(1, 1);
    const oldPositions = planeBufferGeometry.getAttribute('position').array;
    // const oldNormals = planeBufferGeometry.getAttribute('normal').array;
    const oldUvs = planeBufferGeometry.getAttribute('uv').array;
    const oldIndices = planeBufferGeometry.index.array;

    const positions = new Float32Array(oldPositions.length * 2);
    // const normals = new Float32Array(oldNormals.length * 2);
    const uvs = new Float32Array(oldUvs.length * 2);
    const indices = new Uint32Array(oldIndices.length * 2);

    const numPositions = positions.length / 3;
    const numOldPositions = oldPositions.length / 3;
    for (let i = 0; i < numPositions; i++) {
      const srcI = i % numOldPositions;
      positions[i * 3 + 0] = oldPositions[srcI * 3 + 0];
      positions[i * 3 + 1] = oldPositions[srcI * 3 + 1];
      positions[i * 3 + 2] = oldPositions[srcI * 3 + 2];

      /* normals[i * 3 + 0] = oldNormals[srcI * 3 + 0];
      normals[i * 3 + 1] = oldNormals[srcI * 3 + 1];
      normals[i * 3 + 2] = oldNormals[srcI * 3 + 2]; */

      uvs[i * 2 + 0] = oldUvs[srcI * 2 + 0];
      uvs[i * 2 + 1] = oldUvs[srcI * 2 + 1];
    }

    const numIndices = indices.length / 3;
    const numOldIndices = oldIndices.length / 3;
    for (let i = 0; i < numOldIndices; i++) {
      const srcI = i;
      indices[i * 3 + 0] = oldIndices[srcI * 3 + 0];
      indices[i * 3 + 1] = oldIndices[srcI * 3 + 1];
      indices[i * 3 + 2] = oldIndices[srcI * 3 + 2];
    }
    for (let i = numOldIndices; i < numIndices; i++) {
      const srcI = i - numOldIndices;
      indices[i * 3 + 0] = oldIndices[srcI * 3 + 0];
      indices[i * 3 + 1] = oldIndices[srcI * 3 + 2];
      indices[i * 3 + 2] = oldIndices[srcI * 3 + 1];
    }

    const geometry = new THREE.BufferGeometry();
    geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
    // geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    return geometry;
  })();

  return () => _requestGrassImg()
    .then(img => objectApi.registerTexture('grass', img))
    .then(() => {
      const grassUvs = objectApi.getUv('grass');
      const uvWidth = grassUvs[2] - grassUvs[0];
      const uvHeight = grassUvs[3] - grassUvs[1];

      const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
        for (let i = 0; i < src.length; i++) {
          dst[startIndexIndex + i] = src[i] + startAttributeIndex;
        }
      };
      const _makeGrassTemplate = () => {
        const numGrasses = Math.floor(4 + rng() * 4);
        const positions = new Float32Array(NUM_POSITIONS_CHUNK);
        const uvs = new Float32Array(NUM_POSITIONS_CHUNK);
        const indices = new Uint32Array(NUM_POSITIONS_CHUNK);
        let attributeIndex = 0;
        let uvIndex = 0;
        let indexIndex = 0;

        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3(1, 1, 1);
        const matrix = new THREE.Matrix4();

        for (let i = 0; i < numGrasses; i++) {
          position.set(-0.5 + rng(), 0, -0.5 + rng())
            .normalize()
            .multiplyScalar(rng() * 1)
            .add(new THREE.Vector3(0, 0.5, 0));
          quaternion.setFromAxisAngle(upVector, rng() * Math.PI * 2);
          matrix.compose(position, quaternion, scale);
          const geometry = doublePlaneBufferGeometry.clone()
            .applyMatrix(matrix);
          const newPositions = geometry.getAttribute('position').array;
          positions.set(newPositions, attributeIndex);
          const newUvs = geometry.getAttribute('uv').array;
          const numNewUvs = newUvs.length / 2;

          for (let j = 0; j < numNewUvs; j++) {
            const baseIndex = j * 2;
            let u = 0.02 + newUvs[baseIndex + 0] * 0.96;
            u = grassUvs[0] + u * uvWidth;
            let v = 0.02 + (1 - newUvs[baseIndex + 1]) * 0.96;
            v = grassUvs[0] + v * uvHeight;

            newUvs[baseIndex + 0] = u;
            newUvs[baseIndex + 1] = v;
          }
          uvs.set(newUvs, uvIndex);
          const newIndices = geometry.index.array;
          _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

          attributeIndex += newPositions.length;
          uvIndex += newUvs.length;
          indexIndex += newIndices.length;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, attributeIndex), 3));
        geometry.addAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs.buffer, uvs.byteOffset, uvIndex), 2));
        geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices.buffer, indices.byteOffset, indexIndex), 1));

        return geometry;
      };
      const numGrassTemplates = 8;
      for (let i = 0; i < numGrassTemplates; i++) {
        objectApi.registerGeometry('grass-' + i, _makeGrassTemplate());
      }

      const localVector = new THREE.Vector3();
      const localQuaternion = new THREE.Quaternion();

      const grassProbability = 0.3;

      objectApi.registerGenerator('grass', chunk => {
        const aox = chunk.x * NUM_CELLS;
        const aoz = chunk.z * NUM_CELLS;

        for (let dz = 0; dz < NUM_CELLS_OVERSCAN; dz++) {
          for (let dx = 0; dx < NUM_CELLS_OVERSCAN; dx++) {
            const ax = aox + dx;
            const az = aoz + dz;
            const v = objectApi.getNoise('grass', 0, 0, ax + 1000, az + 1000);

            if (v < grassProbability) {
              const elevation = objectApi.getElevation(ax, az);

              if (elevation > 64) {
                localVector.set(
                  ax,
                  elevation,
                  az
                );
                localQuaternion.setFromAxisAngle(upVector, objectApi.getHash(v + ':angle') / 0xFFFFFFFF * Math.PI * 2);
                const grassTemplateIndex = Math.floor(objectApi.getHash(v + ':template') / 0xFFFFFFFF * numGrassTemplates);

                objectApi.addObject(chunk, 'grass-' + grassTemplateIndex, localVector, localQuaternion, 0);
              }
            }
          }
        }
      });

      return () => {
      };
    });
};

module.exports = grass;
