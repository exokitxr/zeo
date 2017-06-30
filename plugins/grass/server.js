const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS = 30 * 1024;
const NUM_POSITIONS_CHUNK = 1 * 1024 * 1024;
const CAMERA_ROTATION_ORDER = 'YXZ';

class Grass {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {app} = archae.getCore();
    const {three, elements} = zeo;
    const {THREE} = three;

    const upVector = new THREE.Vector3(0, 1, 0);

    const grassColors = (() => {
      const result = new Float32Array(9 * 3);
      const baseColor = new THREE.Color(0x8db360);
      for (let i = 0 ; i < 9; i++) {
        const c = baseColor.clone().multiplyScalar(0.1 + (((i + 1) / 9) * 0.9));
        result[(i * 3) + 0] = c.r;
        result[(i * 3) + 1] = c.g;
        result[(i * 3) + 2] = c.b;
      }
      return result;
    })();
    const grassGeometries = [
      (() => {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(9 * 3);

        positions[0] = 0;
        positions[1] = 0;
        positions[2] = 0;

        positions[3] = 0;
        positions[4] = 0;
        positions[5] = 0;

        positions[6] = 0.01;
        positions[7] = 0;
        positions[8] = 0;

        positions[9] = 0.005;
        positions[10] = 0.02;
        positions[11] = 0;

        positions[12] = 0.015;
        positions[13] = 0.02;
        positions[14] = 0;

        positions[15] = 0.0125;
        positions[16] = 0.04;
        positions[17] = 0;

        positions[18] = 0.02;
        positions[19] = 0.04;
        positions[20] = 0;

        positions[21] = 0.03;
        positions[22] = 0.06;
        positions[23] = 0;

        positions[24] = 0.03;
        positions[25] = 0.06;
        positions[26] = 0;

        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.addAttribute('color', new THREE.BufferAttribute(grassColors, 3));

        return geometry;
      })(),
      (() => {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(9 * 3);

        positions[0] = 0;
        positions[1] = 0.02;
        positions[2] = 0;

        positions[3] = 0;
        positions[4] = 0.02;
        positions[5] = 0;

        positions[6] = 0.0125;
        positions[7] = 0.0125;
        positions[8] = 0;

        positions[9] = 0.01;
        positions[10] = 0;
        positions[11] = -0.001;

        positions[12] = 0.02;
        positions[13] = 0;
        positions[14] = 0;

        positions[15] = 0.02;
        positions[16] = 0.015;
        positions[17] = 0;

        positions[18] = 0.03;
        positions[19] = 0.015;
        positions[20] = 0;

        positions[21] = 0.04;
        positions[22] = 0.025;
        positions[23] = 0;

        positions[24] = 0.04;
        positions[25] = 0.025;
        positions[26] = 0;

        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.addAttribute('color', new THREE.BufferAttribute(grassColors, 3));

        return geometry;
      })(),
    ];

    const _requestGrassTemplates = () => new Promise((accept, reject) => {
      const numGrassesPerPatch = 30;
      const positions = new Float32Array(numGrassesPerPatch * 9 * 3);
      const colors = new Float32Array(numGrassesPerPatch * 9 * 3);
      let attributeIndex = 0;

      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      const matrix = new THREE.Matrix4();

      for (let i = 0; i < numGrassesPerPatch; i++) {
        const baseIndex = (i * 9 * 3);
        position.set(-0.5 + Math.random(), 0, -0.5 + Math.random()).normalize().multiplyScalar(Math.random() * 1);
        quaternion.setFromAxisAngle(upVector, Math.random() * Math.PI * 2);
        scale.set(5 + (Math.random() * 5), 5 + Math.random() * 10, 5 + (Math.random() * 5));
        matrix.compose(position, quaternion, scale);
        const geometry = grassGeometries[Math.floor(Math.random() * grassGeometries.length)]
          .clone()
          .applyMatrix(matrix);
        const newPositions = geometry.getAttribute('position').array;
        positions.set(newPositions, baseIndex);
        const newColors = geometry.getAttribute('color').array;
        colors.set(newColors, baseIndex);

        attributeIndex += newPositions.length;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, attributeIndex), 3));
      geometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(colors.buffer, colors.byteOffset, attributeIndex), 3));

      accept(geometry);
    });
    const _makeGrassChunkMesh = (x, y, grassGeometry, points, numCells, numCellsOverscan) => {
      const positions = new Float32Array(NUM_POSITIONS_CHUNK * 3);
      const colors = new Float32Array(NUM_POSITIONS_CHUNK * 3);
      let attributeIndex = 0;

      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3(1, 1, 1);
      const matrix = new THREE.Matrix4();

      const grassProbability = 0.2;

      for (let dy = 0; dy < numCellsOverscan; dy++) {
        for (let dx = 0; dx < numCellsOverscan; dx++) {
          if (Math.random() < grassProbability) {
            const pointIndex = dx + (dy * numCellsOverscan);
            const point = points[pointIndex];
            const {elevation} = point;

            position.set(
              (x * numCells) + dx,
              elevation,
              (y * numCells) + dy
            )
            quaternion.setFromAxisAngle(upVector, Math.random() * Math.PI * 2);
            matrix.compose(position, quaternion, scale);
            const geometry = grassGeometry
              .clone()
              .applyMatrix(matrix);
            const newPositions = geometry.getAttribute('position').array;
            positions.set(newPositions, attributeIndex);
            const newColors = geometry.getAttribute('color').array;
            colors.set(newColors, attributeIndex);

            attributeIndex += newPositions.length;
          }
        }
      }

      return {
        positions: new Float32Array(positions.buffer, positions.byteOffset, attributeIndex),
        colors: new Float32Array(colors.buffer, colors.byteOffset, attributeIndex),
      };
    };
    const _requestGenerate = (x, y) => elements.requestElement('plugins-heightfield')
      .then(heightfieldElement => ({
        heightfieldElement: heightfieldElement,
        mapChunk: heightfieldElement.generate(x, y),
      }));

    let grassTemplatesPromise = null;
    const _requestGrassTemplatesMemoized = () => {
      if (grassTemplatesPromise === null) {
        grassTemplatesPromise = _requestGrassTemplates();
      }
      return grassTemplatesPromise;
    };

    function grassGenerate(req, res, next) {
      const {x: xs, y: ys} = req.query;
      const x = parseInt(xs, 10);
      const y = parseInt(ys, 10);

      if (!isNaN(x) && !isNaN(y)) {
        Promise.all([
          _requestGrassTemplatesMemoized(),
          _requestGenerate(x, y),
        ])
          .then(([
            grassGeometry,
            {
              heightfieldElement,
              mapChunk,
            },
          ]) => {
            const {points} = mapChunk;
            const numCells = heightfieldElement.getNumCells();
            const numCellsOverscan = heightfieldElement.getNumCellsOverscan();

            const grassChunkGeometry = _makeGrassChunkMesh(x, y, grassGeometry, points, numCells, numCellsOverscan);
            const grassChunkBuffer = new Buffer(protocolUtils.stringifyGrassGeometry(grassChunkGeometry));

            res.type('application/octet-stream');
            res.send(grassChunkBuffer);
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
    app.get('/archae/grass/generate', grassGenerate);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (
          route.handle.name === 'grassTemplates' ||
          route.handle.name === 'grassGenerate'
        ) {
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

module.exports = Grass;
