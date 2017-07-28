const txtr = require('txtr');

const {
  NUM_CELLS,

  RANGE,
} = require('./lib/constants/constants');
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
  mount() {
    const {three, pose, input, utils: {js: {bffr}, random: {chnkr}}} = zeo;
    const {THREE, scene} = three;

    const cleanups = [];
    this._cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };

    const buffers = bffr(NUM_POSITIONS_CHUNK, (RANGE + 1) * (RANGE + 1) * 2);
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
        position: position.toArray(),
      });
      return Promise.resolve();
    };
    worker.requestGenerate = (x, z) => new Promise((accept, reject) => {
      const buffer = buffers.alloc();
      worker.postMessage({
        type: 'generate',
        x,
        z,
        buffer,
      });
      queue.push(buffer => {
        accept(buffer);
      });
    });
    worker.onmessage = e => {
      const {data: buffer} = e;
      const cb = queue.shift();
      cb(buffer);
    };

    const _requestObjectsGenerate = (x, z) => worker.requestGenerate(x, z)
      .then(objectsChunkBuffer => protocolUtils.parseGeometry(objectsChunkBuffer));
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

        const {buffer} = objectsChunkData;
        buffers.free(buffer);
      };

      return mesh;
    };

    class TrackedObject {
      constructor(mesh, n, startIndex, endIndex, position) {
        this.mesh = mesh;
        this.n = n;
        this.startIndex = startIndex;
        this.endIndex = endIndex;
        this.position = position;
      }

      erase() {
        const {mesh, startIndex, endIndex} = this;
        const {geometry} = mesh;
        const indexAttribute = geometry.index;
        const indices = indexAttribute.array;
        for (let i = startIndex; i < endIndex; i++) {
          indices[i] = 0;
        }
        indexAttribute.needsUpdate = true;
      }
    }

    const trackedObjects = [];
    const _addTrackedObjects = (mesh, data) => {
      const {objects: objectsData} = data;
      const numObjects = objectsData.length / 4;
      let startObject = null;
      for (let i = 0; i < numObjects; i++) {
        const baseIndex = i * 6;
        const n = objectsData[baseIndex + 0];
        const startIndex = objectsData[baseIndex + 1];
        const endIndex = objectsData[baseIndex + 2];
        const position = new THREE.Vector3().fromArray(objectsData, baseIndex + 3);
        const trackedObject = new TrackedObject(mesh, n, startIndex, endIndex, position);
        trackedObjects.push(trackedObject);

        if (startObject === null) {
          startObject = trackedObject;
        }
      }

      return [startObject, numObjects];
    };
    const _removeTrackedObjects = objectRange => {
      const [startObject, numObjects] = objectRange;
      trackedObjects.splice(trackedObjects.indexOf(startObject), numObjects);
    };
    const _getHoveredTrackedObject = side => {
      const {gamepads} = pose.getStatus();
      const gamepad = gamepads[side];
      const {worldPosition: controllerPosition} = gamepad;

      for (let i = 0; i < trackedObjects.length; i++) {
        const trackedItem = trackedObjects[i];
        if (controllerPosition.distanceTo(trackedItem.position) < 0.2) {
          return trackedItem;
        }
      }
      return null;
    };

    const _triggerdown = e => {
      const {side} = e;
      const trackedObject = _getHoveredTrackedObject(side);

console.log('got tracked object', trackedObject); // XXX

      if (trackedObject) {
        trackedObject.erase();
        trackedObjects.splice(trackedObjects.indexOf(trackedObject), 1);
      }
    };
    input.on('triggerdown', _triggerdown);
    cleanups.push(() => {
      input.removeListener('triggerdown', _triggerdown);
    });

    class ObjectApi {
      registerGeometry(name, fn) {
        return worker.requestRegisterGeometry(name, fn);
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

      addObject(name, position) {
        return worker.requestAddObject('craftingTable', position);
      }
    }
    const objectApi = new ObjectApi();

    const chunker = chnkr.makeChunker({
      resolution: NUM_CELLS,
      range: RANGE,
    });
    const objectsChunkMeshes = [];

    const _requestRefreshObjectsChunks = () => {
      const {hmd} = pose.getStatus();
      const {worldPosition: hmdPosition} = hmd;
      const {added, removed} = chunker.update(hmdPosition.x, hmdPosition.z);

      const addedPromises = added.map(chunk => {
        const {x, z} = chunk;

        return _requestObjectsGenerate(x, z)
          .then(objectsChunkData => {
            const objectsChunkMesh = _makeObjectsChunkMesh(objectsChunkData, x, z);
            scene.add(objectsChunkMesh);

            objectsChunkMeshes.push(objectsChunkMesh);

            const objectRange = _addTrackedObjects(objectsChunkMesh, objectsChunkData);

            chunk.data = {
              objectsChunkMesh,
              objectRange,
            };
          });
      });
      return Promise.all(addedPromises)
        .then(() => {
          for (let i = 0; i < removed.length; i++) {
            const chunk = removed[i];
            const {data} = chunk;
            const {objectsChunkMesh} = data;
            scene.remove(objectsChunkMesh);

            objectsChunkMeshes.splice(objectsChunkMeshes.indexOf(objectsChunkMesh), 1);

            objectsChunkMesh.destroy();

            const {objectRange} = data;
            _removeTrackedObjects(objectRange);
          }
        })
    };

    return Promise.all(
      objectsLib(objectApi)
        .map(makeObject => makeObject()
          .then(cleanup => {
            cleanups.push(cleanup);
          }))
    )
      .then(() => {
        objectApi.addObject('craftingTable', new THREE.Vector3(0, 31, -2));

        let live = true;
        const _recurse = () => {
          _requestRefreshObjectsChunks()
            .then(() => {
              if (live) {
                setTimeout(_recurse, 1000);
              }
            })
            .catch(err => {
              if (live) {
                console.warn(err);

                setTimeout(_recurse, 1000);
              }
            });
        };
        _recurse();
        cleanups.push(() => {
          live = false;
        });
      });
  }

  unmount() {
    this._cleanup();
  }
}
const _parseFunction = fn => {
  const match = fn.toString().match(/[^\(]*\(([^\)]*)\)[^\{]*\{([\s\S]*)\}\s*$/); // XXX support bracketless arrow functions
  const args = match[1].split(',').map(arg => arg.trim());
  const src = match[2];
  return {args, src};
};

module.exports = Objects;
