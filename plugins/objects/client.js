const txtr = require('txtr');

const protocolUtils = require('./lib/utils/protocol-utils');
const objectsLib = require('./lib/objects/index');

const NUM_POSITIONS_CHUNK = 100 * 1024;
const TEXTURE_SIZE = 512;

const OBJECTS_SHADER = {
  uniforms: {
    map: {
      type: 't',
      value: null,
    },
  },
  vertexShader: `\
precision highp float;
precision highp int;
/*uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv; */

varying vec3 vPosition;
varying vec2 vUv;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4( position.xyz, 1.0 );
  gl_Position = projectionMatrix * mvPosition;

  vUv = uv;

	vPosition = position.xyz;
}
`,
  fragmentShader: `\
precision highp float;
precision highp int;
#define ALPHATEST 0.7
#define DOUBLE_SIDED
// uniform mat4 viewMatrix;
uniform vec3 ambientLightColor;
uniform sampler2D map;
uniform sampler2D lightMap;
uniform vec2 d;
uniform float sunIntensity;

varying vec3 vPosition;
varying vec2 vUv;

void main() {
  vec4 diffuseColor = texture2D( map, vUv );
  diffuseColor.a = 0.8;

#ifdef ALPHATEST
	if ( diffuseColor.a < ALPHATEST ) discard;
#endif

	gl_FragColor = diffuseColor;
}
`
};

class Objects {
  /* constructor(archae) {
    this._archae = archae;
  } */

  mount() {
    // const {_archae: archae} = this;
    const {three, utils: {js: {bffr}}} = zeo;
    const {THREE, scene} = three;

    const buffers = bffr(NUM_POSITIONS_CHUNK, 8);
    const textures = txtr(TEXTURE_SIZE, TEXTURE_SIZE);
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');
    const textureAtlas = new THREE.Texture(
      canvas,
      THREE.UVMapping,
      THREE.ClampToEdgeWrapping,
      THREE.ClampToEdgeWrapping,
      THREE.NearestFilter,
      THREE.NearestFilter,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
      1
    );

    const worker = new Worker('archae/plugins/_plugins_objects/build/worker.js');
    const queue = [];
    worker.requestRegisterGeometry = (name, fn) => {
      const {args, src} = _parseFunction(fn);
      worker.postMessage({
        type: 'registerGeometry',
        name,
        args,
        src,
      });
      return Promise.resolve();
    };
    worker.requestRegisterTexture = (name, uv) => {
      worker.postMessage({
        type: 'registerTexture',
        name,
        uv,
      });
      return Promise.resolve();
    };
    worker.requestAddObject = (name, position) => {
      worker.postMessage({
        type: 'addObject',
        name,
        position,
      });
      return Promise.resolve();
    };
    worker.requestGeometry = () => new Promise((accept, reject) => {
      const buffer = buffers.alloc();
      worker.postMessage({
        type: 'generate',
        buffer,
      });
      queue.push(buffer => {
        accept(protocolUtils.parseGeometry(buffer));
      });
    });
    worker.onmessage = e => {
      const {data: buffer} = e;
      const cb = queue.shift();
      cb(buffer);
    };

    class RegisterApi {
      registerGeometry(name, fn) {
        worker.requestRegisterGeometry(name, fn);

        return Promise.resolve();
      }

      registerTexture(name, img) {
        const rect = textures.pack(img.width, img.height);
        const uv = textures.uv(rect);
        worker.requestRegisterTexture(name, uv)
          .catch(err => {
            console.warn(err);
          });

        return createImageBitmap(img, 0, 0, img.width, img.height, {
          imageOrientation: 'flipY',
        })
          .then(imageBitmap => {
            ctx.drawImage(imageBitmap, rect.x, rect.y);
            textureAtlas.needsUpdate = true;
          });
      }
    }
    const registerApi = new RegisterApi();

    const _makeObjectsChunkMesh = objectsChunkData => {
      const mesh = (() => {
        const geometry = (() => {
          const {positions, uvs, indices} = objectsChunkData;
          const geometry = new THREE.BufferGeometry();
          geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
          geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
          geometry.setIndex(new THREE.BufferAttribute(indices, 1));
          geometry.boundingSphere = new THREE.Sphere( // XXX really compute this
            new THREE.Vector3(),
            100
          );

          return geometry;
        })();
        const uniforms = THREE.UniformsUtils.clone(OBJECTS_SHADER.uniforms);
        uniforms.map.value = textureAtlas;
        const material = new THREE.ShaderMaterial({
          uniforms: uniforms,
          vertexShader: OBJECTS_SHADER.vertexShader,
          fragmentShader: OBJECTS_SHADER.fragmentShader,
        });

        const mesh = new THREE.Mesh(geometry, material);
        // mesh.frustumCulled = false;

        return mesh;
      })();

      mesh.destroy = () => {
        mesh.geometry.dispose();

        const {buffer} = mapChunkData;
        buffers.free(buffer);
      };

      return mesh;
    };

    const cleanups = [];

    return Promise.all(
      objectsLib(registerApi)
        .map(makeObject => makeObject()
          .then(cleanup => {
            cleanups.push(cleanup);
          }))
    )
      .then(() => {
        worker.requestAddObject('craftingTable', [0, 31, -2]);
        worker.requestGeometry()
          .then(objectsChunkData => {
            const mesh = _makeObjectsChunkMesh(objectsChunkData);
            scene.add(mesh);
          });
      });

    this._cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };
  }

  unmount() {
    this._cleanup();
  }
}
const _parseFunction = fn => {
  const match = fn.toString().match(/[^\(]*\(([^\)]*)\)[^\{]*\{([\s\S]*)\}\s*$/);
  const args = match[1].split(',').map(arg => arg.trim());
  const src = match[2];
  return {args, src};
};

module.exports = Objects;
