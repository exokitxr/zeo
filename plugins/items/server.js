const zlib = require('zlib');
const isosurface = require('isosurface');

const {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

// const NUM_POSITIONS = 20 * 1024;
const NUM_POSITIONS_CHUNK = 500 * 1024;

class Items {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {app} = archae.getCore();
    const {three, elements} = zeo;
    const {THREE} = three;

    const upVector = new THREE.Vector3(0, 1, 0);

    const _marchCubes = (fn, resolution) => isosurface.marchingCubes(
      [resolution, resolution, resolution],
      fn,
      [
        [-resolution / 2, -resolution / 2, -resolution / 2],
        [resolution / 2, resolution / 2, resolution / 2]
      ]
    );
    const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
      for (let i = 0; i < src.length; i++) {
        dst[startIndexIndex + i] = src[i] + startAttributeIndex;
      }
    };

    const itemsGeometries = [
      (() => {
        const resolution = 12;
        const baseLine1 = new THREE.Line3(
          new THREE.Vector3(0, 0, -resolution * 0.35),
          new THREE.Vector3(-resolution * 0.05, 0, -resolution * 0.2)
        );
        const baseLine2 = new THREE.Line3(
          new THREE.Vector3(-resolution * 0.05, 0, -resolution * 0.2),
          new THREE.Vector3(resolution * 0.05, 0, resolution * 0.2)
        );
        const baseLine3 = new THREE.Line3(
          new THREE.Vector3(resolution * 0.05, 0, resolution * 0.2),
          new THREE.Vector3(0, 0, resolution * 0.35)
        );
        const {positions: positionsArray, cells: cellsArray} = _marchCubes((x, y, z) => {
          const v = new THREE.Vector3(x, y, z);
          return -(resolution / 24) +
            Math.min(
              v.distanceTo(baseLine1.closestPointToPoint(v, true)),
              v.distanceTo(baseLine2.closestPointToPoint(v, true)),
              v.distanceTo(baseLine3.closestPointToPoint(v, true))
            );
        }, resolution);

        const geometry = new THREE.BufferGeometry();
        const numPositions = positionsArray.length;
        const positions = new Float32Array(numPositions * 3);
        for (let i = 0; i < numPositions; i++) {
          const baseIndex = i * 3;
          positions[baseIndex + 0] = positionsArray[i][0];
          positions[baseIndex + 1] = positionsArray[i][1];
          positions[baseIndex + 2] = positionsArray[i][2];
        }
        const colors = new Float32Array(numPositions * 3);
        const baseColor = new THREE.Color(0x795548);
        for (let i = 0; i < numPositions; i++) {
          const baseIndex = i * 3;
          const z = positions[baseIndex + 2];
          const zFactor = (z / resolution) + 0.5;
          const color = baseColor.clone().multiplyScalar(1 - (zFactor * 0.5));
          colors[baseIndex + 0] = color.r;
          colors[baseIndex + 1] = color.g;
          colors[baseIndex + 2] = color.b;
        }
        const numCells = cellsArray.length;
        const indices = new Uint16Array(numCells * 3);
        for (let i = 0; i < numCells; i++) {
          const baseIndex = i * 3;
          indices[baseIndex + 0] = cellsArray[i][0];
          indices[baseIndex + 1] = cellsArray[i][1];
          indices[baseIndex + 2] = cellsArray[i][2];
        }
        geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, positions.length), 3));
        geometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(colors.buffer, colors.byteOffset, colors.length), 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));

        geometry.applyMatrix(new THREE.Matrix4().makeScale(1 / resolution, 1 / resolution, 1 / resolution));
        geometry.computeVertexNormals();

        return geometry;
      })(),
      (() => {
        const resolution = 12;
        const baseLine1 = new THREE.Line3(
          new THREE.Vector3(0, 0, -resolution * 0.15),
          new THREE.Vector3(0, 0, resolution * 0.15)
        );
        const baseLine2 = new THREE.Line3(
          new THREE.Vector3(0, 0, -resolution * 0.15),
          new THREE.Vector3(0, resolution * 0.15, 0)
        );
        const baseLine3 = new THREE.Line3(
          new THREE.Vector3(0, 0, resolution * 0.15),
          new THREE.Vector3(0, resolution * 0.15, 0)
        );
        const {positions: positionsArray, cells: cellsArray} = _marchCubes((x, y, z) => {
          const v = new THREE.Vector3(x, y, z);
          return -(resolution / 10) +
            Math.min(
              v.distanceTo(baseLine1.closestPointToPoint(v, true)),
              v.distanceTo(baseLine2.closestPointToPoint(v, true)),
              v.distanceTo(baseLine3.closestPointToPoint(v, true))
            );
        }, resolution);

        const geometry = new THREE.BufferGeometry();
        const numPositions = positionsArray.length;
        const positions = new Float32Array(numPositions * 3);
        for (let i = 0; i < numPositions; i++) {
          const baseIndex = i * 3;
          positions[baseIndex + 0] = positionsArray[i][0];
          positions[baseIndex + 1] = positionsArray[i][1];
          positions[baseIndex + 2] = positionsArray[i][2];
        }
        const colors = new Float32Array(numPositions * 3);
        const baseColor = new THREE.Color(0x9E9E9E).multiplyScalar(1.2);
        for (let i = 0; i < numPositions; i++) {
          const baseIndex = i * 3;
          const y = positions[baseIndex + 1];
          const yFactor = Math.abs(y / resolution) * 2;
          const color = baseColor.clone().multiplyScalar(0.5 + (yFactor * 0.5));
          colors[baseIndex + 0] = color.r;
          colors[baseIndex + 1] = color.g;
          colors[baseIndex + 2] = color.b;
        }
        const numCells = cellsArray.length;
        const indices = new Uint16Array(numCells * 3);
        for (let i = 0; i < numCells; i++) {
          const baseIndex = i * 3;
          indices[baseIndex + 0] = cellsArray[i][0];
          indices[baseIndex + 1] = cellsArray[i][1];
          indices[baseIndex + 2] = cellsArray[i][2];
        }
        geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, positions.length), 3));
        geometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(colors.buffer, colors.byteOffset, colors.length), 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));

        geometry.applyMatrix(new THREE.Matrix4().makeScale(1 / resolution, 1 / resolution, 1 / resolution));
        geometry.computeVertexNormals();

        return geometry;
      })(),
    ];

    const _makeItemsChunkMesh = (x, y, itemsGeometries, points, heightRange) => {
      const positions = new Float32Array(NUM_POSITIONS_CHUNK * 3);
      const normals = new Float32Array(NUM_POSITIONS_CHUNK * 3);
      const colors = new Float32Array(NUM_POSITIONS_CHUNK * 3);
      const indices = new Uint32Array(NUM_POSITIONS_CHUNK * 3);
      let attributeIndex = 0;
      let indexIndex = 0;

      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3(1, 1, 1);
      const matrix = new THREE.Matrix4();

      const itemProbability = 0.1;

      for (let dy = 0; dy < NUM_CELLS_OVERSCAN; dy++) {
        for (let dx = 0; dx < NUM_CELLS_OVERSCAN; dx++) {
          if (Math.random() < itemProbability) {
            const pointIndex = dx + (dy * NUM_CELLS_OVERSCAN);
            const point = points[pointIndex];
            const {elevation} = point;

            position.set(
              (x * NUM_CELLS) + dx,
              elevation,
              (y * NUM_CELLS) + dy
            )
            quaternion.setFromAxisAngle(upVector, Math.random() * Math.PI * 2);
            matrix.compose(position, quaternion, scale);
            const geometry = itemsGeometries[Math.floor(Math.random() * itemsGeometries.length)]
              .clone()
              .applyMatrix(matrix);
            const newPositions = geometry.getAttribute('position').array;
            positions.set(newPositions, attributeIndex);
            const newNormals = geometry.getAttribute('normal').array;
            normals.set(newNormals, attributeIndex);
            const newColors = geometry.getAttribute('color').array;
            colors.set(newColors, attributeIndex);
            const newIndices = geometry.index.array;
            _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

            attributeIndex += newPositions.length;
            indexIndex += newIndices.length;
          }
        }
      }

      return {
        positions: new Float32Array(positions.buffer, positions.byteOffset, attributeIndex),
        normals: new Float32Array(normals.buffer, normals.byteOffset, attributeIndex),
        colors: new Float32Array(colors.buffer, colors.byteOffset, attributeIndex),
        indices: new Uint32Array(indices.buffer, indices.byteOffset, indexIndex),
        heightRange: [
          heightRange[0],
          heightRange[1] + 1, // account for item height
        ],
      };
    };
    const _requestGenerate = (x, y) => elements.requestElement('plugins-heightfield')
      .then(heightfieldElement => heightfieldElement.generate(x, y));

    function itemsGenerate(req, res, next) {
      const {x: xs, y: ys} = req.query;
      const x = parseInt(xs, 10);
      const y = parseInt(ys, 10);

      if (!isNaN(x) && !isNaN(y)) {
        _requestGenerate(x, y)
          .then(mapChunk => {
            const {points, heightRange} = mapChunk;
            const itemsChunkGeometry = _makeItemsChunkMesh(x, y, itemsGeometries, points, heightRange);
            const itemsChunkBuffer = new Buffer(protocolUtils.stringifyItemsChunk(itemsChunkGeometry));

            res.type('application/octet-stream');
            if (_acceptsEncoding(req, 'gzip')) {
              res.send(itemsChunkBuffer);
            } else {
              res.set('Content-Encoding', 'gzip');
              const itemsChunkStream = zlib.createGzip();
              itemsChunkStream.end(itemsChunkBuffer);
              itemsChunkStream.pipe(res);
            }
          })
          .catch(err => {
            res.status(err.code === 'ETIMEOUT' ? 404 : 500);
            res.send({
              error: err.stack,
            });
          });
      } else {
        res.status(400);
        res.send();
      }
    }
    app.get('/archae/items/generate', itemsGenerate);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'itemsGenerate') {
          routes.splice(i, 1);
        }
        if (route.route) {
          route.route.stack.forEach(removeMiddlewares);
        }
      }
      app._router.stack.forEach(removeMiddlewares);
    };
  }

  unmount() {
    this._cleanup();
  } 
};
const _acceptsEncoding = (req, encoding) => {
  const acceptEncoding = req.headers['accept-encoding'];
  return acceptEncoding ? acceptEncoding.trim().split(/ *, */).includes(encoding) : false;
};

module.exports = Items;
