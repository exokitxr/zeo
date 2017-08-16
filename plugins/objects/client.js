const txtr = require('txtr');

const LIGHTMAP_PLUGIN = 'plugins-lightmap';
const DAY_NIGHT_SKYBOX_PLUGIN = 'plugins-day-night-skybox';
const CRAFT_PLUGIN = 'plugins-craft';

const {
  NUM_CELLS,

  NUM_CELLS_HEIGHT,

  RANGE,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');
const objectsLib = require('./lib/objects/client/index');

const NUM_POSITIONS_CHUNK = 1 * 1024 * 1024;
const TEXTURE_SIZE = 512;
const SIDES = ['left', 'right'];

class Objects {
  mount() {
    const {three, pose, input, elements, render, world, teleport, utils: {js: {events, mod, bffr}, hash: {murmur}, random: {chnkr}}} = zeo;
    const {THREE, scene, camera} = three;
    const {EventEmitter} = events;

    const _getChunkIndex = (x, z) => (mod(x, 0xFFFF) << 16) | mod(z, 0xFFFF);
    const _getObjectIndex = (x, z, i) => (mod(x, 0xFF) << 24) | (mod(z, 0xFF) << 16) | (i & 0xFFFF);

    const OBJECTS_SHADER = {
      uniforms: {
        map: {
          type: 't',
          value: null,
        },
        lightMap: {
          type: 't',
          value: null,
        },
        d: {
          type: 'v2',
          value: new THREE.Vector2(),
        },
        selectedObject: {
          type: 'f',
          value: -1,
        },
        sunIntensity: {
          type: 'f',
          value: 0,
        },
        worldTime: {
          type: 'f',
          value: 0,
        },
      },
      vertexShader: `\
precision highp float;
precision highp int;
attribute vec3 frame;
attribute float objectIndex;

varying vec3 vPosition;
varying vec2 vUv;
varying vec3 vFrame;
varying float vObjectIndex;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4( position.xyz, 1.0 );
  gl_Position = projectionMatrix * mvPosition;

  vPosition = position.xyz;
  vUv = uv;
  vFrame = frame;
  vObjectIndex = objectIndex;
}
      `,
      fragmentShader: `\
precision highp float;
precision highp int;
#define ALPHATEST 0.7
#define DOUBLE_SIDED
uniform vec3 ambientLightColor;
uniform sampler2D map;
uniform sampler2D lightMap;
uniform vec2 d;
uniform float selectedObject;
uniform float sunIntensity;
uniform float worldTime;

varying vec3 vPosition;
varying vec2 vUv;
varying vec3 vFrame;
varying float vObjectIndex;

float speed = 1.0;
vec3 blueColor = vec3(0.12941176470588237, 0.5882352941176471, 0.9529411764705882);

void main() {
  vec2 uv2 = vUv;
  if (vFrame.z > 0.0) {
    float animationFactor = mod(worldTime, 1000.0) / 1000.0;
    // float animationFactor = (speed - abs(mod(worldTime / 1000.0, speed*2.0) - speed)) / speed;
    float frameIndex = floor(animationFactor * vFrame.z);
    uv2.y = 1.0 - (((1.0 - uv2.y) - vFrame.x) / vFrame.z + vFrame.x + frameIndex * vFrame.y);
  }
  vec4 diffuseColor = texture2D( map, uv2 );

  if (abs(selectedObject - vObjectIndex) < 0.5) {
    diffuseColor.rgb = mix(diffuseColor.rgb, blueColor, 0.5);
  }

  float u = (
    floor(clamp(vPosition.x - d.x, 0.0, ${(NUM_CELLS).toFixed(8)})) +
    (floor(clamp(vPosition.z - d.y, 0.0, ${(NUM_CELLS).toFixed(8)})) * ${(NUM_CELLS + 1).toFixed(8)}) +
    0.5
  ) / (${(NUM_CELLS + 1).toFixed(8)} * ${(NUM_CELLS + 1).toFixed(8)});
  float v = (floor(vPosition.y) + 0.5) / ${NUM_CELLS_HEIGHT.toFixed(8)};
  vec3 lightColor = texture2D( lightMap, vec2(u, v) ).rgb * 1.0;

#ifdef ALPHATEST
  if ( diffuseColor.a < ALPHATEST ) discard;
#endif

  vec3 outgoingLight = (ambientLightColor * 0.2 + diffuseColor.rgb) * (0.1 + sunIntensity * 0.9) +
    diffuseColor.rgb * (
      min((lightColor.rgb - 0.5) * 2.0, 0.0) * sunIntensity +
      max((lightColor.rgb - 0.5) * 2.0, 0.0) * (1.0 - sunIntensity)
    );

  gl_FragColor = vec4(outgoingLight, diffuseColor.a);
}
      `
    };

    const zeroVector = new THREE.Vector3();
    const forwardVector = new THREE.Vector3(0, 0, -1);
    const zeroQuaternion = new THREE.Quaternion();
    const localVector = new THREE.Vector3();
    const localVector2 = new THREE.Vector3();
    const localQuaternion = new THREE.Quaternion();
    const localEuler = new THREE.Euler();
    const localRay = new THREE.Ray();
    const localArray2 = Array(2);
    const localArray3 = Array(3);
    const localArray32 = Array(3);
    const localMessage = {
      type: '',
      id: 0,
      args: null,
    };
    const localGenerateMessageArgs = {
      x: 0,
      z: 0,
      buffer: null,
    };
    const localUngenerateMessageArgs = {
      x: 0,
      z: 0,
    };

    const cleanups = [];
    this._cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };

    const buffers = bffr(NUM_POSITIONS_CHUNK, RANGE * RANGE * 9);
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

    const objectsMaterial = new THREE.ShaderMaterial({
      uniforms: (() => {
        const uniforms = THREE.UniformsUtils.clone(OBJECTS_SHADER.uniforms);
        uniforms.map.value = textureAtlas;
        return uniforms;
      })(),
      vertexShader: OBJECTS_SHADER.vertexShader,
      fragmentShader: OBJECTS_SHADER.fragmentShader,
      side: THREE.DoubleSide,
    });
    objectsMaterial.volatile = true;

    class QueueEntry {
      constructor(id, cb) {
        this.id = id;
        this.cb = cb;
      }
    }

    const worker = new Worker('archae/plugins/_plugins_objects/build/worker.js');
    const queues = [];
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
    worker.requestRegisterObject = (n, added, removed, updated) => {
      worker.postMessage({
        type: 'registerObject',
        n,
        added,
        removed,
        updated,
      });
      return Promise.resolve();
    };
    worker.requestUnregisterObject = (n, added, removed, updated) => {
      worker.postMessage({
        type: 'unregisterObject',
        n,
        added,
        removed,
        updated,
      });
      return Promise.resolve();
    };
    worker.requestAddObject = (name, position, rotation, value) => {
      worker.postMessage({
        type: 'addObject',
        name,
        position,
        rotation,
        value,
      });
      return Promise.resolve();
    };
    worker.requestRemoveObject = (x, z, index) => {
      worker.postMessage({
        type: 'removeObject',
        x,
        z,
        index,
      });
      return Promise.resolve();
    };
    worker.requestSetObjectData = (x, z, index, value) => {
      worker.postMessage({
        type: 'setObjectData',
        x,
        z,
        index,
        value,
      });
      return Promise.resolve();
    };
    worker.requestGenerate = (x, z) => new Promise((accept, reject) => {
      localMessage.type = 'generate';
      const id = _makeId();
      localMessage.id = id;
      const buffer = buffers.alloc();
      localGenerateMessageArgs.x = x;
      localGenerateMessageArgs.z = z;
      localGenerateMessageArgs.buffer = buffer;
      localMessage.args = localGenerateMessageArgs;

      worker.postMessage(localMessage, [buffer]);
      queues.push(new QueueEntry(id, accept));
    });
    worker.requestUngenerate = (x, z) => {
      localMessage.type = 'ungenerate';
      const id = _makeId();
      localMessage.id = id;
      localUngenerateMessageArgs.x = x;
      localUngenerateMessageArgs.z = z;
      localMessage.args = localUngenerateMessageArgs;

      worker.postMessage(localMessage);

      return Promise.resolve();
    };
    worker.getHoveredObjects = () => new Promise((accept, reject) => {
      localMessage.type = 'getHoveredObjects';
      const id = _makeId();
      localMessage.id = id;
      const {gamepads} = pose.getStatus();
      localArray2[0] = gamepads.left.worldPosition.toArray(localArray3);
      localArray2[1] = gamepads.right.worldPosition.toArray(localArray32);
      localMessage.args = localArray2;

      worker.postMessage(localMessage);
      queues.push(new QueueEntry(id, accept));
    });
    worker.getTeleportObject = position => new Promise((accept, reject) => {
      localMessage.type = 'getTeleportObject';
      const id = _makeId();
      localMessage.id = id;
      localMessage.args = position.toArray(localArray3);

      worker.postMessage(localMessage);
      queues.push(new QueueEntry(id, accept));
    });
    worker.getBodyObject = position => new Promise((accept, reject) => {
      localMessage.type = 'getBodyObject';
      const id = _makeId();
      localMessage.id = id;
      localMessage.args = position.toArray(localArray3);

      worker.postMessage(localMessage);
      queues.push(new QueueEntry(id, accept));
    });
    let pendingResponseId = null;
    worker.onmessage = e => {
      const {data} = e;
      if (typeof data === 'string') {
        const m = JSON.parse(data);
        const {type, args} = m;

        if (type === 'response') {
          const [id] = args;
          pendingResponseId = id;
        } else if (type === 'chunkUpdate') {
          const [x, z] = args;
          const chunk = chunker.getChunk(x, z);
          if (chunk) {
            chunk.lod = -1; // force chunk refresh
          }
        } else if (type === 'objectAdded') {
          const [n, x, z, objectIndex, position, rotation, value] = args;

          const objectApi = objectApis[n];
          if (objectApi) {
            objectApi.addedCallback(
              _getObjectIndex(x, z, objectIndex),
              localVector.fromArray(position),
              localQuaternion.fromArray(rotation),
              value,
              x,
              z,
              objectIndex
            );
          }
        } else if (type === 'objectRemoved') {
          const [n, x, z, objectIndex, startIndex, endIndex] = args;

          if (startIndex !== -1) {
            const objectChunkMesh = objectsChunkMeshes[_getChunkIndex(x, z)];

            if (objectChunkMesh) {
              const indexAttribute = objectChunkMesh.geometry.index;
              const indices = indexAttribute.array;
              for (let i = startIndex; i < endIndex; i++) {
                indices[i] = 0;
              }
              indexAttribute.needsUpdate = true;
            }
          }

          const objectApi = objectApis[n];
          if (objectApi) {
            objectApi.removedCallback(_getObjectIndex(x, z, objectIndex), x, z, objectIndex);
          }
        } else if (type === 'objectUpdated') {
          const [n, x, z, objectIndex, position, rotation, value] = args;

          const objectApi = objectApis[n];
          if (objectApi) {
            objectApi.updateCallback(_getObjectIndex(x, z, objectIndex), localVector.fromArray(position), localQuaternion.fromArray(rotation), value);
          }
        } else {
          console.warn('objects got unknown worker message type:', JSON.stringify(type));
        }
      } else {
        const queueEntryIndex = queues.findIndex(queueEntry => queueEntry.id === pendingResponseId);
        const queueEntry = queues[queueEntryIndex];
        queueEntry.cb(data);
        queues.splice(queueEntryIndex, 1);
        pendingResponseId = null;
      }
    };

    const _requestObjectsGenerate = (x, z) => worker.requestGenerate(x, z)
      .then(objectsChunkBuffer => protocolUtils.parseGeometry(objectsChunkBuffer));
    const _makeObjectsChunkMesh = (objectsChunkData, x, z) => {
      const mesh = (() => {
        const geometry = (() => {
          const {positions, uvs, frames, objectIndices, indices} = objectsChunkData;
          const geometry = new THREE.BufferGeometry();
          geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
          geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
          geometry.addAttribute('frame', new THREE.BufferAttribute(frames, 3));
          geometry.addAttribute('objectIndex', new THREE.BufferAttribute(objectIndices, 1));
          geometry.setIndex(new THREE.BufferAttribute(indices, 1));
          const maxY = 100;
          const minY = -100;
          geometry.boundingSphere = new THREE.Sphere(
            new THREE.Vector3(
              (x * NUM_CELLS) + (NUM_CELLS / 2),
              (minY + maxY) / 2,
              (z * NUM_CELLS) + (NUM_CELLS / 2)
            ),
            Math.max(Math.sqrt((NUM_CELLS / 2) * (NUM_CELLS / 2) * 3), (maxY - minY) / 2) // XXX really compute this
          );

          return geometry;
        })();
        const material = objectsMaterial;

        const mesh = new THREE.Mesh(geometry, material);
        const uniforms = THREE.UniformsUtils.clone(OBJECTS_SHADER.uniforms);
        uniforms.d.value.set(x * NUM_CELLS, z * NUM_CELLS);
        mesh.uniforms = uniforms;
        mesh.onBeforeRender = (function(onBeforeRender) {
          return function() {
            mesh.material.uniforms.d.value.copy(mesh.uniforms.d.value);
            mesh.material.uniforms.lightMap.value = mesh.uniforms.lightMap.value;
            mesh.material.uniforms.selectedObject.value = mesh.uniforms.selectedObject.value;

            onBeforeRender.apply(this, arguments);
          };
        })(mesh.onBeforeRender);
        mesh.offset = new THREE.Vector2(x, z);
        mesh.lightmap = null;

        if (lightmapper) {
          _bindLightmap(mesh);
        }

        return mesh;
      })();

      mesh.destroy = () => {
        mesh.geometry.dispose();

        buffers.free(objectsChunkData.buffer);

        if (mesh.lightmap) {
          _unbindLightmap(mesh);
        }
      };

      return mesh;
    };

    class HoveredTrackedObject {
      constructor() {
        this.n = 0;
        this.x = -1;
        this.z = -1;
        this.objectIndex = -1;
        this.position = new THREE.Vector3();

        this._isSet = false;
      }

      set(n, x, z, objectIndex, positionArray) {
        this.n = n;
        this.x = x;
        this.z = z;
        this.objectIndex = objectIndex;
        this.position.fromArray(positionArray);

        this._isSet = true;
      }

      clear() {
        this._isSet = false;
      }

      isSet() {
        return this._isSet;
      }

      is(name) {
        return murmur(name) === this.n;
      }
    }
    const hoveredTrackedObjects = {
      left: new HoveredTrackedObject(),
      right: new HoveredTrackedObject(),
    };

    const _triggerdown = e => {
      const {side} = e;
      const hoveredTrackedObjectSpec = hoveredTrackedObjects[side];

      if (hoveredTrackedObjectSpec && hoveredTrackedObjectSpec.isSet()) {
        const {n} = hoveredTrackedObjectSpec;
        const objectApi = objectApis[n];

        if (objectApi && objectApi.triggerCallback) {
          const {x, z, objectIndex} = hoveredTrackedObjectSpec;
          objectApi.triggerCallback(_getObjectIndex(x, z, objectIndex), side, x, z, objectIndex);
        }
      }
    };
    input.on('triggerdown', _triggerdown);
    const _gripdown = e => {
      const {side} = e;
      const hoveredTrackedObjectSpec = hoveredTrackedObjects[side];

      if (hoveredTrackedObjectSpec && hoveredTrackedObjectSpec.isSet()) {
        const {n} = hoveredTrackedObjectSpec;
        const objectApi = objectApis[n];

        if (objectApi && objectApi.gripCallback) {
          const {x, z, objectIndex} = hoveredTrackedObjectSpec;
          objectApi.gripCallback(_getObjectIndex(x, z, objectIndex), side, x, z, objectIndex);
        }
      }
    };
    input.on('gripdown', _gripdown, {
      priority: -4,
    });

    const objectApis = {};

    let lightmapper = null;
    const _bindLightmapper = lightmapElement => {
      lightmapper = lightmapElement.lightmapper;

      _bindLightmaps();
    };
    const _unbindLightmapper = () => {
      _unbindLightmaps();

      lightmapper = null;
    };
    const _bindLightmaps = () => {
      for (const index in objectsChunkMeshes) {
        const objectChunkMesh = objectsChunkMeshes[index];
        if (objectChunkMesh) {
          _bindLightmap(objectChunkMesh);
        }
      }
    };
    const _unbindLightmaps = () => {
      for (const index in objectsChunkMeshes) {
        const objectChunkMesh = objectsChunkMeshes[index];
        if (objectChunkMesh) {
          _unbindLightmap(objectChunkMesh);
        }
      }
    };
    const _bindLightmap = objectChunkMesh => {
      const {offset} = objectChunkMesh;
      const {x, y} = offset;
      const lightmap = lightmapper.getLightmapAt(x * NUM_CELLS, y * NUM_CELLS);
      objectChunkMesh.uniforms.lightMap.value = lightmap.texture;
      objectChunkMesh.lightmap = lightmap;
    };
    const _unbindLightmap = objectChunkMesh => {
      const {lightmap} = objectChunkMesh;
      lightmapper.releaseLightmap(lightmap);
      objectChunkMesh.uniforms.lightMap.value = null;
      objectChunkMesh.lightmap = null;
    };
    const lightmapElementListener = elements.makeListener(LIGHTMAP_PLUGIN);
    lightmapElementListener.on('add', entityElement => {
      _bindLightmapper(entityElement);
    });
    lightmapElementListener.on('remove', () => {
      _unbindLightmapper();
    });

    let craftElement = null;
    const recipeQueue = [];
    const craftElementListener = elements.makeListener(CRAFT_PLUGIN);
    craftElementListener.on('add', entityElement => {
      craftElement = entityElement;

      if (recipeQueue.length > 0) {
        for (let i = 0; i < recipeQueue.length; i++) {
          const recipe = recipeQueue[i];
          craftElement.registerRecipe(recipe);
        }
        recipeQueue.length = 0;
      }
    });
    craftElementListener.on('remove', () => {
      craftElement = null;
    });

    const teleportPositions = {
      left: null,
      right: null,
    };
    const _makeTeleportSpec = () => ({
      box: new THREE.Box3(),
      position: new THREE.Vector3(),
      rotation: new THREE.Quaternion(),
      rotationInverse: new THREE.Quaternion(),
    });
    const teleportSpecs = {
      left: _makeTeleportSpec(),
      right: _makeTeleportSpec(),
    };
    const _teleportStart = e => {
      teleportPositions[e.side] = new THREE.Vector3();
    }
    teleport.on('start', _teleportStart);
    const _teleportEnd = e => {
      teleportPositions[e.side] = new THREE.Vector3();
    }
    teleport.on('end', _teleportEnd);
    const _teleportTarget = (position, rotation, scale, side) => {
      const teleportSpec = teleportSpecs[side];
      const {
        box: teleportBox,
        position: teleportPosition,
        rotation: teleportRotation,
        rotationInverse: teleportRotationInverse,
      } = teleportSpec;

      localEuler.setFromQuaternion(rotation, camera.rotation.order);
      const angleFactor = Math.min(Math.pow(Math.max(localEuler.x + Math.PI * 0.45, 0) / (Math.PI * 0.8), 2), 1);
      localEuler.x = 0;
      localEuler.z = 0;
      localRay.origin.set(position.x, 1000, position.z)
        .add(
          localVector.copy(forwardVector)
            .applyEuler(localEuler)
            .multiplyScalar(15 * angleFactor)
        );

      teleportPositions[side].copy(localRay.origin);

      localRay.origin.sub(teleportPosition)
        .applyQuaternion(teleportRotationInverse)
        .add(teleportPosition);
      localRay.direction.set(0, -1, 0);

      const targetPosition = localRay.intersectBox(teleportBox, localVector2);
      if (targetPosition) {
        return targetPosition
          .sub(teleportPosition)
          .applyQuaternion(teleportRotation)
          .add(teleportPosition);
      } else {
        return null;
      }
    };
    teleport.addTarget(_teleportTarget);

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
          // imageOrientation: 'flipY',
        })
          .then(imageBitmap => {
            ctx.drawImage(imageBitmap, rect.x, rect.y);
            textureAtlas.needsUpdate = true;
          });
      }

      addObject(name, position = zeroVector, rotation = zeroQuaternion, value = 0) {
        worker.requestAddObject(name, position.toArray(), rotation.toArray(), value)
          .then(() => {
            const x = Math.floor(position.x / NUM_CELLS);
            const z = Math.floor(position.z / NUM_CELLS);
            const chunk = chunker.getChunk(x, z);
            if (chunk) {
              chunk.lod = -1; // force chunk refresh
            }
          });
      }

      removeObject(x, z, objectIndex) {
        worker.requestRemoveObject(x, z, objectIndex)
          .then(() => {
            const chunk = chunker.getChunk(x, z);
            if (chunk) {
              chunk.lod = -1; // force chunk refresh
            }
          });
      }

      setData(x, z, objectIndex, value) {
        worker.requestSetObjectData(x, z, objectIndex, value);
      }

      registerObject(objectApi) {
        const {object} = objectApi;
        const n = murmur(object);
        objectApis[n] = objectApi;

        worker.requestRegisterObject(n, Boolean(objectApi.addedCallback), Boolean(objectApi.removedCallback), Boolean(objectApi.updateCallback));
      }

      unregisterObject(objectApi) {
        const {object} = objectApi;
        const n = murmur(object);
        objectApis[n] = null;

        worker.requestUnregisterObject(n, Boolean(objectApi.addedCallback), Boolean(objectApi.removedCallback), Boolean(objectApi.updateCallback));
      }

      registerRecipe(recipe) {
        if (craftElement) {
          craftElement.registerRecipe(recipe);
        } else {
          recipeQueue.push(recipe);
        }
      }

      unregisterRecipe(recipe) {
        if (craftElement) {
          craftElement.registerRecipe(recipe);
        } else {
          const index = recipeQueue.indexOf(recipe);

          if (index !== -1) {
            recipeQueue.splice(index, 1);
          }
        }
      }

      getHoveredObject(side) {
        const hoveredTrackedObjectSpec = hoveredTrackedObjects[side];
        return hoveredTrackedObjectSpec.isSet() ? hoveredTrackedObjectSpec : null;
      }

      /* getObjectAt(position, rotation) {
        for (const trackedObjectIndex in trackedObjects) {
          const trackedObject = trackedObjects[trackedObjectIndex];

          if (trackedObject &&
            trackedObject.positionX === position.x && trackedObject.positionY === position.y && trackedObject.positionZ === position.z &&
            trackedObject.rotationX === rotation.x && trackedObject.rotationY === rotation.y && trackedObject.rotationZ === rotation.z && trackedObject.rotationW === rotation.w
          ) {
            return trackedObject;
          }
        }
        return null;
      } */
    }
    const objectApi = new ObjectApi();

    const chunker = chnkr.makeChunker({
      resolution: NUM_CELLS,
      range: RANGE,
    });
    const objectsChunkMeshes = {};

    const _requestRefreshObjectsChunks = () => {
      const {hmd} = pose.getStatus();
      const {worldPosition: hmdPosition} = hmd;
      const {added, removed, relodded} = chunker.update(hmdPosition.x, hmdPosition.z);

      const promises = [];
      const _addChunk = chunk => {
        const {x, z} = chunk;

        const promise = _requestObjectsGenerate(x, z)
          .then(objectsChunkData => {
            const index = _getChunkIndex(x, z);

            const {data: oldData} = chunk;
            if (oldData) {
              const {objectsChunkMesh} = oldData;
              scene.remove(objectsChunkMesh);

              objectsChunkMeshes[index] = null;

              objectsChunkMesh.destroy();
            }

            const objectsChunkMesh = _makeObjectsChunkMesh(objectsChunkData, x, z);
            scene.add(objectsChunkMesh);

            objectsChunkMeshes[index] = objectsChunkMesh;

            chunk.data = {
              objectsChunkMesh,
            };
          });
        promises.push(promise);
      };
      for (let i = 0; i < added.length; i++) {
        _addChunk(added[i]);
      }
      for (let i = 0; i < relodded.length; i++) {
        _addChunk(relodded[i]);
      }
      return Promise.all(promises)
        .then(() => {
          for (let i = 0; i < removed.length; i++) {
            const chunk = removed[i];
            const {x, z} = chunk;
            worker.requestUngenerate(x, z);

            const {data} = chunk;
            const {objectsChunkMesh} = data;
            scene.remove(objectsChunkMesh);

            objectsChunkMeshes[_getChunkIndex(x, z)] = null;

            objectsChunkMesh.destroy();
          }
        });
    };

    let bodyObject = null;

    const _update = () => {
      let updatingHover = false;
      let lastHoverUpdateTime = 0;
      const _updateHoveredTrackedObjects = () => {
        if (!updatingHover) {
          const now = Date.now();
          const timeDiff = now - lastHoverUpdateTime;

          if (timeDiff > 1000 / 30) {
            worker.getHoveredObjects()
              .then(hoveredTrackedObjectSpecs => {
                for (const index in objectsChunkMeshes) {
                  const objectsChunkMesh = objectsChunkMeshes[index];
                  if (objectsChunkMesh) {
                    objectsChunkMesh.uniforms.selectedObject.value = -1;
                  }
                }

                for (let i = 0; i < SIDES.length; i++) {
                  const side = SIDES[i];
                  const hoveredTrackedObjectSpec = hoveredTrackedObjectSpecs[i];

                  if (hoveredTrackedObjectSpec !== null) {
                    const [n, x, z, objectIndex, position] = hoveredTrackedObjectSpec;
                    hoveredTrackedObjects[side].set(n, x, z, objectIndex, position);

                    const objectsChunkMesh = objectsChunkMeshes[_getChunkIndex(x, z)];
                    if (objectsChunkMesh) {
                      objectsChunkMesh.uniforms.selectedObject.value = objectIndex;
                    }
                  } else {
                    hoveredTrackedObjects[side].clear();
                  }
                }

                updatingHover = false;
                lastHoverUpdateTime = Date.now();
              })
              .catch(err => {
                 console.warn(err);

                 updatingHover = false;
                 lastHoverUpdateTime = Date.now();
              });

            updatingHover = true;
          }
        }
      };
      let updatingTeleport = false;
      let lastTeleportUpdateTime = 0;
      const _updateTeleport = () => {
        for (let i = 0; i < SIDES.length; i++) {
          const side = SIDES[i];
          const teleportPosition = teleportPositions[side];
          const teleportSpec = teleportSpecs[side];

          const _clear = () => {
            if (!teleportSpec.box.min.equals(zeroVector)) {
              teleportSpec.box.min.copy(zeroVector);
            }
            if (!teleportSpec.box.max.equals(zeroVector)) {
              teleportSpec.box.max.copy(zeroVector);
            }
            if (!teleportSpec.position.equals(zeroVector)) {
              teleportSpec.position.copy(zeroVector);
            }
            if (!teleportSpec.rotationInverse.equals(zeroQuaternion)) {
              teleportSpec.rotationInverse.copy(zeroQuaternion);
            }
          };

          if (teleportPosition) {
            if (!updatingTeleport) {
              const now = Date.now();
              const timeDiff = now - lastTeleportUpdateTime;

              if (timeDiff > 1000 / 30) {
                worker.getTeleportObject(teleportPosition)
                  .then(teleportObjectSpec => {
                    const teleportPosition = teleportPositions[side];

                    if (teleportPosition && teleportObjectSpec) {
                      let offset = 0;
                      teleportSpec.box.min.fromArray(teleportObjectSpec, offset);
                      offset += 3;
                      teleportSpec.box.max.fromArray(teleportObjectSpec, offset);
                      offset += 3;
                      teleportSpec.position.fromArray(teleportObjectSpec, offset);
                      offset += 3;
                      teleportSpec.rotation.fromArray(teleportObjectSpec, offset);
                      offset += 4;
                      teleportSpec.rotationInverse.fromArray(teleportObjectSpec, offset);
                      offset += 4;
                    } else {
                      _clear();
                    }

                    updatingTeleport = false;
                    lastTeleportUpdateTime = Date.now();
                  })
                  .catch(err => {
                     console.warn(err);

                     updatingTeleport = false;
                     lastTeleportUpdateTime = Date.now();
                  });

                updatingTeleport = true;
              }
            }
          } else {
            _clear();
          }
        }
      };
      let updatingBody = false;
      let lastBodyUpdateTime = 0;
      const _updateBody = () => {
        if (!updatingBody) {
          const now = Date.now();
          const timeDiff = now - lastBodyUpdateTime;

          if (timeDiff > 1000 / 30) {
            const {hmd} = pose.getStatus();
            const {worldPosition: hmdPosition} = hmd;
            worker.getBodyObject(hmdPosition)
              .then(bodyObjectSpec => {
                if (bodyObjectSpec) {
                  const [n, x, z, objectIndex] = bodyObjectSpec;

                  const objectApi = objectApis[n];
                  if (objectApi && objectApi.collideCallback) {
                    objectApi.collideCallback(_getObjectIndex(x, z, objectIndex), x, z, objectIndex);
                  }
                }

                updatingBody = false;
                lastBodyUpdateTime = Date.now();
              })
              .catch(err => {
                 console.warn(err);

                 updatingBody = false;
                 lastBodyUpdateTime = Date.now();
              });

            updatingBody = true;
          }
        }
      };
      const _updateMaterial = () => {
        const worldTime = world.getWorldTime();
        objectsMaterial.uniforms.worldTime.value = worldTime;

        const dayNightSkyboxEntity = elements.getEntitiesElement().querySelector(DAY_NIGHT_SKYBOX_PLUGIN);
        const sunIntensity = (dayNightSkyboxEntity && dayNightSkyboxEntity.getSunIntensity) ? dayNightSkyboxEntity.getSunIntensity() : 0;
        objectsMaterial.uniforms.sunIntensity.value = sunIntensity;
      };

      _updateHoveredTrackedObjects();
      _updateTeleport();
      _updateBody();
      _updateMaterial();
    };
    render.on('update', _update);

    cleanups.push(() => {
      elements.destroyListener(lightmapElementListener);
      elements.destroyListener(craftElementListener);

      teleport.removeListener('start', _teleportStart);
      teleport.removeListener('end', _teleportEnd);
      teleport.removeTarget(_teleportTarget);

      input.removeListener('triggerdown', _triggerdown);
      input.removeListener('gripdown', _gripdown);

      render.removeListener('update', _update);
    });

    return Promise.all(
      objectsLib(objectApi)
        .map(makeObject => makeObject()
          .then(cleanup => {
            cleanups.push(cleanup);
          }))
    )
      .then(() => {
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
let _id = 0;
const _makeId = () => {
  const result = _id;
  _id = (_id + 1) | 0;
  return result;
};
const _parseFunction = fn => {
  const match = fn.toString().match(/[^\(]*\(([^\)]*)\)[^\{]*\{([\s\S]*)\}\s*$/); // XXX support bracketless arrow functions
  const args = match[1].split(',').map(arg => arg.trim());
  const src = match[2];
  return {args, src};
};

module.exports = Objects;
