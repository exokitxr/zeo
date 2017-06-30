const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS = 30 * 1024;
const CAMERA_ROTATION_ORDER = 'YXZ';

class Grass {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {app} = archae.getCore();

    const {three} = zeo;
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
      const numGrassesPerPatch = 100;
      const positions = new Float32Array(numGrassesPerPatch * 9 * 3);
      const colors = new Float32Array(numGrassesPerPatch * 9 * 3);

      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      const matrix = new THREE.Matrix4();

      for (let i = 0; i < numGrassesPerPatch; i++) {
        const baseIndex = (i * 9 * 3);
        position.set(-0.5 + Math.random(), 0, -0.5 + Math.random()).normalize().multiplyScalar(Math.random() * 3);
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
      }

      accept({
        positions,
        colors,
      });
    });
      
    const _makeGrassTemplatesBufferPromise = () => _requestGrassTemplates()
      .then(grassTemplates => protocolUtils.stringifyGrassGeometry(grassTemplates));

    let grassTemplatesBufferPromise = null;
    const _requestGrassTemplatesBuffer = () => {
      if (grassTemplatesBufferPromise === null) {
        grassTemplatesBufferPromise = _makeGrassTemplatesBufferPromise();
      }
      return grassTemplatesBufferPromise;
    };

    function grassTemplates(req, res, next) {
      _requestGrassTemplatesBuffer()
        .then(templatesBuffer => {
          res.type('application/octet-stream');
          res.send(new Buffer(templatesBuffer));
        });
    }
    app.get('/archae/grass/templates', grassTemplates);

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
