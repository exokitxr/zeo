const txtr = require('txtr');

const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
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
const LIGHTMAP_BUFFER_SIZE = 100 * 1024 * 4;
const NUM_BUFFERS = RANGE * RANGE * 9;
const TEXTURE_SIZE = 512;
const SIDES = ['left', 'right'];

const dataSymbol = Symbol();

class Objects {
  mount() {
    const {three, pose, input, elements, render, world, teleport, utils: {js: {mod, bffr, sbffr}, hash: {murmur}}} = zeo;
    const {THREE, scene, camera, renderer} = three;

    const modelViewMatrices = {
      left: new THREE.Matrix4(),
      right: new THREE.Matrix4(),
    };
    const normalMatrices = {
      left: new THREE.Matrix3(),
      right: new THREE.Matrix3(),
    };
    const modelViewMatricesValid = {
      left: false,
      right: false,
    };
    const normalMatricesValid = {
      left: false,
      right: false,
    };
    const uniformsNeedUpdate = {
      left: true,
      right: true,
    };
    function _updateModelViewMatrix(camera) {
      if (!modelViewMatricesValid[camera.name]) {
        modelViewMatrices[camera.name].multiplyMatrices(camera.matrixWorldInverse, this.matrixWorld);
        modelViewMatricesValid[camera.name] = true;
      }
      this.modelViewMatrix = modelViewMatrices[camera.name];
    }
    function _updateNormalMatrix(camera) {
      if (!normalMatricesValid[camera.name]) {
        normalMatrices[camera.name].getNormalMatrix(this.modelViewMatrix);
        normalMatricesValid[camera.name] = true;
      }
      this.normalMatrix = normalMatrices[camera.name];
    }
    function _uniformsNeedUpdate(camera, material) {
      if (uniformsNeedUpdate[camera.name]) {
        uniformsNeedUpdate[camera.name] = false;
        return true;
      } else {
        if (material.uniforms.selectedObject.value.x !== -1 || material.uniforms.selectedObject.value.y !== -1) {
          uniformsNeedUpdate[camera.name] = true;
          return true;
        } else {
          return false;
        }
      }
    }

    const _getChunkIndex = (x, z) => (mod(x, 0xFFFF) << 16) | mod(z, 0xFFFF);
    const _getObjectIndex = (x, z, i) => (mod(x, 0xFF) << 24) | (mod(z, 0xFF) << 16) | (i & 0xFFFF);

    const OBJECTS_SHADER = {
      uniforms: {
        map: {
          type: 't',
          value: null,
        },
        /* lightMap: {
          type: 't',
          value: null,
        },
        useLightMap: {
          type: 'f',
          value: 0,
        },
        d: {
          type: 'v2',
          value: new THREE.Vector2(),
        }, */
        selectedObject: {
          type: '2f',
          value: new THREE.Vector2(-1, -1),
        },
        /* sunIntensity: {
          type: 'f',
          value: 0,
        }, */
        worldTime: {
          type: 'f',
          value: 0,
        },
      },
      vertexShader: `\
precision highp float;
precision highp int;
attribute vec3 frame;
attribute float lightmap;
attribute float objectIndex;

varying vec3 vPosition;
varying vec2 vUv;
varying vec3 vFrame;
varying float vLightmap;
varying float vObjectIndex;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4( position.xyz, 1.0 );
  gl_Position = projectionMatrix * mvPosition;

  vPosition = position.xyz;
  vUv = uv;
  vFrame = frame;
  vLightmap = lightmap;
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
// uniform sampler2D lightMap;
// uniform float useLightMap;
// uniform vec2 d;
uniform vec2 selectedObject;
// uniform float sunIntensity;
uniform float worldTime;

varying vec3 vPosition;
varying vec2 vUv;
varying vec3 vFrame;
varying float vLightmap;
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

#ifdef ALPHATEST
  if ( diffuseColor.a < ALPHATEST ) discard;
#endif

  vec3 lightColor;
  if (abs(selectedObject.x - vObjectIndex) < 0.5 || abs(selectedObject.y - vObjectIndex) < 0.5) {
    diffuseColor.rgb = mix(diffuseColor.rgb, blueColor, 0.5);
    lightColor = vec3(1.0);
  } else {
    lightColor = vec3(floor(vLightmap * 4.0 + 0.5) / 4.0);
    /* vec3 lightColor;
    if (useLightMap > 0.0) {
      float u = (
        floor(clamp(vPosition.x - d.x, 0.0, ${(NUM_CELLS).toFixed(8)})) +
        (floor(clamp(vPosition.z - d.y, 0.0, ${(NUM_CELLS).toFixed(8)})) * ${(NUM_CELLS + 1).toFixed(8)}) +
        0.5
      ) / (${(NUM_CELLS + 1).toFixed(8)} * ${(NUM_CELLS + 1).toFixed(8)});
      float v = (floor(vPosition.y) + 0.5) / ${NUM_CELLS_HEIGHT.toFixed(8)};
      lightColor = texture2D( lightMap, vec2(u, v) ).rgb;
    } else {
      lightColor = vec3(sunIntensity);
    } */
  }

  vec3 outgoingLight = diffuseColor.rgb * (0.1 + lightColor * 0.9);

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
    const localArray16 = Array(16);
    const localArray162 = Array(16);
    const localMessage = {
      type: '',
      id: 0,
      args: null,
    };
    const localGenerateMessageArgs = {
      x: 0,
      z: 0,
      index: 0,
      numPositions: 0,
      numObjectIndices: 0,
      numIndices: 0,
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

    const uniforms = THREE.UniformsUtils.clone(OBJECTS_SHADER.uniforms);
    uniforms.map.value = textureAtlas;
    // uniforms.d.value.set(x * NUM_CELLS, z * NUM_CELLS);
    const objectsMaterial = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: OBJECTS_SHADER.vertexShader,
      fragmentShader: OBJECTS_SHADER.fragmentShader,
      side: THREE.DoubleSide,
    });
    objectsMaterial.objectsMaterial = _uniformsNeedUpdate;

    const worker = new Worker('archae/plugins/_plugins_objects/build/worker.js');
    let generateBuffer = new ArrayBuffer(NUM_POSITIONS_CHUNK);
    let lightmapBuffer = new Uint8Array(LIGHTMAP_BUFFER_SIZE * NUM_BUFFERS);
    let cullBuffer = new ArrayBuffer(4096);
    let queues = {};
    let numRemovedQueues = 0;
    const _cleanupQueues = () => {
      if (++numRemovedQueues >= 16) {
        const newQueues = {};
        for (const id in queues) {
          const entry = queues[id];
          if (entry !== null) {
            newQueues[id] = entry;
          }
        }
        queues = newQueues;
        numRemovedQueues = 0;
      }
    };
    worker.requestRegisterGeometry = (name, fn) => {
      const {args, src} = _parseFunction(fn);
      worker.postMessage({
        type: 'registerGeometry',
        name,
        args,
        src,
      });
    };
    worker.requestRegisterTexture = (name, uv) => {
      worker.postMessage({
        type: 'registerTexture',
        name,
        uv,
      });
    };
    worker.requestRegisterObject = (n, added, removed, updated) => {
      worker.postMessage({
        type: 'registerObject',
        n,
        added,
        removed,
        updated,
      });
    };
    worker.requestUnregisterObject = (n, added, removed, updated) => {
      worker.postMessage({
        type: 'unregisterObject',
        n,
        added,
        removed,
        updated,
      });
    };
    worker.requestAddObject = (name, position, rotation, value) => {
      worker.postMessage({
        type: 'addObject',
        name,
        position,
        rotation,
        value,
      });
    };
    worker.requestRemoveObject = (x, z, index) => {
      worker.postMessage({
        type: 'removeObject',
        x,
        z,
        index,
      });
    };
    worker.requestSetObjectData = (x, z, index, value) => {
      worker.postMessage({
        type: 'setObjectData',
        x,
        z,
        index,
        value,
      });
    };
    worker.requestGenerate = (x, z, index, numPositions, numObjectIndices, numIndices, cb) => {
      localMessage.type = 'generate';
      const id = _makeId();
      localMessage.id = id;
      localGenerateMessageArgs.x = x;
      localGenerateMessageArgs.z = z;
      localGenerateMessageArgs.index = index;
      localGenerateMessageArgs.numPositions = numPositions;
      localGenerateMessageArgs.numObjectIndices = numObjectIndices;
      localGenerateMessageArgs.numIndices = numIndices;
      localGenerateMessageArgs.buffer = generateBuffer;
      localMessage.args = localGenerateMessageArgs;

      worker.postMessage(localMessage, [generateBuffer]);
      queues[id] = newGenerateBuffer => {
        generateBuffer = newGenerateBuffer;

        cb(newGenerateBuffer);
      };
    };
    worker.requestUngenerate = (x, z) => {
      localMessage.type = 'ungenerate';
      const id = _makeId();
      localMessage.id = id;
      localUngenerateMessageArgs.x = x;
      localUngenerateMessageArgs.z = z;
      localMessage.args = localUngenerateMessageArgs;

      worker.postMessage(localMessage);
    };
    worker.requestLightmaps = (lightmapBuffer, cb) => {
      const id = _makeId();
      worker.postMessage({
        type: 'lightmaps',
        id,
        args: {
          lightmapBuffer,
        },
      }, [lightmapBuffer.buffer]);
      queues[id] = cb;
    };
    worker.requestCull = (hmdPosition, projectionMatrix, matrixWorldInverse, cb) => {
      const id = _makeId();
      worker.postMessage({
        type: 'cull',
        id,
        args: {
          hmdPosition: hmdPosition.toArray(localArray3),
          projectionMatrix: projectionMatrix.toArray(localArray16),
          matrixWorldInverse: matrixWorldInverse.toArray(localArray162),
          buffer: cullBuffer,
        },
      }, [cullBuffer]);
      cullBuffer = null;

      queues[id] = buffer => {
        cullBuffer = buffer;
        cb(buffer);
      };
    };
    worker.getHoveredObjects = cb => {
      const id = _makeId();
      const {gamepads} = pose.getStatus();

      worker.postMessage({
        type: 'getHoveredObjects',
        id,
        args: [
          gamepads.left.worldPosition.toArray(),
          gamepads.right.worldPosition.toArray(),
        ],
      });
      queues[id] = cb;
    };
    worker.getTeleportObject = (position, cb) => {
      localMessage.type = 'getTeleportObject';
      const id = _makeId();
      localMessage.id = id;
      localMessage.args = position.toArray(localArray3);

      worker.postMessage(localMessage);
      queues[id] = cb;
    };
    worker.getBodyObject = (position, cb) => {
      localMessage.type = 'getBodyObject';
      const id = _makeId();
      localMessage.id = id;
      localMessage.args = position.toArray(localArray3);

      worker.postMessage(localMessage);
      queues[id] = cb;
    };
    worker.requestResponse = (id, result, transfers) => {
      worker.postMessage({
        type: 'response',
        id,
        result,
      }, transfers);
    };
    worker.onmessage = e => {
      const {data} = e;
      const {type, args} = data;

      if (type === 'response') {
        const [id] = args;
        const {result} = data;

        queues[id](result);
        queues[id] = null;

        _cleanupQueues();
      } else if (type === 'request') {
        const [id] = args;
        const {lightmapBuffer} = data;

        if (lightmapper) {
          lightmapper.requestRender(lightmapBuffer, lightmapBuffer => {
            worker.requestResponse(id, lightmapBuffer, [lightmapBuffer.buffer]);
          });
        } else {
          const lightmapArray = new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset);
          const numLightmaps = lightmapArray;
          for (let i = 0; i < numLightmaps; i++) {
            lightmapArray[i] = 0;
          }
        }
      } else if (type === 'chunkUpdate') {
        const [x, z] = args;
        _refreshChunk(x, z);
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
    };

    const _requestObjectsGenerate = (x, z, index, numPositions, numObjectIndices, numIndices, cb) => {
      worker.requestGenerate(x, z, index, numPositions, numObjectIndices, numIndices, objectsChunkBuffer => {
        cb(protocolUtils.parseGeometry(objectsChunkBuffer));
      });
    };
    const _makeObjectsChunkMesh = (chunk, gbuffer, objectsChunkData) => {
      const {x, z} = chunk;
      const {positions: newPositions, uvs: newUvs, frames: newFrames, lightmaps: newLightmaps, objectIndices: newObjectIndices, indices: newIndices} = objectsChunkData;

      // geometry

      const {index, slices: {positions, uvs, frames, lightmaps, objectIndices, indices}} = gbuffer;

      if (newPositions.length > 0) {
        positions.set(newPositions);
        renderer.updateAttribute(objectsObject.geometry.attributes.position, index * positions.length, newPositions.length, false);

        uvs.set(newUvs);
        renderer.updateAttribute(objectsObject.geometry.attributes.uv, index * uvs.length, newUvs.length, false);

        frames.set(newFrames);
        renderer.updateAttribute(objectsObject.geometry.attributes.frame, index * frames.length, newFrames.length, false);

        lightmaps.set(newLightmaps);
        renderer.updateAttribute(objectsObject.geometry.attributes.lightmap, index * lightmaps.length, newLightmaps.length, false);

        objectIndices.set(newObjectIndices);
        renderer.updateAttribute(objectsObject.geometry.attributes.objectIndex, index * objectIndices.length, newObjectIndices.length, false);

        indices.set(newIndices);
        renderer.updateAttribute(objectsObject.geometry.index, index * indices.length, newIndices.length, true);
      }

      // material

      const material = objectsMaterial;

      // mesh

      const mesh = {
        // material,
        renderListEntry: {
          object: objectsObject,
          material,
          groups: [],
        },
        index,
        indexOffset: index * indices.length,
        offset: new THREE.Vector2(x, z),
        lightmaps,
        lightmap: null,
        destroy: () => {
          geometryBuffer.free(gbuffer);

          material.dispose();

          if (mesh.lightmap) {
            // _unbindLightmap(mesh);
          }
        },
      };
      if (lightmapper && chunk.lod === 1) {
        // _bindLightmap(mesh);
      }

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

      fromArray(buffer, byteOffset) {
        const uint32Array = new Uint32Array(buffer, byteOffset, 8);
        this.n = uint32Array[0];

        const int32Array = new Int32Array(buffer, byteOffset, 8);
        this.x = int32Array[1];
        this.z = int32Array[2];
        this.objectIndex = uint32Array[3];

        const float32Array = new Float32Array(buffer, byteOffset, 8);
        this.position.x = float32Array[4];
        this.position.y = float32Array[5];
        this.position.z = float32Array[6];

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

      // _bindLightmaps();
    };
    const _unbindLightmapper = () => {
      // _unbindLightmaps();

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
      objectChunkMesh.material.uniforms.lightMap.value = lightmap.texture;
      objectChunkMesh.material.uniforms.useLightMap.value = 1;
      objectChunkMesh.lightmap = lightmap;
    };
    const _unbindLightmap = objectChunkMesh => {
      const {lightmap} = objectChunkMesh;
      lightmapper.releaseLightmap(lightmap);
      objectChunkMesh.material.uniforms.lightMap.value = null;
      objectChunkMesh.material.uniforms.useLightMap.value = 0;
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
        worker.requestRegisterGeometry(name, fn);
        return Promise.resolve();
      }

      registerTexture(name, img) {
        const rect = textures.pack(img.width, img.height);
        const uv = textures.uv(rect);
        worker.requestRegisterTexture(name, uv);

        return createImageBitmap(img, 0, 0, img.width, img.height, {
          // imageOrientation: 'flipY',
        })
          .then(imageBitmap => {
            ctx.drawImage(imageBitmap, rect.x, rect.y);
            textureAtlas.needsUpdate = true;
          });
      }

      addObject(name, position = zeroVector, rotation = zeroQuaternion, value = 0) {
        worker.requestAddObject(name, position.toArray(), rotation.toArray(), value);

        _refreshChunk(Math.floor(position.x / NUM_CELLS), Math.floor(position.z / NUM_CELLS));
      }

      removeObject(x, z, objectIndex) {
        worker.requestRemoveObject(x, z, objectIndex);

        _refreshChunk(x, z);
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

    const objectsChunkMeshes = {};

    const geometryBuffer = sbffr(
      NUM_POSITIONS_CHUNK,
      RANGE * 2 * RANGE * 2 + RANGE * 2,
      [
        {
          name: 'positions',
          constructor: Float32Array,
          size: 3 * 3 * 4,
        },
        {
          name: 'uvs',
          constructor: Float32Array,
          size: 2 * 3 * 4,
        },
        {
          name: 'frames',
          constructor: Float32Array,
          size: 3 * 3 * 4,
        },
        {
          name: 'lightmaps',
          constructor: Uint8Array,
          size: 3 * 1,
        },
        {
          name: 'objectIndices',
          constructor: Float32Array,
          size: 3 * 4,
        },
        {
          name: 'indices',
          constructor: Uint32Array,
          size: 3 * 4,
        }
      ]
    );
    const objectsObject = (() => {
      const {positions, uvs, frames, lightmaps, objectIndices, indices} = geometryBuffer.getAll();

      const geometry = new THREE.BufferGeometry();
      const positionAttribute = new THREE.BufferAttribute(positions, 3);
      positionAttribute.dynamic = true;
      geometry.addAttribute('position', positionAttribute);
      const uvAttribute = new THREE.BufferAttribute(uvs, 2);
      uvAttribute.dynamic = true;
      geometry.addAttribute('uv', uvAttribute);
      const frameAttribute = new THREE.BufferAttribute(frames, 3);
      frameAttribute.dynamic = true;
      geometry.addAttribute('frame', frameAttribute);
      const lightmapAttribute = new THREE.BufferAttribute(lightmaps, 1, true);
      lightmapAttribute.dynamic = true;
      geometry.addAttribute('lightmap', lightmapAttribute);
      const objectIndexAttribute = new THREE.BufferAttribute(objectIndices, 1);
      objectIndexAttribute.dynamic = true;
      geometry.addAttribute('objectIndex', objectIndexAttribute);
      const indexAttribute = new THREE.BufferAttribute(indices, 1);
      indexAttribute.dynamic = true;
      geometry.setIndex(indexAttribute);

      const mesh = new THREE.Mesh(geometry, null);
      mesh.frustumCulled = false;
      mesh.updateModelViewMatrix = _updateModelViewMatrix;
      mesh.updateNormalMatrix = _updateNormalMatrix;
      mesh.renderList = [];
      return mesh;
    })();
    scene.add(objectsObject);

    let running = false;
    const queue = [];
    const _next = () => {
      running = false;

      if (queue.length > 0) {
        _addChunk(queue.shift());
      }
    };
    const _addChunk = chunk => {
      if (!running) {
        running = true;

        const {x, z} = chunk;
        const gbuffer = geometryBuffer.alloc();
        _requestObjectsGenerate(x, z, gbuffer.index, gbuffer.slices.positions.length, gbuffer.slices.objectIndices.length, gbuffer.slices.indices.length, objectsChunkData => {
          const index = _getChunkIndex(x, z);

          const {[dataSymbol]: oldObjectsChunkMesh} = chunk;
          if (oldObjectsChunkMesh) {
            // scene.remove(oldObjectsChunkMesh);
            objectsObject.renderList.splice(objectsObject.renderList.indexOf(oldObjectsChunkMesh.renderListEntry), 1);

            oldObjectsChunkMesh.destroy();

            objectsChunkMeshes[index] = null;
          }

          const newObjectsChunkMesh = _makeObjectsChunkMesh(chunk, gbuffer, objectsChunkData);
          objectsObject.renderList.push(newObjectsChunkMesh.renderListEntry);
          // scene.add(newObjectsChunkMesh);

          objectsChunkMeshes[index] = newObjectsChunkMesh;

          chunk[dataSymbol] = newObjectsChunkMesh;

          _next();
        });
      } else {
        queue.push(chunk);
      }
    };
    const _removeChunk = chunk => {
      const {x, z} = chunk;
      worker.requestUngenerate(x, z);

      const {[dataSymbol]: objectsChunkMesh} = chunk;
      objectsObject.renderList.splice(objectsObject.renderList.indexOf(objectsChunkMesh.renderListEntry), 1);

      objectsChunkMesh.destroy();

      objectsChunkMeshes[_getChunkIndex(x, z)] = null;
    };
    const _refreshChunk = (x, z) => {
      const heightfieldElement = elements.getEntitiesElement().querySelector(HEIGHTFIELD_PLUGIN);

      if (heightfieldElement) {
        const chunk = heightfieldElement.getChunk(x, z);

        if (chunk) {
          _addChunk(chunk);
        }
      }
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
            worker.getHoveredObjects(hoveredTrackedObjectSpecs => {
              objectsMaterial.uniforms.selectedObject.value.set(-1, -1);

              for (let i = 0; i < SIDES.length; i++) {
                const side = SIDES[i];
                const baseIndex = i * 8;
                if (hoveredTrackedObjectSpecs[baseIndex] !== 0) {
                  const hoveredTrackedObject = hoveredTrackedObjects[side];
                  hoveredTrackedObject.fromArray(hoveredTrackedObjectSpecs.buffer, hoveredTrackedObjectSpecs.byteOffset + baseIndex * 4);

                  const objectsChunkMesh = objectsChunkMeshes[_getChunkIndex(hoveredTrackedObject.x, hoveredTrackedObject.z)];
                  if (objectsChunkMesh) {
                    objectsMaterial.uniforms.selectedObject.value[side === 'left' ? 'x' : 'y'] = hoveredTrackedObject.objectIndex;
                  }
                } else {
                  hoveredTrackedObjects[side].clear();
                }
              }

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
                worker.getTeleportObject(teleportPosition, teleportObjectSpec => {
                  const teleportPosition = teleportPositions[side];

                  if (teleportPosition && teleportObjectSpec) {
                    let offset = 0;
                    teleportSpec.box.min.x = teleportObjectSpec[0];
                    teleportSpec.box.min.y = teleportObjectSpec[1];
                    teleportSpec.box.min.z = teleportObjectSpec[2];
                    teleportSpec.box.max.x = teleportObjectSpec[3];
                    teleportSpec.box.max.y = teleportObjectSpec[4];
                    teleportSpec.box.max.z = teleportObjectSpec[5];
                    teleportSpec.position.x = teleportObjectSpec[6];
                    teleportSpec.position.y = teleportObjectSpec[7];
                    teleportSpec.position.z = teleportObjectSpec[8];
                    teleportSpec.rotation.x = teleportObjectSpec[9];
                    teleportSpec.rotation.y = teleportObjectSpec[10];
                    teleportSpec.rotation.z = teleportObjectSpec[11];
                    teleportSpec.rotation.w = teleportObjectSpec[12];
                    teleportSpec.rotationInverse.x = teleportObjectSpec[13];
                    teleportSpec.rotationInverse.y = teleportObjectSpec[14];
                    teleportSpec.rotationInverse.z = teleportObjectSpec[15];
                    teleportSpec.rotationInverse.w = teleportObjectSpec[16];
                  } else {
                    _clear();
                  }

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
            worker.getBodyObject(hmdPosition, bodyObjectSpec => {
              if (bodyObjectSpec[0] !== 0) {
                const uint32Array = bodyObjectSpec;
                const n = uint32Array[0];

                const int32Array = new Int32Array(bodyObjectSpec.buffer, bodyObjectSpec.byteOffset, 4);
                const x = int32Array[1];
                const z = int32Array[2];
                const objectIndex = uint32Array[3];

                const objectApi = objectApis[n];
                if (objectApi && objectApi.collideCallback) {
                  objectApi.collideCallback(_getObjectIndex(x, z, objectIndex), x, z, objectIndex);
                }
              }

              updatingBody = false;
              lastBodyUpdateTime = Date.now();
            });

            updatingBody = true;
          }
        }
      };
      const _updateMaterial = () => {
        objectsMaterial.uniforms.worldTime.value = world.getWorldTime();
      };
      const _updateMatrices = () => {
        modelViewMatricesValid.left = false;
        modelViewMatricesValid.right = false;
        normalMatricesValid.left = false;
        normalMatricesValid.right = false;
        uniformsNeedUpdate.left = true;
        uniformsNeedUpdate.right = true;
      };

      _updateHoveredTrackedObjects();
      _updateTeleport();
      _updateBody();
      _updateMaterial();
      _updateMatrices();
    };
    render.on('update', _update);

    cleanups.push(() => {
      scene.remove(objectsObject);

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
        const _debouncedRefreshLightmaps = _debounce(next => {
          (() => {
            let wordOffset = 0;
            const uint32Array = new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset);
            const int32Array = new Int32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset);
            wordOffset++;

            let numLightmaps = 0;
            for (const index in objectsChunkMeshes) {
              const trackedObjectChunkMeshes = objectsChunkMeshes[index];

              if (trackedObjectChunkMeshes) {
                 const {offset: {x, y}} = trackedObjectChunkMeshes;

                int32Array[wordOffset + 0] = x;
                int32Array[wordOffset + 1] = y;
                wordOffset += 2;

                numLightmaps++;
              }
            }
            uint32Array[0] = numLightmaps;
          })();

          worker.requestLightmaps(lightmapBuffer, newLightmapBuffer => {
            const uint32Array = new Uint32Array(newLightmapBuffer.buffer, newLightmapBuffer.byteOffset);
            const int32Array = new Int32Array(newLightmapBuffer.buffer, newLightmapBuffer.byteOffset);

            let byteOffset = 0;
            const numLightmaps = uint32Array[byteOffset / 4];
            byteOffset += 4;

            for (let i = 0; i < numLightmaps; i++) {
              const x = int32Array[byteOffset / 4];
              byteOffset += 4;
              const z = int32Array[byteOffset / 4];
              byteOffset += 4;

              const lightmapsLength = uint32Array[byteOffset / 4];
              byteOffset += 4;

              const newLightmaps = new Uint8Array(newLightmapBuffer.buffer, newLightmapBuffer.byteOffset + byteOffset, lightmapsLength);
              byteOffset += lightmapsLength;
              const alignDiff = byteOffset % 4;
              if (alignDiff > 0) {
                byteOffset += 4 - alignDiff;
              }

              if (newLightmaps.length > 0) {
                const trackedObjectChunkMeshes = objectsChunkMeshes[_getChunkIndex(x, z)];

                if (trackedObjectChunkMeshes) {
                  const {index, lightmaps} = trackedObjectChunkMeshes;
                  lightmaps.set(newLightmaps);
                  renderer.updateAttribute(objectsObject.geometry.attributes.lightmap, index * lightmaps.length, newLightmaps.length, false);
                }
              }
            }

            lightmapBuffer = newLightmapBuffer;

            next();
          });
        });

        const _requestCull = (hmdPosition, projectionMatrix, matrixWorldInverse, cb) => {
          worker.requestCull(hmdPosition, projectionMatrix, matrixWorldInverse, cullBuffer => {
            cb(protocolUtils.parseCull(cullBuffer));
          });
        };
        const _debouncedRefreshCull = _debounce(next => {
          const {hmd} = pose.getStatus();
          const {worldPosition: hmdPosition} = hmd;
          const {projectionMatrix, matrixWorldInverse} = camera;
          _requestCull(hmdPosition, projectionMatrix, matrixWorldInverse, culls => {
            for (let i = 0; i < culls.length; i++) {
              const {index, groups} = culls[i];

              const trackedObjectChunkMeshes = objectsChunkMeshes[index];
              if (trackedObjectChunkMeshes) {
                /* for (let j = 0; j < groups.length; j++) {
                  groups[j].start += trackedObjectChunkMeshes.indexOffset; // XXX do this reindexing in the worker
                } */
                trackedObjectChunkMeshes.renderListEntry.groups = groups;
              }
            }

            next();
          });
        });

        const heightfieldListener = elements.makeListener(HEIGHTFIELD_PLUGIN);
        heightfieldListener.on('add', heightfieldElement => {
          heightfieldElement.registerListener((event, chunk) => {
            if (event === 'add') {
              _addChunk(chunk);
            } else if (event === 'remove') {
              _removeChunk(chunk);
            }
          });
        });

        let refreshLightmapsTimeout = null;
        const _recurseRefreshLightmaps = () => {
          _debouncedRefreshLightmaps();
          refreshLightmapsTimeout = setTimeout(_recurseRefreshLightmaps, 1000 / 10);
        };
        _recurseRefreshLightmaps();
        let refreshCullTimeout = null;
        const _recurseRefreshCull = () => {
          _debouncedRefreshCull();
          refreshCullTimeout = setTimeout(_recurseRefreshCull, 1000 / 30);
        };
        _recurseRefreshCull();

        cleanups.push(() => {
          elements.destroyListener(heightfieldListener);

          clearTimeout(refreshLightmapsTimeout);
          clearTimeout(refreshCullTimeout);
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
const _debounce = fn => {
  let running = false;
  let queued = false;

  const _go = () => {
    if (!running) {
      running = true;

      fn(() => {
        running = false;

        if (queued) {
          queued = false;

          _go();
        }
      });
    } else {
      queued = true;
    }
  };
  return _go;
};
const _parseFunction = fn => {
  const match = fn.toString().match(/[^\(]*\(([^\)]*)\)[^\{]*\{([\s\S]*)\}\s*$/); // XXX support bracketless arrow functions
  const args = match[1].split(',').map(arg => arg.trim());
  const src = match[2];
  return {args, src};
};

module.exports = Objects;
