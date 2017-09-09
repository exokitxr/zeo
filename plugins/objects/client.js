const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
// const LIGHTMAP_PLUGIN = 'plugins-lightmap';
const DAY_NIGHT_SKYBOX_PLUGIN = 'plugins-day-night-skybox';
const CRAFT_PLUGIN = 'plugins-craft';

const {
  NUM_CELLS,
  NUM_CELLS_HEIGHT,

  RANGE,

  TEXTURE_SIZE,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');
const objectsLib = require('./lib/objects/client/index');

const NUM_POSITIONS_CHUNK = 1.25 * 1024 * 1024;
// const LIGHTMAP_BUFFER_SIZE = 100 * 1024 * 4;
// const NUM_BUFFERS = RANGE * RANGE + RANGE;
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
    const _getObjectId = (x, z, i) => (mod(x, 0xFF) << 24) | (mod(z, 0xFF) << 16) | (i & 0xFFFF);

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
        selectedBlockLeft: {
          type: '3f',
          value: new THREE.Vector3(-1, -1, -1),
        },
        selectedBlockRight: {
          type: '3f',
          value: new THREE.Vector3(-1, -1, -1),
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
attribute float ssao;
attribute vec3 frame;
attribute float skyLightmap;
attribute float torchLightmap;
attribute float objectIndex;

varying vec3 vPosition;
varying vec2 vUv;
varying float vSsao;
varying vec3 vViewPosition;
varying vec3 vFrame;
varying float vSkyLightmap;
varying float vTorchLightmap;
varying float vObjectIndex;
varying float vTiled;
varying vec2 vTileOffset;
varying vec2 vTileSize;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4( position.xyz, 1.0 );
  gl_Position = projectionMatrix * mvPosition;

  vPosition = position.xyz;
  vUv = uv;
  vSsao = ssao;
  vViewPosition = mvPosition.xyz;
  vFrame = frame;
  vSkyLightmap = skyLightmap;
  vTorchLightmap = torchLightmap;
  vObjectIndex = objectIndex;

  if (vUv.x < 0.0) {
    vec2 uv = vec2(vUv.x * -1.0, vUv.y);
    vTiled = 1.0;
    vTileOffset = fract(uv);
    vTileSize = floor(uv) / ${TEXTURE_SIZE.toFixed(1)};
  } else {
    vTiled = 0.0;
  }
}
      `,
      fragmentShader: `\
precision highp float;
precision highp int;
#define DOUBLE_SIDED
uniform vec3 ambientLightColor;
uniform sampler2D map;
// uniform sampler2D lightMap;
// uniform float useLightMap;
// uniform vec2 d;
uniform vec2 selectedObject;
uniform vec3 selectedBlockLeft;
uniform vec3 selectedBlockRight;
uniform float sunIntensity;
uniform float worldTime;

varying vec3 vPosition;
varying vec2 vUv;
varying float vSsao;
varying vec3 vViewPosition;
varying vec3 vFrame;
varying float vSkyLightmap;
varying float vTorchLightmap;
varying float vObjectIndex;
varying float vTiled;
varying vec2 vTileOffset;
varying vec2 vTileSize;

float speed = 1.0;
vec3 blueColor = vec3(0.12941176470588237, 0.5882352941176471, 0.9529411764705882);

vec4 fourTapSample(
  vec2 tileOffset,
  vec2 tileUV,
  vec2 tileSize,
  sampler2D atlas
) {
  //Initialize accumulators
  vec4 color = vec4(0.0, 0.0, 0.0, 0.0);
  float totalWeight = 0.0;

  for(int dx=0; dx<2; ++dx)
  for(int dy=0; dy<2; ++dy) {
    //Compute coordinate in 2x2 tile patch
    vec2 tileCoord = 2.0 * fract(0.5 * (tileUV + vec2(dx,dy)));

    //Weight sample based on distance to center
    float w = pow(1.0 - max(abs(tileCoord.x-1.0), abs(tileCoord.y-1.0)), 16.0);

    //Compute atlas coord
    vec2 atlasUV = tileOffset + tileSize * tileCoord;
    atlasUV.y = 1.0 - atlasUV.y;

    //Sample and accumulate
    color += w * texture2D(atlas, atlasUV);
    totalWeight += w;
  }

  //Return weighted color
  return color / totalWeight;
}

vec2 animateUv(vec2 uv, vec3 frame, float worldTime) {
  if (frame.z > 0.0) {
    float animationFactor = mod(worldTime, 1000.0) / 1000.0;
    // float animationFactor = (speed - abs(mod(worldTime / 1000.0, speed*2.0) - speed)) / speed;
    float frameIndex = floor(animationFactor * frame.z);
    uv.y = 1.0 - (((1.0 - uv.y) - frame.x) / frame.z + frame.x + frameIndex * frame.y);
  }
  return uv;
}

void main() {
  vec4 diffuseColor;
  if (vTiled > 0.0) {
    vec3 fdx = dFdx(vPosition);
    vec3 fdy = dFdy(vPosition);
    vec3 normal = floor(normalize( cross( fdx, fdy ) ) + 0.5);

    vec2 tileUv = fract(vec2(dot(normal.zxy, vPosition), dot(normal.yzx, vPosition)));
    // back and bottom: flip 180',
    if (normal.z < 0.0 || normal.y < 0.0) tileUv.t = 1.0 - tileUv.t;
    // left: rotate 90 cw
    if (normal.x < 0.0) {
        float r = tileUv.s;
        tileUv.s = 1.0 - tileUv.t;
        tileUv.t = r;
    }
    // right and top and bottom: rotate 90 ccw
    if (normal.x > 0.0 || normal.y != 0.0) {
        float r = tileUv.s;
        tileUv.s = 1.0 - tileUv.t;
        tileUv.t = 1.0 - r;
    }
    // front and back and bottom: flip 180', // TODO: make top and bottom consistent (pointing north?)
    if (normal.z > 0.0 || normal.z < 0.0 || normal.y < 0.0) {
      tileUv.t = 1.0 - tileUv.t;
    }

    diffuseColor = fourTapSample(
      animateUv(vTileOffset, vFrame, worldTime),
      tileUv,
      vTileSize,
      map
    );
  } else {
    diffuseColor = texture2D(map, animateUv(vUv, vFrame, worldTime));
  }

  if ( diffuseColor.a < 0.5 ) {
    discard;
  }

  vec3 lightColor;
  if (
    abs(selectedObject.x - vObjectIndex) < 0.5 || abs(selectedObject.y - vObjectIndex) < 0.5 ||
    (
      vPosition.x > (selectedBlockLeft.x - 0.0001) && vPosition.x < (selectedBlockLeft.x + 1.0001) &&
      vPosition.y > (selectedBlockLeft.y - 0.0001) && vPosition.y < (selectedBlockLeft.y + 1.0001) &&
      vPosition.z > (selectedBlockLeft.z - 0.0001) && vPosition.z < (selectedBlockLeft.z + 1.0001)
    ) ||
    (
      vPosition.x > (selectedBlockRight.x - 0.0001) && vPosition.x < (selectedBlockRight.x + 1.0001) &&
      vPosition.y > (selectedBlockRight.y - 0.0001) && vPosition.y < (selectedBlockRight.y + 1.0001) &&
      vPosition.z > (selectedBlockRight.z - 0.0001) && vPosition.z < (selectedBlockRight.z + 1.0001)
    )
  ) {
    diffuseColor.rgb = mix(diffuseColor.rgb, blueColor, 0.5);
    lightColor = vec3(1.0);
  } else {
    lightColor = vec3(floor(
      (
        min((vSkyLightmap * sunIntensity) + vTorchLightmap, 1.0)
      ) * 4.0 + 0.5) / 4.0
    );
  }

  lightColor.rgb *= (1.0 - (vSsao * 255.0 / 3.0));

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
    const localUpdateMessageArgs = {
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

    const textureAtlas = new THREE.Texture(
      null,
      THREE.UVMapping,
      THREE.ClampToEdgeWrapping,
      THREE.ClampToEdgeWrapping,
      THREE.NearestFilter,
      THREE.LinearMipMapLinearFilter,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
      1
    );

    const uniforms = THREE.UniformsUtils.clone(OBJECTS_SHADER.uniforms);
    uniforms.map.value = textureAtlas;
    const objectsMaterial = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: OBJECTS_SHADER.vertexShader,
      fragmentShader: OBJECTS_SHADER.fragmentShader,
      // side: THREE.DoubleSide,
      extensions: {
        derivatives: true,
      },
    });
    objectsMaterial.uniformsNeedUpdate = _uniformsNeedUpdate;

    const worker = new Worker('archae/plugins/_plugins_objects/build/worker.js');
    let generateBuffer = new ArrayBuffer(NUM_POSITIONS_CHUNK);
    // let lightmapBuffer = new Uint8Array(LIGHTMAP_BUFFER_SIZE * NUM_BUFFERS);
    let cullBuffer = new ArrayBuffer(100 * 1024);
    let hoveredObjectsBuffer = new ArrayBuffer(11 * 2 * 4);
    const teleportObjectBuffers = {
      left: new ArrayBuffer((1 + 3 + 3 + 3 + 4 + 4) * 4),
      right: new ArrayBuffer((1 + 3 + 3 + 3 + 4 + 4) * 4),
    };
    let bodyObjectBuffer = new ArrayBuffer(4 * 4);
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
    worker.requestUpdate = (x, z, cb) => {
      localMessage.type = 'update';
      const id = _makeId();
      localMessage.id = id;
      localUpdateMessageArgs.x = x;
      localUpdateMessageArgs.z = z;
      localUpdateMessageArgs.buffer = generateBuffer;
      localMessage.args = localUpdateMessageArgs;

      worker.postMessage(localMessage, [generateBuffer]);
      queues[id] = newGenerateBuffer => {
        generateBuffer = newGenerateBuffer;

        cb(newGenerateBuffer);
      };
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

      const float32Array = new Float32Array(hoveredObjectsBuffer, 0, 6);
      float32Array[0] = gamepads.left.worldPosition.x;
      float32Array[1] = gamepads.left.worldPosition.y;
      float32Array[2] = gamepads.left.worldPosition.z;
      float32Array[3] = gamepads.right.worldPosition.x;
      float32Array[4] = gamepads.right.worldPosition.y;
      float32Array[5] = gamepads.right.worldPosition.z;

      worker.postMessage({
        type: 'getHoveredObjects',
        id,
        args: {
          buffer: hoveredObjectsBuffer,
        },
      }, [hoveredObjectsBuffer]);
      queues[id] = newHoveredObjectsBuffer => {
        hoveredObjectsBuffer = newHoveredObjectsBuffer;

        cb(newHoveredObjectsBuffer);
      };
    };
    worker.getTeleportObject = (position, side, cb) => {
      const id = _makeId();

      const teleportObjectBuffer = teleportObjectBuffers[side];
      const float32Array = new Float32Array(teleportObjectBuffer, 0, 3);
      float32Array[0] = position.x;
      float32Array[1] = position.y;
      float32Array[2] = position.z;

      worker.postMessage({
        type: 'getTeleportObject',
        id,
        args: {
          buffer: teleportObjectBuffer,
        },
      }, [teleportObjectBuffer]);
      queues[id] = newTeleportObjectsBuffer => {
        teleportObjectBuffers[side] = newTeleportObjectsBuffer;

        cb(newTeleportObjectsBuffer);
      };
    };
    worker.getBodyObject = (position, cb) => {
      const id = _makeId();

      const float32Array = new Float32Array(bodyObjectBuffer, 0, 3);
      float32Array[0] = position.x;
      float32Array[1] = position.y;
      float32Array[2] = position.z;

      worker.postMessage({
        type: 'getBodyObject',
        id,
        args: {
          buffer: bodyObjectBuffer,
        },
      }, [bodyObjectBuffer]);
      queues[id] = newBodyObjectBuffer => {
        bodyObjectBuffer = newBodyObjectBuffer;

        cb(newBodyObjectBuffer);
      };
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
        throw new Error('not implemented');

        /* const [id] = args;
        const {lightmapBuffer} = data;

        elements.requestElement(LIGHTMAP_PLUGIN)
          .then(lightmapElement => {
            lightmapElement.lightmapper.requestRender(lightmapBuffer, lightmapBuffer => {
              worker.requestResponse(id, lightmapBuffer, [lightmapBuffer.buffer]);
            });
          }); */
      } else if (type === 'chunkUpdate') {
        const [x, z] = args;
        _refreshChunk(x, z);
      } else if (type === 'textureAtlas') {
        const [imageBitmap] = args;
        textureAtlas.image = imageBitmap;
        textureAtlas.needsUpdate = true;
      } else if (type === 'objectAdded') {
        const [n, x, z, objectIndex, position, rotation, value] = args;

        const objectApi = objectApis[n];
        if (objectApi) {
          objectApi.addedCallback(
            _getObjectId(x, z, objectIndex),
            localVector.fromArray(position),
            localQuaternion.fromArray(rotation),
            value,
            x,
            z,
            objectIndex
          );
        }
      } else if (type === 'objectRemoved') {
        const [n, x, z, objectIndex/*, startIndex, endIndex*/] = args;

        /* if (startIndex !== -1) {
          const objectChunkMesh = objectsChunkMeshes[_getChunkIndex(x, z)];

          if (objectChunkMesh) {
            const indexAttribute = objectChunkMesh.geometry.index;
            const indices = indexAttribute.array;
            for (let i = startIndex; i < endIndex; i++) {
              indices[i] = 0;
            }
            indexAttribute.needsUpdate = true;
          }
        } */

        const objectApi = objectApis[n];
        if (objectApi) {
          objectApi.removedCallback(_getObjectId(x, z, objectIndex), x, z, objectIndex);
        }
      } else if (type === 'objectUpdated') {
        const [n, x, z, objectIndex, position, rotation, value] = args;

        const objectApi = objectApis[n];
        if (objectApi) {
          objectApi.updateCallback(_getObjectId(x, z, objectIndex), localVector.fromArray(position), localQuaternion.fromArray(rotation), value);
        }
      } else {
        console.warn('objects got unknown worker message type:', JSON.stringify(type));
      }
    };

    const _requestObjectsGenerate = (x, z, index, numPositions, numObjectIndices, numIndices, cb) => {
      worker.requestGenerate(x, z, index, numPositions, numObjectIndices, numIndices, objectsChunkBuffer => {
        cb(protocolUtils.parseWorker(objectsChunkBuffer));
      });
    };
    const _requestObjectsUpdate = (x, z, cb) => {
      worker.requestUpdate(x, z, objectsChunkBuffer => {
        cb(protocolUtils.parseWorker(objectsChunkBuffer));
      });
    };
    const _makeObjectsChunkMesh = (chunk, gbuffer) => {
      const {x, z} = chunk;

      const {index, geometry, slices: {positions, uvs, ssaos, frames, skyLightmaps, torchLightmaps, objectIndices, indices}} = gbuffer;
      const material = objectsMaterial;

      const renderListEntry = {
        object: objectsObject,
        geometry,
        material,
        groups: [],
        visible: false,
      };

      let version = 0;

      return {
        renderListEntry,
        gbuffer,
        offset: new THREE.Vector2(x, z),
        skyLightmaps,
        torchLightmaps,
        update: chunkData => {
          const {positions: newPositions, uvs: newUvs, ssaos: newSsaos, frames: newFrames, skyLightmaps: newSkyLightmaps, torchLightmaps: newTorchLightmaps, objectIndices: newObjectIndices, indices: newIndices} = chunkData;
          const heightfieldElement = elements.getEntitiesElement().querySelector(HEIGHTFIELD_PLUGIN)
          if (newPositions.length > 0 && heightfieldElement) {
            version++;

            positions.set(newPositions);
            uvs.set(newUvs);
            ssaos.set(newSsaos);
            frames.set(newFrames);
            skyLightmaps.set(newSkyLightmaps);
            torchLightmaps.set(newTorchLightmaps);
            indices.set(newIndices);
            objectIndices.set(newObjectIndices);

            const newPositionsLength = newPositions.length;
            const newUvsLength = newUvs.length;
            const newSsaosLength = newSsaos.length;
            const newFramesLength = newFrames.length;
            const newSkyLightmapsLength = newSkyLightmaps.length;
            const newTorchLightmapsLength = newTorchLightmaps.length;
            const newIndicesLength = newIndices.length;
            const newObjectIndicesLength = newObjectIndices.length;
/* x === -1 && z === -1 && (window._trigger = () => {
  // objectsObject.geometry.index.array.fill(0);
  // renderer.updateAttribute(objectsObject.geometry.index, 0, objectsObject.geometry.index.array.length, true);
  heightfieldElement.requestFrame(next => {
    const _recurse = i => {
      if (i < 100) {
        objectsObject.renderList.splice(objectsObject.renderList.indexOf(renderListEntry), 1);
        // objectsObject.visible = false;

        const gbuffer = geometries.alloc();
        const {index, slices: {positions, uvs, frames, skyLightmaps, torchLightmaps, objectIndices, indices}} = gbuffer;
        renderer.updateAttribute(objectsObject.geometry.attributes.position, index * positions.length, newPositionsLength, false);
        renderer.updateAttribute(objectsObject.geometry.attributes.uv, index * uvs.length, newUvsLength, false);
        renderer.updateAttribute(objectsObject.geometry.attributes.frame, index * frames.length, newFramesLength, false);
        renderer.updateAttribute(objectsObject.geometry.attributes.skyLightmap, index * skyLightmaps.length, newSkyLightmapsLength, false);
        renderer.updateAttribute(objectsObject.geometry.attributes.torchLightmap, index * torchLightmaps.length, newTorchLightmapsLength, false);
        renderer.updateAttribute(objectsObject.geometry.index, index * indices.length, newIndicesLength, true);
        renderer.updateAttribute(objectsObject.geometry.attributes.objectIndex, index * objectIndices.length, newObjectIndicesLength, false);
        renderer.getContext().flush();
        // renderer.getContext().finish();

        requestAnimationFrame(() => {
          objectsObject.renderList.push(renderListEntry);
          // objectsObject.visible = true;

          // objectsObject.geometry.index.array.subarray(index * indices.length, newIndicesLength).fill(0);
          // renderer.updateAttribute(objectsObject.geometry.index, index * indices.length, newIndicesLength, true);
          geometries.free(gbuffer);

          requestAnimationFrame(() => {
            _recurse(i + 1);
          });
        });
      } else {
console.log('done');
        next();
      }
    };
    _recurse(0);
  });
}); */
            const localVersion = version;
            heightfieldElement.requestFrame(next => {
              if (version === localVersion) {
                renderListEntry.visible = false;

                renderer.updateAttribute(geometry.attributes.position, index * positions.length, newPositionsLength, false);
                renderer.updateAttribute(geometry.attributes.uv, index * uvs.length, newUvsLength, false);
                renderer.updateAttribute(geometry.attributes.ssao, index * ssaos.length, newSsaosLength, false);
                renderer.updateAttribute(geometry.attributes.frame, index * frames.length, newFramesLength, false);
                renderer.updateAttribute(geometry.attributes.skyLightmap, index * skyLightmaps.length, newSkyLightmapsLength, false);
                renderer.updateAttribute(geometry.attributes.torchLightmap, index * torchLightmaps.length, newTorchLightmapsLength, false);
                renderer.updateAttribute(geometry.index, index * indices.length, newIndicesLength, true);
                renderer.updateAttribute(geometry.attributes.objectIndex, index * objectIndices.length, newObjectIndicesLength, false);
                renderer.getContext().flush();

                requestAnimationFrame(() => {
                  renderListEntry.visible = true;

                  next();
                });
              } else {
                next();
              }
            });
          }
        },
        destroy: () => {
          version++;

          geometries.free(gbuffer);
        },
      };
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
    const hoveredTrackedBlocks = {
      left: new THREE.Vector3(),
      right: new THREE.Vector3(),
    };

    const _triggerdown = e => {
      const {side} = e;
      const hoveredTrackedObjectSpec = hoveredTrackedObjects[side];

      if (hoveredTrackedObjectSpec && hoveredTrackedObjectSpec.isSet()) {
        const {n} = hoveredTrackedObjectSpec;
        const objectApi = objectApis[n];

        if (objectApi && objectApi.triggerCallback) {
          const {x, z, objectIndex} = hoveredTrackedObjectSpec;
          objectApi.triggerCallback(_getObjectId(x, z, objectIndex), side, x, z, objectIndex);
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
          objectApi.gripCallback(_getObjectId(x, z, objectIndex), side, x, z, objectIndex);
        }
      }
    };
    input.on('gripdown', _gripdown, {
      priority: -4,
    });

    const objectApis = {};

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
      hit: false,
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
      teleportPositions[e.side] = null;
    }
    teleport.on('end', _teleportEnd);
    const _teleportTarget = (position, rotation, scale, side) => {
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

      const teleportSpec = teleportSpecs[side];
      if (teleportSpec.hit) {
        const {
          box: teleportBox,
          position: teleportPosition,
          rotation: teleportRotation,
          rotationInverse: teleportRotationInverse,
        } = teleportSpec;

        localRay.origin.sub(teleportPosition)
          .applyQuaternion(teleportRotationInverse)
          // .add(teleportPosition);
        localRay.direction.set(0, -1, 0);

        const targetPosition = localRay.intersectBox(teleportBox, localVector2);
        if (targetPosition) {
          return targetPosition
            // .sub(teleportPosition)
            .applyQuaternion(teleportRotation)
            .add(teleportPosition);
        } else {
          return null;
        }
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
      }

      removeObject(x, z, objectIndex) {
        worker.requestRemoveObject(x, z, objectIndex);
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

    const NUM_GEOMETRIES = 4;
    const _makeGeometryBuffer = () => sbffr(
      NUM_POSITIONS_CHUNK,
      (RANGE * RANGE * 2 + RANGE * 2) / NUM_GEOMETRIES,
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
          name: 'ssaos',
          constructor: Uint8Array,
          size: 3 * 1,
        },
        {
          name: 'frames',
          constructor: Float32Array,
          size: 3 * 3 * 4,
        },
        {
          name: 'skyLightmaps',
          constructor: Uint8Array,
          size: 3 * 1,
        },
        {
          name: 'torchLightmaps',
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
    const geometries = (() => {
      const geometryBuffers = Array(NUM_GEOMETRIES);
      for (let i = 0; i < NUM_GEOMETRIES; i++) {
        geometryBuffers[i] = _makeGeometryBuffer();
      }

      const geometries = Array(NUM_GEOMETRIES);
      for (let i = 0; i < NUM_GEOMETRIES; i++) {
        const geometry = new THREE.BufferGeometry();

        const {positions, uvs, ssaos, frames, skyLightmaps, torchLightmaps, objectIndices, indices} = geometryBuffers[i].getAll();

        const positionAttribute = new THREE.BufferAttribute(positions, 3);
        positionAttribute.dynamic = true;
        geometry.addAttribute('position', positionAttribute);
        const uvAttribute = new THREE.BufferAttribute(uvs, 2);
        uvAttribute.dynamic = true;
        geometry.addAttribute('uv', uvAttribute);
        const ssaoAttribute = new THREE.BufferAttribute(ssaos, 1, true);
        ssaoAttribute.dynamic = true;
        geometry.addAttribute('ssao', ssaoAttribute);
        const frameAttribute = new THREE.BufferAttribute(frames, 3);
        frameAttribute.dynamic = true;
        geometry.addAttribute('frame', frameAttribute);
        const skyLightmapAttribute = new THREE.BufferAttribute(skyLightmaps, 1, true);
        skyLightmapAttribute.dynamic = true;
        geometry.addAttribute('skyLightmap', skyLightmapAttribute);
        const torchLightmapAttribute = new THREE.BufferAttribute(torchLightmaps, 1, true);
        torchLightmapAttribute.dynamic = true;
        geometry.addAttribute('torchLightmap', torchLightmapAttribute);
        const objectIndexAttribute = new THREE.BufferAttribute(objectIndices, 1);
        objectIndexAttribute.dynamic = true;
        geometry.addAttribute('objectIndex', objectIndexAttribute);
        const indexAttribute = new THREE.BufferAttribute(indices, 1);
        indexAttribute.dynamic = true;
        geometry.setIndex(indexAttribute);

        renderer.updateAttribute(geometry.attributes.position, 0, geometry.attributes.position.array.length, false);
        renderer.updateAttribute(geometry.attributes.uv, 0, geometry.attributes.uv.array.length, false);
        renderer.updateAttribute(geometry.attributes.ssao, 0, geometry.attributes.ssao.array.length, false);
        renderer.updateAttribute(geometry.attributes.frame, 0, geometry.attributes.frame.array.length, false);
        renderer.updateAttribute(geometry.attributes.skyLightmap, 0, geometry.attributes.skyLightmap.array.length, false);
        renderer.updateAttribute(geometry.attributes.torchLightmap, 0, geometry.attributes.torchLightmap.array.length, false);
        renderer.updateAttribute(geometry.index, 0, geometry.index.array.length, true);

        geometries[i] = geometry;
      }

      return {
        alloc() {
          for (let i = 0; i < geometryBuffers.length; i++) {
            const geometryBuffer = geometryBuffers[i];
            const gbuffer = geometryBuffer.alloc();
            if (gbuffer) {
              gbuffer.geometry = geometries[i];
              gbuffer.geometryBuffer = geometryBuffer;
              return gbuffer;
            }
          }
          return null;
        },
        free(gbuffer) {
          gbuffer.geometryBuffer.free(gbuffer);
        },
      };
    })();
    const objectsObject = (() => {
      const mesh = new THREE.Object3D();
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
        queue.shift()();
      }
    };
    const _addChunk = chunk => {
      if (!running) {
        running = true;

        const {x, z} = chunk;
        const index = _getChunkIndex(x, z);

        const {[dataSymbol]: oldObjectsChunkMesh} = chunk;
        if (oldObjectsChunkMesh) {
          objectsObject.renderList.splice(objectsObject.renderList.indexOf(oldObjectsChunkMesh.renderListEntry), 1);

          oldObjectsChunkMesh.destroy();
          objectsChunkMeshes[index] = null;
        }

        const gbuffer = geometries.alloc();
        _requestObjectsGenerate(x, z, gbuffer.index, gbuffer.slices.positions.length, gbuffer.slices.objectIndices.length, gbuffer.slices.indices.length, objectsChunkData => {

          const newObjectsChunkMesh = _makeObjectsChunkMesh(chunk, gbuffer);
          newObjectsChunkMesh.update(objectsChunkData);
          objectsObject.renderList.push(newObjectsChunkMesh.renderListEntry);

          objectsChunkMeshes[index] = newObjectsChunkMesh;
          chunk[dataSymbol] = newObjectsChunkMesh;

          _next();
        });
      } else {
        queue.push(_addChunk.bind(this, chunk));
      }
    };
    const _removeChunk = chunk => {
      if (!running) {
        running = true;

        const {x, z} = chunk;
        worker.requestUngenerate(x, z);

        const {[dataSymbol]: objectsChunkMesh} = chunk;
        objectsObject.renderList.splice(objectsObject.renderList.indexOf(objectsChunkMesh.renderListEntry), 1);

        objectsChunkMesh.destroy();

        objectsChunkMeshes[_getChunkIndex(x, z)] = null;

        _next();
      } else {
        queue.push(_removeChunk.bind(this, chunk));
      }
    };
    const _refreshChunk = (x, z) => {
      if (!running) {
        running = true;

        _requestObjectsUpdate(x, z, objectsChunkData => {
          const heightfieldElement = elements.getEntitiesElement().querySelector(HEIGHTFIELD_PLUGIN);
          if (heightfieldElement) {
            const chunk = heightfieldElement.getChunk(x, z);
            if (chunk) {
              const {[dataSymbol]: oldObjectsChunkMesh} = chunk;
              if (oldObjectsChunkMesh) {
                oldObjectsChunkMesh.update(objectsChunkData);
              }
            }
          }

          _next();
        });
      } else {
        queue.push(_refreshChunk.bind(this, x, z));
      }
    };

    let updatingHover = false;
    let lastHoverUpdateTime = 0;
    const updatingTeleport = {
      left: false,
      right: false,
    };
    const lastTeleportUpdateTime = {
      left: 0,
      right: 0,
    };
    let updatingBody = false;
    let lastBodyUpdateTime = 0;
    const _update = () => {
      const _updateHoveredTrackedObjects = () => {
        if (!updatingHover) {
          const now = Date.now();
          const timeDiff = now - lastHoverUpdateTime;

          if (timeDiff > 1000 / 30) {
            worker.getHoveredObjects(hoveredObjectsBuffer => {
              objectsMaterial.uniforms.selectedObject.value.set(-1, -1);
              objectsMaterial.uniforms.selectedBlockLeft.value.set(-1, -1, -1);
              objectsMaterial.uniforms.selectedBlockRight.value.set(-1, -1, -1);

              let byteOffset = 0;
              for (let i = 0; i < SIDES.length; i++) {
                const side = SIDES[i];
                if (new Uint32Array(hoveredObjectsBuffer, byteOffset, 1)[0] !== 0) {
                  const hoveredTrackedObject = hoveredTrackedObjects[side];
                  hoveredTrackedObject.fromArray(hoveredObjectsBuffer, byteOffset);

                  const objectsChunkMesh = objectsChunkMeshes[_getChunkIndex(hoveredTrackedObject.x, hoveredTrackedObject.z)];
                  if (objectsChunkMesh) {
                    objectsMaterial.uniforms.selectedObject.value[side === 'left' ? 'x' : 'y'] =
                      hoveredTrackedObject.objectIndex + objectsChunkMesh.gbuffer.index * objectsChunkMesh.gbuffer.slices.objectIndices.length;
                  }
                } else {
                  hoveredTrackedObjects[side].clear();
                }

                const hoveredTrackedBlock = hoveredTrackedBlocks[side];
                hoveredTrackedBlock.fromArray(new Float32Array(hoveredObjectsBuffer, byteOffset + 8 * 4, 3));
                objectsMaterial.uniforms[side === 'left' ? 'selectedBlockLeft' : 'selectedBlockRight'].value.copy(hoveredTrackedBlock);

                byteOffset += 11 * 4;
              }

              updatingHover = false;
              lastHoverUpdateTime = Date.now();
            });

            updatingHover = true;
          }
        }
      };
      const _updateTeleport = () => {
        for (let i = 0; i < SIDES.length; i++) {
          const side = SIDES[i];
          const teleportPosition = teleportPositions[side];
          const teleportSpec = teleportSpecs[side];

          if (teleportPosition) {
            if (!updatingTeleport[side]) {
              const now = Date.now();
              const timeDiff = now - lastTeleportUpdateTime[side];

              if (timeDiff > 1000 / 30) {
                worker.getTeleportObject(teleportPosition, side, teleportObjectBuffer => {
                  const teleportPosition = teleportPositions[side];

                  if (teleportPosition) {
                    let byteOffset = 0;
                    const hit = new Uint32Array(teleportObjectBuffer, byteOffset, 1)[0];
                    byteOffset += 4;

                    if (hit) {
                      const float32Array = new Float32Array(teleportObjectBuffer, byteOffset, 3 + 3 + 3 + 4 + 4);
                      teleportSpec.box.min.fromArray(float32Array, 0);
                      teleportSpec.box.max.fromArray(float32Array, 3);
                      teleportSpec.position.fromArray(float32Array, 6);
                      teleportSpec.rotation.fromArray(float32Array, 9);
                      teleportSpec.rotationInverse.fromArray(float32Array, 13);

                      teleportSpec.hit = true;
                    } else {
                      teleportSpec.hit = false;
                    }
                  } else {
                    teleportSpec.hit = false;
                  }

                  updatingTeleport[side] = false;
                  lastTeleportUpdateTime[side] = Date.now();
                });

                updatingTeleport[side] = true;
              }
            }
          } else {
            teleportSpec.hit = false;
          }
        }
      };
      const _updateBody = () => {
        if (!updatingBody) {
          const now = Date.now();
          const timeDiff = now - lastBodyUpdateTime;

          if (timeDiff > 1000 / 30) {
            const {hmd} = pose.getStatus();
            const {worldPosition: hmdPosition} = hmd;
            worker.getBodyObject(hmdPosition, hoveredBodyBuffer => {
              if (new Uint32Array(hoveredBodyBuffer, 0, 1)[0] !== 0) {
                const uint32Array = new Uint32Array(hoveredBodyBuffer, 0, 4);
                const int32Array = new Int32Array(hoveredBodyBuffer, 0, 4);

                const n = uint32Array[0];
                const x = int32Array[1];
                const z = int32Array[2];
                const objectIndex = uint32Array[3];

                const objectApi = objectApis[n];
                if (objectApi && objectApi.collideCallback) {
                  objectApi.collideCallback(_getObjectId(x, z, objectIndex), x, z, objectIndex);
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
        const dayNightSkyboxEntity = elements.getEntitiesElement().querySelector(DAY_NIGHT_SKYBOX_PLUGIN);
          objectsMaterial.uniforms.sunIntensity.value =
            (dayNightSkyboxEntity && dayNightSkyboxEntity.getSunIntensity) ? dayNightSkyboxEntity.getSunIntensity() : 0;

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

      // elements.destroyListener(lightmapElementListener);
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
        .map(makeObject =>
          makeObject()
            .then(cleanup => {
              cleanups.push(cleanup);
            })
        )
    )
      .then(() => {
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

        let refreshCullTimeout = null;
        const _recurseRefreshCull = () => {
          _debouncedRefreshCull();
          refreshCullTimeout = setTimeout(_recurseRefreshCull, 1000 / 30);
        };
        _recurseRefreshCull();

        cleanups.push(() => {
          elements.destroyListener(heightfieldListener);

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

module.exports = Objects;
