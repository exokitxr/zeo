const protocolUtils = require('./lib/utils/protocol-utils');

const WALK_ROTATE_SPEED = 0.0005;
const WALK_ROTATE_ANGLE = Math.PI / 4;
const NUM_POSITIONS = 100 * 1024;

const ANIMAL_SHADER = {
  uniforms: {
    theta: {
      type: 'f',
      value: 0,
    },
    map: {
      type: 't',
      value: null,
    },
  },
  vertexShader: [
    "uniform float theta;",
    "attribute vec2 dy;",
    "varying vec2 vUv;",
    "void main() {",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, position.y - dy.y + (dy.y*cos(theta) - dy.x*sin(theta)), position.z - dy.x + (dy.x*cos(theta) + dy.y*sin(theta)), 1.0);",
    "  vUv = uv;",
    "}"
  ].join("\n"),
  fragmentShader: [
    "uniform sampler2D map;",
    "varying vec2 vUv;",
    "void main() {",
    "  gl_FragColor = texture2D(map, vUv);",
    "}"
  ].join("\n")
};

class Chest {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render, pose, input, hands, animation, utils: {geometry: geometryUtils}} = zeo;
    const {THREE, scene} = three;

    const zeroQuaternion = new THREE.Quaternion();
    const upQuaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 1, 0)
    );

    /* const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
    const _decomposeMatrix = matrix => {
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(position, rotation, scale);
      return {position, rotation, scale};
    }; */
    const _sum = a => {
      let result = 0;
      for (let i = 0; i < a.length; i++) {
        const e = a[i];
        result += e;
      }
      return result;
    };
    const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
      for (let i = 0; i < src.length; i++) {
        dst[startIndexIndex + i] = src[i] + startAttributeIndex;
      }
    };

    const worker = new Worker('archae/plugins/_plugins_animal/build/worker.js');
    const queue = [];
    worker.requestAnimalGeometry = () => new Promise((accept, reject) => {
      const buffer = new ArrayBuffer(NUM_POSITIONS);
      worker.postMessage({
        buffer,
      }, [buffer]);
      queue.push(buffer => {
        accept(buffer);
      });
    });
    worker.onmessage = e => {
      const {data: buffer} = e;
      const cb = queue.shift();
      cb(buffer);
    };

    const _requestAnimalGeometry = () => worker.requestAnimalGeometry()
      .then(animalBuffer => protocolUtils.parseGeometry(animalBuffer));
    const _makeAnimalMesh = animalGeometry => {
      const {positions, normals, dys, uvs, indices, texture: textureData} = animalGeometry;

      const geometry = new THREE.BufferGeometry();
      geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geometry.addAttribute('dy', new THREE.BufferAttribute(dys, 2));
      geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));

      const texture = new THREE.DataTexture(
        textureData,
        16 * 4,
        16 * 3,
        THREE.RGBFormat,
        THREE.UnsignedByteType,
        THREE.UVMapping,
        THREE.ClampToEdgeWrapping,
        THREE.ClampToEdgeWrapping,
        THREE.NearestFilter,
        THREE.NearestFilter,
        1
      );
      texture.needsUpdate = true;
      const uniforms = THREE.UniformsUtils.clone(ANIMAL_SHADER.uniforms);
      uniforms.map.value = texture;
      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: ANIMAL_SHADER.vertexShader,
        fragmentShader: ANIMAL_SHADER.fragmentShader,
        transparent: true,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(2, 31, 0);
      mesh.updateMatrixWorld();
      // mesh.frustumCulled = false;

      mesh.destroy = () => {
        geometry.dispose();
        material.dispose();
        texture.dispose();
      };

      return mesh;
    };

    return _requestAnimalGeometry()
      .then(animalGeometry => {
        const animalMesh = _makeAnimalMesh(animalGeometry);
        scene.add(animalMesh);

        worker.terminate();

        const _update = () => {
          animalMesh.material.uniforms.theta.value = Math.sin(Date.now() * WALK_ROTATE_SPEED * (Math.PI * 2) % (Math.PI * 2)) * WALK_ROTATE_ANGLE;
        };
        render.on('update', _update);

        this._cleanup = () => {
          scene.remove(animalMesh);
          animalMesh.destroy();

          render.removeListener('update', _update);
        };
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Chest;
