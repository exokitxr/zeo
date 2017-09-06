const {
  NUM_CELLS,
  NUM_CELLS_HEIGHT,

  NUM_CHUNKS_HEIGHT,
  NUM_RENDER_GROUPS,

  HEIGHTFIELD_DEPTH,

  RANGE,

  BIOMES,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS_CHUNK = 800 * 1024;
// const LIGHTMAP_BUFFER_SIZE = 100 * 1024 * 4;
// const NUM_BUFFERS = RANGE * RANGE + RANGE;
const LIGHTMAP_PLUGIN = 'plugins-lightmap';
const DAY_NIGHT_SKYBOX_PLUGIN = 'plugins-day-night-skybox';

const dataSymbol = Symbol();

const HEIGHTFIELD_SHADER = {
  uniforms: {
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
      value: null,
    }, */
    sunIntensity: {
      type: 'f',
      value: 0,
    },
  },
  vertexShader: `\
precision highp float;
precision highp int;
#define FLAT_SHADED
/*uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv; */
attribute vec3 color;
attribute float skyLightmap;
attribute float torchLightmap;

// varying vec3 vPosition;
varying vec3 vViewPosition;
varying vec3 vColor;
varying float vSkyLightmap;
varying float vTorchLightmap;

void main() {
	vColor = color.rgb;

  vec4 mvPosition = modelViewMatrix * vec4( position.xyz, 1.0 );
  gl_Position = projectionMatrix * mvPosition;

	// vPosition = position.xyz;
  vViewPosition = -mvPosition.xyz;
  vSkyLightmap = skyLightmap;
  vTorchLightmap = torchLightmap;
}
`,
  fragmentShader: `\
precision highp float;
precision highp int;
#define FLAT_SHADED
// uniform mat4 viewMatrix;
uniform vec3 ambientLightColor;
// uniform sampler2D lightMap;
// uniform float useLightMap;
// uniform vec2 d;
uniform float sunIntensity;

#define saturate(a) clamp( a, 0.0, 1.0 )

// varying vec3 vPosition;
varying vec3 vViewPosition;
varying vec3 vColor;
varying float vSkyLightmap;
varying float vTorchLightmap;

void main() {
	vec3 diffuseColor = vColor;

  // vec3 lightColor = vec3(vLightmap);
  vec3 lightColor = vec3(floor(
    (
      min((vSkyLightmap * sunIntensity) + vTorchLightmap, 1.0)
    ) * 4.0 + 0.5) / 4.0
  );
  // vec3 lightColor = vec3(floor(vLightmap * 32.0 + 0.5) / 32.0);
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

  vec3 fdx = vec3( dFdx( vViewPosition.x ), dFdx( vViewPosition.y ), dFdx( vViewPosition.z ) );
  vec3 fdy = vec3( dFdy( vViewPosition.x ), dFdy( vViewPosition.y ), dFdy( vViewPosition.z ) );
  vec3 normal = normalize( cross( fdx, fdy ) );
  float dotNL = saturate( dot( normal, normalize(vViewPosition)) );
  vec3 irradiance = ambientLightColor + (dotNL * 1.5);
  vec3 outgoingLight = diffuseColor * irradiance * (0.1 + lightColor * 0.9);

	gl_FragColor = vec4( outgoingLight, 1.0 );
}
`
};

const OCEAN_SHADER = {
  uniforms: {
    worldTime: {
      type: 'f',
      value: 0,
    },
    map: {
      type: 't',
      value: null,
    },
    map2: {
      type: 't',
      value: null,
    },
    /* fogColor: {
      type: '3f',
      value: new THREE.Color(),
    },
    fogDensity: {
      type: 'f',
      value: 0,
    }, */
    sunIntensity: {
      type: 'f',
      value: 0,
    },
  },
  vertexShader: [
    "uniform float worldTime;",
    // "attribute vec3 wave;",
    "attribute vec3 color;",
    "varying vec2 vUv;",
    "varying vec3 vColor;",
    "varying float fogDepth;",
    "void main() {",
    /* "  float ang = wave[0];",
    "  float amp = wave[1];",
    "  float speed = wave[2];", */
    // "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, position.y + ((sin(ang + (speed * worldTime))) * amp), position.z, 1.0);",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xyz, 1.0);",
    "  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",
    "  vUv = vec2(position.x / 16.0 * 4.0, position.z / 16.0 * 4.0 / 16.0);",
    "  vColor = color.rgb;",
    "  fogDepth = -mvPosition.z;",
    "}"
  ].join("\n"),
  fragmentShader: [
    "#define PI 3.1415926535897932384626433832795",
    "#define LOG2 1.442695",
    "#define whiteCompliment(a) ( 1.0 - saturate( a ) )",
    "uniform float worldTime;",
    "uniform sampler2D map;",
    "uniform sampler2D map2;",
    "uniform vec3 fogColor;",
    "uniform float fogDensity;",
    "uniform float sunIntensity;",
    "varying vec2 vUv;",
    "varying vec3 vColor;",
    "varying float fogDepth;",
    "float speed = 2.0;",
    "void main() {",
    "  float animationFactor = (speed - abs(mod(worldTime / 1000.0, speed*2.0) - speed)) / speed;",
    "  float frame1 = mod(floor(animationFactor / 16.0), 1.0);",
    "  float frame2 = mod(frame1 + 1.0/16.0, 1.0);",
    "  float mixFactor = fract(animationFactor / 16.0) * 16.0;",
    "  vec2 uv1 = vUv * vec2(1.0, 1.0 - frame1);",
    "  vec2 uv2 = vUv * vec2(1.0, 1.0 - frame2);",
    "  vec4 diffuseColor = (vColor.b * 256.0) <= 1.5 ? mix(texture2D( map, uv1 ), texture2D( map, uv2 ), mixFactor) : mix(texture2D( map2, uv1 ), texture2D( map2, uv2 ), mixFactor);",
    "  diffuseColor = vec4((0.2 + 0.8 * sunIntensity) * diffuseColor.xyz, 0.9);",
    "  float fogFactor = whiteCompliment( exp2( - fogDensity * fogDensity * fogDepth * fogDepth * LOG2 ) );",
    "  gl_FragColor = vec4(mix( diffuseColor.rgb, fogColor, fogFactor ), diffuseColor.a);",
    "}"
  ].join("\n")
};

class Heightfield {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render, pose, input, world, elements, teleport, stck, utils: {js: {mod, sbffr}, random: {chnkr}}} = zeo;
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
    function _uniformsNeedUpdate(camera) {
      if (uniformsNeedUpdate[camera.name]) {
        uniformsNeedUpdate[camera.name] = false;
        return true;
      } else {
        return false;
      }
    }

    const _getChunkIndex = (x, z) => (mod(x, 0xFFFF) << 16) | mod(z, 0xFFFF);

    /* const m = new THREE.Mesh(new THREE.BoxBufferGeometry(1, 1, 1), new THREE.MeshPhongMaterial({color: 0xFF0000,}));
    m.position.set(56, 88, -8);
    m.updateMatrixWorld();
    scene.add(m); */

    const forwardVector = new THREE.Vector3(0, 0, -1);
    const localVector = new THREE.Vector3();
    const localVector2 = new THREE.Vector3();
    const localEuler = new THREE.Euler();
    const localArray3 = Array(3);
    const localArray16 = Array(16);
    const localArray162 = Array(16);

    const _requestImage = src => new Promise((accept, reject) => {
      const img = new Image();
      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(img);
      };
      img.src = src;
    });
    const _requestImageBitmap = src => _requestImage(src)
      .then(img => createImageBitmap(img, 0, 0, img.width, img.height));

    let generateBuffer = new ArrayBuffer(NUM_POSITIONS_CHUNK);
    let terrainBuffer = new ArrayBuffer(NUM_POSITIONS_CHUNK * 4);
    // let lightmapBuffer = new Uint8Array(LIGHTMAP_BUFFER_SIZE * NUM_BUFFERS);
    let cullBuffer = new ArrayBuffer(100 * 1024);
    // const _allocHslot = lightmapElement => new Float32Array(lightmapElement.lightmapper.buffers.alloc());

    const worker = new Worker('archae/plugins/_plugins_heightfield/build/worker.js');
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
    worker.requestOriginHeight = cb => {
      const id = _makeId();
      worker.postMessage({
        method: 'getOriginHeight',
        id,
      });
      queues[id] = cb;
    };
    worker.requestGenerate = (x, y, index, numPositions, numIndices, cb) => {
      /* elements.requestElement(LIGHTMAP_PLUGIN)
        .then(lightmapElement => { */
          const id = _makeId();
          // const heightfieldBuffer = _allocHslot(lightmapElement);
          worker.postMessage({
            method: 'generate',
            id,
            args: {
              x,
              y,
              index,
              numPositions,
              numIndices,
              buffer: generateBuffer,
              // heightfieldBuffer,
            },
          }, [generateBuffer/*, heightfieldBuffer.buffer*/]);
          queues[id] = newGenerateBuffer => {
            generateBuffer = newGenerateBuffer;

            cb(newGenerateBuffer);
          };
        // });
    };
    worker.requestUngenerate = (x, y) => {
      worker.postMessage({
        method: 'ungenerate',
        args: {
          x,
          y,
        },
      });
    };
    /* worker.requestLightmaps = (lightmapBuffer, cb) => {
      const id = _makeId();
      worker.postMessage({
        method: 'lightmaps',
        id,
        args: {
          lightmapBuffer,
        },
      }, [lightmapBuffer.buffer]);
      queues[id] = cb;
    }; */
    worker.requestCull = (hmdPosition, projectionMatrix, matrixWorldInverse, cb) => {
      const id = _makeId();
      worker.postMessage({
        method: 'cull',
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
    /* worker.requestAddVoxel = (x, y, z) => new Promise((accept, reject) => {
      const id = _makeId();
      worker.postMessage({
        method: 'addVoxel',
        id,
        args: {
          position: [x, y, z],
        },
      });
      queues[id] = accept;
    }); */
    worker.requestSubVoxel = (x, y, z, gslots, cb) => {
      /* elements.requestElement(LIGHTMAP_PLUGIN)
        .then(lightmapElement => { */
          const id = _makeId();
          /* const hslots = [
            _allocHslot(lightmapElement),
            _allocHslot(lightmapElement),
            _allocHslot(lightmapElement),
            _allocHslot(lightmapElement),
          ]; */
          worker.postMessage({
            method: 'subVoxel',
            id,
            args: {
              position: [x, y, z],
              gslots,
              // hslots,
              buffer: terrainBuffer,
            },
          }, [/*hslots[0].buffer, hslots[1].buffer, hslots[2].buffer, hslots[3].buffer, */terrainBuffer]);
          queues[id] = newTerrainBuffer => {
            terrainBuffer = newTerrainBuffer;

            cb(newTerrainBuffer);
          };
        // });
    };
    worker.requestHeightfield = (x, y, buffer, cb) => {
      const id = _makeId();
      worker.postMessage({
        method: 'heightfield',
        id,
        args: {
          x,
          y,
          buffer,
        },
      }, [buffer]);
      queues[id] = cb;
    };
    worker.respond = (id, result, transfers) => {
      worker.postMessage({
        method: 'response',
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
        const {method} = data;

        if (method === 'renderLightmap') {
          throw new Error('not implemented');

          /* const {lightmapBuffer} = data;

          elements.requestElement(LIGHTMAP_PLUGIN)
            .then(lightmapElement => {
              lightmapElement.lightmapper.requestRender(lightmapBuffer, lightmapBuffer => {
                worker.respond(id, lightmapBuffer, [lightmapBuffer.buffer]);
              });
            }); */
        } else if (method === 'addLightmap') {
          throw new Error('not implemented');

          /* const {x, y, heightfield} = data;

          elements.requestElement(LIGHTMAP_PLUGIN)
            .then(lightmapElement => {
              const shape = new lightmapElement.Lightmapper.Heightfield(x * NUM_CELLS, y * NUM_CELLS, heightfield, lightmapElement.Lightmapper.MaxBlend);
              lightmapElement.lightmapper.add(shape, [heightfield.buffer], {update: false});

              worker.respond(id, shape.id);
            }); */
        } else if (method === 'updateLightmaps') {
          throw new Error('not implemented');

          /* const {updatedLightmaps, freedHslots} = data;

          elements.requestElement(LIGHTMAP_PLUGIN)
            .then(lightmapElement => {
              for (let i = 0; i < updatedLightmaps.length; i++) {
                const updatedLightmap = updatedLightmaps[i];
                const {shapeId, heightfield} = updatedLightmap;

                lightmapElement.lightmapper.worker.setShapeData(shapeId, {
                  data: heightfield,
                }, [heightfield.buffer]);
              }
              for (let i = 0; i < freedHslots.length; i++) {
                lightmapElement.lightmapper.buffers.free(freedHslots[i]);
              }

              worker.respond(id, null);
            }); */
        } else {
          console.warn('heightfield got unknown worker request method:', JSON.stringify(method));
        }
      } else if (type === 'removeLightmap') {
        throw new Error('not implemented');

        /* const {shapeId} = data;

        elements.requestElement(LIGHTMAP_PLUGIN)
          .then(lightmapElement => {
            lightmapElement.lightmapper.worker.removeShape(shapeId);
          }); */
      } else {
        console.warn('heightfield got unknown worker message type:', JSON.stringify(type));
      }
    };

    /* let refreshingLightmaps = false;
    const refreshingLightmapsQueue = [];
    const _refreshLightmaps = refreshed => {
      if (!refreshingLightmaps) {
        refreshingLightmaps = true;

        (() => {
          let wordOffset = 0;
          const uint32Array = new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset);
          const int32Array = new Int32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset);

          uint32Array[wordOffset] = refreshed.length;
          wordOffset++;
          for (let i = 0; i < refreshed.length; i++) {
            const trackedMapChunkMeshes = refreshed[i];
            const {offset: {x, y}} = trackedMapChunkMeshes;

            int32Array[wordOffset + 0] = x;
            int32Array[wordOffset + 1] = y;
            wordOffset += 2;
          }
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

            const skyLightmapsLength = uint32Array[byteOffset / 4];
            byteOffset += 4;

            const newSkyLightmaps = new Uint8Array(newLightmapBuffer.buffer, newLightmapBuffer.byteOffset + byteOffset, skyLightmapsLength);
            byteOffset += skyLightmapsLength;
            let alignDiff = byteOffset % 4;
            if (alignDiff > 0) {
              byteOffset += 4 - alignDiff;
            }

            const torchLightmapsLength = uint32Array[byteOffset / 4];
            byteOffset += 4;

            const newTorchLightmaps = new Uint8Array(newLightmapBuffer.buffer, newLightmapBuffer.byteOffset + byteOffset, torchLightmapsLength);
            byteOffset += torchLightmapsLength;
            alignDiff = byteOffset % 4;
            if (alignDiff > 0) {
              byteOffset += 4 - alignDiff;
            }

            const trackedMapChunkMeshes = mapChunkMeshes[_getChunkIndex(x, z)];
            if (trackedMapChunkMeshes) {
              if (newSkyLightmaps.length > 0) {
                const {index, skyLightmaps} = trackedMapChunkMeshes;
                skyLightmaps.set(newSkyLightmaps);
                renderer.updateAttribute(heightfieldObject.geometry.attributes.skyLightmap, index * skyLightmaps.length, newSkyLightmaps.length, false);
              }
              if (newTorchLightmaps.length > 0) {
                const {index, torchLightmaps} = trackedMapChunkMeshes;
                torchLightmaps.set(newTorchLightmaps);
                renderer.updateAttribute(heightfieldObject.geometry.attributes.torchLightmap, index * torchLightmaps.length, newTorchLightmaps.length, false);
              }
            }
          }

          lightmapBuffer = newLightmapBuffer;

          refreshingLightmaps = false;
          if (refreshingLightmapsQueue.length > 0) {
            _refreshLightmaps(refreshingLightmapsQueue.shift());
          }
        });
      } else {
        refreshingLightmapsQueue.push(refreshed);
      }
    }; */

    /* let Lightmapper = null;
    let lightmapper = null;
    const _bindLightmapper = lightmapElement => {
      Lightmapper = lightmapElement.Lightmapper;
      lightmapper = lightmapElement.lightmapper;

      _bindLightmaps();
    };
    const _unbindLightmapper = () => {
      _unbindLightmaps();

      Lightmapper = null;
      lightmapper = null;
    };
    const _bindLightmaps = () => {
      for (const index in mapChunkMeshes) {
        const trackedMapChunkMeshes = mapChunkMeshes[index];
        if (trackedMapChunkMeshes) {
          _bindLightmap(trackedMapChunkMeshes);
        }
      }
    };
    const _unbindLightmaps = () => {
      for (const index in mapChunkMeshes) {
        const trackedMapChunkMeshes = mapChunkMeshes[index];
        if (trackedMapChunkMeshes && trackedMapChunkMeshes.lightmap) {
          _unbindLightmap(trackedMapChunkMeshes);
        }
      }
    };
    const _bindLightmap = trackedMapChunkMeshes => {
      const {offset, staticHeightfield} = trackedMapChunkMeshes;
      const {x, y} = offset;

      const dayNightSkyboxEntity = elements.getEntitiesElement().querySelector(DAY_NIGHT_SKYBOX_PLUGIN);
      const sunIntensity = (dayNightSkyboxEntity && dayNightSkyboxEntity.getSunIntensity) ? dayNightSkyboxEntity.getSunIntensity() : 0;
      const shape = new Lightmapper.Heightfield(x * NUM_CELLS, y * NUM_CELLS, sunIntensity, staticHeightfield, Lightmapper.MaxBlend);
      lightmapper.add(shape);
      trackedMapChunkMeshes.shape = shape;
    };
    const _unbindLightmap = trackedMapChunkMeshes => {
      lightmapper.remove(trackedMapChunkMeshes.shape);
      trackedMapChunkMeshes.shape = null;
    }; */
    /* const elementListener = elements.makeListener(LIGHTMAP_PLUGIN);
    elementListener.on('add', lightmapElement => {
      lightmapElement.lightmapper.on('update', ([minX, minZ, maxX, maxZ]) => {
        const refreshed = [];
        for (const index in mapChunkMeshes) {
          const trackedMapChunkMeshes = mapChunkMeshes[index];
          if (trackedMapChunkMeshes) {
            const {offset: {x, y: z}} = trackedMapChunkMeshes;

            if (x >= minX && x < maxX && z >= minZ && z < maxZ) {
              refreshed.push(trackedMapChunkMeshes);
            }
          }
        }
        if (refreshed.length > 0) {
          _refreshLightmaps(refreshed);
        }
      });
    }); */
    /* elementListener.on('remove', () => {
      _unbindLightmapper();
    }); */

    return Promise.all([
      new Promise((accept, reject) => {
        worker.requestOriginHeight(originHeight => {
          world.setSpawnMatrix(new THREE.Matrix4().makeTranslation(0, originHeight, 0));

          accept();
        });
      }),
      _requestImageBitmap('/archae/heightfield/img/water.png'),
      _requestImageBitmap('/archae/heightfield/img/lava.png'),
    ])
      .then(([
        setSpawnMatrixResult,
        waterImg,
        lavaImg,
      ]) => {
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
              name: 'colors',
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

            const {positions, colors, skyLightmaps, torchLightmaps, indices} = geometryBuffers[i].getAll();

            const positionAttribute = new THREE.BufferAttribute(positions, 3);
            positionAttribute.dynamic = true;
            geometry.addAttribute('position', positionAttribute);
            const colorAttribute = new THREE.BufferAttribute(colors, 3);
            colorAttribute.dynamic = true;
            geometry.addAttribute('color', colorAttribute);
            const skyLightmapAttribute = new THREE.BufferAttribute(skyLightmaps, 1, true);
            skyLightmapAttribute.dynamic = true;
            geometry.addAttribute('skyLightmap', skyLightmapAttribute);
            const torchLightmapAttribute = new THREE.BufferAttribute(torchLightmaps, 1, true);
            torchLightmapAttribute.dynamic = true;
            geometry.addAttribute('torchLightmap', torchLightmapAttribute);
            const indexAttribute = new THREE.BufferAttribute(indices, 1);
            indexAttribute.dynamic = true;
            geometry.setIndex(indexAttribute);

            renderer.updateAttribute(geometry.attributes.position, 0, geometry.attributes.position.array.length, false);
            renderer.updateAttribute(geometry.attributes.color, 0, geometry.attributes.color.array.length, false);
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

        const _requestGenerate = (x, z, index, numPositions, numIndices, cb) => {
          worker.requestGenerate(x, z, index, numPositions, numIndices, mapChunkBuffer => {
            cb(protocolUtils.parseRenderChunk(mapChunkBuffer));
          });
        };
        const _makeMapChunkMeshes = (chunk, gbuffer) => {
          const {index, geometry, slices: {positions, colors, skyLightmaps, torchLightmaps, indices}} = gbuffer;

          const renderListEntries = [
            {
              object: heightfieldObject,
              geometry,
              material: heightfieldMaterial,
              groups: [],
              /* groups: [{
                start: 0,
                count: Infinity,
                materialIndex: 0,
              }], */
              visible: false,
            },
            {
              object: heightfieldObject,
              geometry,
              material: oceanMaterial,
              // material: heightfieldMaterial,
              groups: [],
              visible: false,
            },
          ];
          let version = 0;

          const meshes = {
            renderListEntries,
            index: gbuffer.index,
            numPositions: gbuffer.slices.positions.length,
            numIndices: gbuffer.slices.indices.length,
            skyLightmaps: gbuffer.slices.skyLightmaps,
            torchLightmaps: gbuffer.slices.torchLightmaps,
            offset: new THREE.Vector2(chunk.x, chunk.z),
            heightfield: null,
            staticHeightfield: null,
            lightmap: null,
            stckBody: null,
            update: chunkData => {
              const {positions: newPositions, colors: newColors, skyLightmaps: newSkyLightmaps, torchLightmaps: newTorchLightmaps, indices: newIndices, heightfield, staticHeightfield} = chunkData;

              if (newPositions.length > 0) {
                version++;

                // XXX move heightfield interpolation entirely into the worker
                // XXX preallocate staticHeightfield feedthrough for lightmap and stck

                // geometry

                positions.set(newPositions);
                colors.set(newColors);
                skyLightmaps.set(newSkyLightmaps);
                torchLightmaps.set(newTorchLightmaps);
                indices.set(newIndices);

                meshes.heightfield = heightfield.slice();
                // XXX preallocate stck buffers
                meshes.staticHeightfield = staticHeightfield.slice(); // XXX this needs to be refreshed along with terrain destruction

                const newPositionsLength = newPositions.length;
                const newColorsLength = newColors.length;
                const newSkyLightmapsLength = newSkyLightmaps.length;
                const newTorchLightmapsLength = newTorchLightmaps.length;
                const newIndicesLength = newIndices.length;

                const localVersion = version;
                _requestFrame(next => {
                  if (version === localVersion) {
                    renderListEntries[0].visible = false;
                    renderListEntries[1].visible = false;

                    renderer.updateAttribute(geometry.attributes.position, index * positions.length, newPositionsLength, false);
                    renderer.updateAttribute(geometry.attributes.color, index * colors.length, newColorsLength, false);
                    renderer.updateAttribute(geometry.attributes.skyLightmap, index * skyLightmaps.length, newSkyLightmapsLength, false);
                    renderer.updateAttribute(geometry.attributes.torchLightmap, index * torchLightmaps.length, newTorchLightmapsLength, false);
                    renderer.updateAttribute(geometry.index, index * indices.length, newIndicesLength, true);
                    renderer.getContext().flush();

                    requestAnimationFrame(() => {
                      renderListEntries[0].visible = true;
                      renderListEntries[1].visible = true;

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

              /* if (meshes.shape) {
                _unbindLightmap(meshes);
              } */
            },
          };

          return meshes;
        };

        const waterTexture = new THREE.Texture(
          waterImg,
          THREE.UVMapping,
          THREE.RepeatWrapping,
          THREE.RepeatWrapping,
          THREE.NearestFilter,
          THREE.NearestFilter,
          THREE.RGBAFormat,
          THREE.UnsignedByteType,
          1
        );
        waterTexture.needsUpdate = true;
        const lavaTexture = new THREE.Texture(
          lavaImg,
          THREE.UVMapping,
          THREE.RepeatWrapping,
          THREE.RepeatWrapping,
          THREE.NearestFilter,
          THREE.NearestFilter,
          THREE.RGBAFormat,
          THREE.UnsignedByteType,
          1
        );
        lavaTexture.needsUpdate = true;
        const uniforms = THREE.UniformsUtils.clone(OCEAN_SHADER.uniforms);
        uniforms.map.value = waterTexture;
        uniforms.map2.value = lavaTexture;
        // uniforms.fogColor.value = scene.fog.color;
        // uniforms.fogDensity.value = scene.fog.density;
        const oceanMaterial = new THREE.ShaderMaterial({
          uniforms,
          vertexShader: OCEAN_SHADER.vertexShader,
          fragmentShader: OCEAN_SHADER.fragmentShader,
          transparent: true,
        });
        // oceanMaterial.uniformsNeedUpdate = _uniformsNeedUpdate; // XXX separate from the hiehgtfield shader

        const chunker = chnkr.makeChunker({
          resolution: NUM_CELLS,
          range: RANGE,
        });
        let mapChunkMeshes = {};

        const heightfieldObject = (() => {
          /* const {positions, colors, skyLightmaps, torchLightmaps, indices} = geometryBuffer.getAll();

          const geometry = new THREE.BufferGeometry();
          const positionAttribute = new THREE.BufferAttribute(positions, 3);
          positionAttribute.dynamic = true;
          geometry.addAttribute('position', positionAttribute);
          const colorAttribute = new THREE.BufferAttribute(colors, 3);
          colorAttribute.dynamic = true;
          geometry.addAttribute('color', colorAttribute);
          const skyLightmapAttribute = new THREE.BufferAttribute(skyLightmaps, 1, true);
          skyLightmapAttribute.dynamic = true;
          geometry.addAttribute('skyLightmap', skyLightmapAttribute);
          const torchLightmapAttribute = new THREE.BufferAttribute(torchLightmaps, 1, true);
          torchLightmapAttribute.dynamic = true;
          geometry.addAttribute('torchLightmap', torchLightmapAttribute);
          const indexAttribute = new THREE.BufferAttribute(indices, 1);
          indexAttribute.dynamic = true;
          geometry.setIndex(indexAttribute); */

          const mesh = new THREE.Object3D();
          mesh.updateModelViewMatrix = _updateModelViewMatrix;
          mesh.updateNormalMatrix = _updateNormalMatrix;
          mesh.renderList = [];
          return mesh;
        })();
        scene.add(heightfieldObject);

        const heightfieldMaterial = new THREE.ShaderMaterial({
          uniforms: Object.assign(
            THREE.UniformsUtils.clone(THREE.UniformsLib.lights),
            THREE.UniformsUtils.clone(HEIGHTFIELD_SHADER.uniforms)
          ),
          vertexShader: HEIGHTFIELD_SHADER.vertexShader,
          fragmentShader: HEIGHTFIELD_SHADER.fragmentShader,
          lights: true,
          extensions: {
            derivatives: true,
          },
        });
        heightfieldMaterial.uniformsNeedUpdate = _uniformsNeedUpdate;

        const listeners = [];
        const _emit = (e, d) => {
          for (let i = 0; i < listeners.length; i++) {
            listeners[i](e, d);
          }
        };

        const _debouncedRequestRefreshMapChunks = _debounce(next => {
          const {hmd} = pose.getStatus();
          const {worldPosition: hmdPosition} = hmd;
          const {added, removed/*, relodded*/} = chunker.update(hmdPosition.x, hmdPosition.z);

          let running = false;
          const queue = [];
          const _next = () => {
            running = false;

            if (queue.length > 0) {
              _addChunk(queue.shift());
            } else {
              next();
            }
          };
          const _addChunk = chunk => {
            if (!running) {
              running = true;

              const {x, z, lod} = chunk;
              const index = _getChunkIndex(x, z);
              const oldMapChunkMeshes = mapChunkMeshes[index];
              if (oldMapChunkMeshes) {
                heightfieldObject.renderList.splice(heightfieldObject.renderList.indexOf(oldMapChunkMeshes.renderListEntries[0]), 2);

                oldMapChunkMeshes.destroy();

                stck.destroyBody(oldMapChunkMeshes.stckBody);

                _emit('remove', oldMapChunkMeshes);

                mapChunkMeshes[index] = null;
              }

              const gbuffer = geometries.alloc();
              _requestGenerate(x, z, gbuffer.index, gbuffer.slices.positions.length, gbuffer.slices.indices.length, chunkData => {
                const newMapChunkMeshes = _makeMapChunkMeshes(chunk, gbuffer);
                newMapChunkMeshes.update(chunkData);

                heightfieldObject.renderList.push(newMapChunkMeshes.renderListEntries[0], newMapChunkMeshes.renderListEntries[1]);

                newMapChunkMeshes.stckBody = stck.makeStaticHeightfieldBody(
                  new THREE.Vector3(x * NUM_CELLS, 0, z * NUM_CELLS),
                  NUM_CELLS,
                  NUM_CELLS,
                  newMapChunkMeshes.staticHeightfield
                );

                mapChunkMeshes[index] = newMapChunkMeshes;
                chunk[dataSymbol] = newMapChunkMeshes;

                _emit('add', chunk);

                _next();
              });
            } else {
              queue.push(chunk);
            }
          };
          if (removed.length > 0) {
            for (let i = 0; i < removed.length; i++) {
              const chunk = removed[i];
              const {x, z, [dataSymbol]: oldMapChunkMeshes} = chunk;
              heightfieldObject.renderList.splice(heightfieldObject.renderList.indexOf(oldMapChunkMeshes.renderListEntries[0]), 2);

              oldMapChunkMeshes.destroy();

              _emit('remove', chunk);

              worker.requestUngenerate(x, z);

              mapChunkMeshes[_getChunkIndex(x, z)] = null;
            }

            const newMapChunkMeshes = {};
            for (const index in mapChunkMeshes) {
              const trackedMapChunkMeshes = mapChunkMeshes[index];
              if (trackedMapChunkMeshes) {
                newMapChunkMeshes[index] = trackedMapChunkMeshes;
              }
            }
            mapChunkMeshes = newMapChunkMeshes;
          }
          for (let i = 0; i < added.length; i++) {
            _addChunk(added[i]);
          }
          /* for (let i = 0; i < relodded.length; i++) {
            const chunk = relodded[i];
            const {lastLod} = chunk;

            if (lastLod === -1) {
              _addChunk(chunk);
            }
          } */

          if (!running) {
            next();
          }
        });
        const _requestSubVoxel = (() => {
          let running = false;
          const queue = [];
          const _next = () => {
            running = false;

            if (queue.length > 0) {
              const {x, y, z} = queue.shift();
              _recurse(x, y, z);
            }
          };

          const _recurse = (x, y, z) => {
            if (!running) {
              running = true;

              const ox = Math.floor(x / NUM_CELLS);
              const oz = Math.floor(z / NUM_CELLS);

              const gslots = {};
              for (let dz = -1; dz <= 1; dz++) {
                for (let dx = -1; dx <= 1; dx++) {
                  const index = _getChunkIndex(ox + dx, oz + dz);
                  const mapChunkMesh = mapChunkMeshes[index];
                  if (mapChunkMesh) {
                    gslots[index] = {
                      index: mapChunkMesh.index,
                      numPositions: mapChunkMesh.numPositions,
                      numIndices: mapChunkMesh.numIndices,
                    };
                  }
                }
              }
              worker.requestSubVoxel(x, y, z, gslots, buffer => {
                let byteOffset = 0;
                const numChunks = new Uint32Array(buffer, byteOffset, 1);
                byteOffset += 4;

                for (let i = 0; i < numChunks; i++) {
                  const chunkHeader1 = new Int32Array(buffer, byteOffset, 2);
                  const x = chunkHeader1[0];
                  const z = chunkHeader1[1];
                  byteOffset += 4 * 2;

                  const chunkLength = new Uint32Array(buffer, byteOffset, 1)[0];
                  byteOffset += 4;

                  const chunkBuffer = new Uint8Array(buffer, byteOffset, chunkLength);
                  byteOffset += chunkLength;

                  const trackedMapChunkMeshes = mapChunkMeshes[_getChunkIndex(x, z)];
                  if (trackedMapChunkMeshes) {
                    trackedMapChunkMeshes.update(protocolUtils.parseRenderChunk(chunkBuffer.buffer, chunkBuffer.byteOffset));
                  }
                }

                _next();
              });
            } else {
              queue.push({x, y, z});
            }
          };
          return _recurse;
        })();

        const a = new THREE.Vector3();
        const b = new THREE.Vector3();
        const c = new THREE.Vector3();
        const p = new THREE.Vector3();
        const triangle = new THREE.Triangle(a, b, c);
        const baryCoord = new THREE.Vector3();
        const _getHeightfieldIndex = (x, z) => (x + (z * (NUM_CELLS + 1))) * HEIGHTFIELD_DEPTH;
        const _getElevation = (x, z) => {
          const ox = Math.floor(x / NUM_CELLS);
          const oz = Math.floor(z / NUM_CELLS);
          const mapChunkMesh = mapChunkMeshes[_getChunkIndex(ox, oz)];

          return mapChunkMesh ?
            _getTopHeightfieldTriangleElevation(mapChunkMesh.heightfield, x - (ox * NUM_CELLS), z - (ox * NUM_CELLS))
          :
            0;
        };
        const _getBestElevation = (x, z, y) => {
          const ox = Math.floor(x / NUM_CELLS);
          const oz = Math.floor(z / NUM_CELLS);
          const mapChunkMesh = mapChunkMeshes[_getChunkIndex(ox, oz)];

          return mapChunkMesh ?
            _getBestHeightfieldTriangleElevation(
              mapChunkMesh.heightfield,
              x - (ox * NUM_CELLS),
              z - (oz * NUM_CELLS),
              y
            )
          :
            0;
        };
        const _getTopHeightfieldTriangleElevation = (heightfield, x, z) => {
          const ax = Math.floor(x);
          const az = Math.floor(z);
          if ((x - ax) <= (1 - (z - az))) { // top left triangle
            a.set(ax, 0, az);
            b.set(ax + 1, 0, az);
            c.set(ax, 0, az + 1);
          } else { // bottom right triangle
            a.set(ax + 1, 0, az);
            b.set(ax, 0, az + 1);
            c.set(ax + 1, 0, az + 1);
          };
          const ea = heightfield[_getHeightfieldIndex(a.x, a.z)];
          const eb = heightfield[_getHeightfieldIndex(b.x, b.z)];
          const ec = heightfield[_getHeightfieldIndex(c.x, c.z)];

          p.set(x, 0, z);
          triangle.barycoordFromPoint(p, baryCoord);

          return baryCoord.x * ea +
            baryCoord.y * eb +
            baryCoord.z * ec;
        };
        const _getBestHeightfieldTriangleElevation = (heightfield, x, z, y) => {
          const ax = Math.floor(x);
          const az = Math.floor(z);
          if ((x - ax) <= (1 - (z - az))) { // top left triangle
            a.set(ax, 0, az);
            b.set(ax + 1, 0, az);
            c.set(ax, 0, az + 1);
          } else { // bottom right triangle
            a.set(ax + 1, 0, az);
            b.set(ax, 0, az + 1);
            c.set(ax + 1, 0, az + 1);
          };
          const ea = _getBestHeightfieldPointElevation(heightfield, a.x, a.z, y);
          const eb = _getBestHeightfieldPointElevation(heightfield, b.x, b.z, y);
          const ec = _getBestHeightfieldPointElevation(heightfield, c.x, c.z, y);

          triangle.barycoordFromPoint(p.set(x, 0, z), baryCoord);

          return baryCoord.x * ea +
            baryCoord.y * eb +
            baryCoord.z * ec;
        };
        const _getBestHeightfieldPointElevation = (heightfield, x, z, y) => {
          let bestY = -1024;
          let bestYDistance = Infinity;
          for (let i = 0; i < HEIGHTFIELD_DEPTH; i++) {
            const localY = heightfield[_getHeightfieldIndex(x, z) + i];

            if (localY !== -1024) {
              const distance = Math.abs(y - localY);

              if (distance < bestYDistance) {
                bestY = localY;
                bestYDistance = distance;
              } else {
                continue;
              }
            } else {
              break;
            }
          }
          return bestY;
        };

        let running = false;
        const queue = [];
        const _requestFrame = fn => {
          if (!running) {
            running = true;

            fn(() => {
              running = false;

              if (queue.length > 0) {
                _requestFrame(queue.shift());
              }
            });
          } else {
            queue.push(fn);
          }
        };

        const heightfieldEntity = {
          entityAddedCallback(entityElement) {
            const _teleportTarget = (position, rotation, scale, side, hmdPosition) => {
              localEuler.setFromQuaternion(rotation, camera.rotation.order);
              const angleFactor = Math.min(Math.pow(Math.max(localEuler.x + Math.PI * 0.45, 0) / (Math.PI * 0.8), 2), 1);
              localEuler.x = 0;
              localEuler.z = 0;
              const targetPosition = localVector.set(position.x, 0, position.z)
                .add(
                  localVector2.copy(forwardVector)
                    .applyEuler(localEuler)
                    .multiplyScalar(15 * angleFactor)
                );
              const ox = Math.floor(targetPosition.x / NUM_CELLS);
              const oz = Math.floor(targetPosition.z / NUM_CELLS);
              const mapChunkMesh = mapChunkMeshes[_getChunkIndex(ox, oz)];

              if (mapChunkMesh) {
                targetPosition.y = _getBestHeightfieldTriangleElevation(
                  mapChunkMesh.heightfield,
                  targetPosition.x - (ox * NUM_CELLS),
                  targetPosition.z - (oz * NUM_CELLS),
                  hmdPosition.y - 1.5
                );
                if (targetPosition.y !== -1024) {
                  return targetPosition;
                } else {
                  return null;
                }
              } else {
                return null;
              }
            };
            teleport.addTarget(_teleportTarget);

            entityElement.getChunk = (x, z) => chunker.getChunk(x, z);
            entityElement.getElevation = _getElevation;
            entityElement.getBestElevation = _getBestElevation;
            entityElement.requestHeightfield = (x, z, buffer, cb) => {
              worker.requestHeightfield(x, z, buffer, cb);
            };
            entityElement.registerListener = listener => {
              listeners.push(listener);

              for (const index in chunker.chunks) {
                const chunk = chunker.chunks[index];
                if (chunk) {
                  listener('add', chunk);
                }
              }
            };
            entityElement.unregisterListener = listener => {
              listeners.splice(listeners.indexOf(listener), 1);
            };
            entityElement.requestFrame = _requestFrame;

            entityElement._cleanup = () => {
              teleport.removeTarget(_teleportTarget);
            };
          },
        };
        elements.registerEntity(this, heightfieldEntity);

        const _triggerdown = e => {
          const {side} = e;
          const {hmd, gamepads} = pose.getStatus();
          const {worldPosition: hmdPosition} = hmd;
          const gamepad = gamepads[side];
          const {worldPosition: controllerPosition, worldRotation: controllerRotation} = gamepad;

          localEuler.setFromQuaternion(controllerRotation, camera.rotation.order);
          const angleFactor = Math.min(Math.pow(Math.max(localEuler.x + Math.PI * 0.45, 0) / (Math.PI * 0.8), 2), 1);
          localEuler.x = 0;
          localEuler.z = 0;
          localVector.set(controllerPosition.x, 0, controllerPosition.z)
            .add(
              localVector2.copy(forwardVector)
                .applyEuler(localEuler)
                .multiplyScalar(15 * angleFactor)
            );
          const {x: lx, z: lz} = localVector;
          const ox = Math.floor(lx / NUM_CELLS);
          const oz = Math.floor(lz / NUM_CELLS);

          const mapChunkMesh = mapChunkMeshes[_getChunkIndex(ox, oz)];
          if (mapChunkMesh) {
            const ly = _getBestHeightfieldTriangleElevation(
              mapChunkMesh.heightfield,
              lx - (ox * NUM_CELLS),
              lz - (oz * NUM_CELLS),
              hmdPosition.y - 1.5
            );
            if (ly !== -1024) {
              _requestSubVoxel(Math.round(lx), Math.round(ly), Math.round(lz));

              e.stopImmediatePropagation();
            }
          }
        };
        input.on('triggerdown', _triggerdown, {
          priority: -1,
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
              const {index, landGroups, liquidGroups} = culls[i];

              const trackedMapChunkMeshes = mapChunkMeshes[index];
              if (trackedMapChunkMeshes) {
                trackedMapChunkMeshes.renderListEntries[0].groups = landGroups;
                trackedMapChunkMeshes.renderListEntries[1].groups = liquidGroups;
              }
            }

            next();
          });
        });

        let refreshChunksTimeout = null;
        const _recurseRefreshChunks = () => {
          const {hmd: {worldPosition: hmdPosition}} = pose.getStatus();
          _debouncedRequestRefreshMapChunks();
          refreshChunksTimeout = setTimeout(_recurseRefreshChunks, 1000);
        };
        _recurseRefreshChunks();
        let refreshCullTimeout = null;
        const _recurseRefreshCull = () => {
          _debouncedRefreshCull();
          refreshCullTimeout = setTimeout(_recurseRefreshCull, 1000 / 30);
        };
        _recurseRefreshCull();

        const _update = () => {
          const _updateMaterials = () => {
            const dayNightSkyboxEntity = elements.getEntitiesElement().querySelector(DAY_NIGHT_SKYBOX_PLUGIN);
            const sunIntensity = (dayNightSkyboxEntity && dayNightSkyboxEntity.getSunIntensity) ? dayNightSkyboxEntity.getSunIntensity() : 0;
            heightfieldMaterial.uniforms.sunIntensity.value = sunIntensity;

            oceanMaterial.uniforms.worldTime.value = world.getWorldTime();
            oceanMaterial.uniforms.sunIntensity.value = sunIntensity;
          };
          const _updateMatrices = () => {
            modelViewMatricesValid.left = false;
            modelViewMatricesValid.right = false;
            normalMatricesValid.left = false;
            normalMatricesValid.right = false;
            uniformsNeedUpdate.left = true;
            uniformsNeedUpdate.right = true;
          };

          _updateMaterials();
          _updateMatrices();
        };
        render.on('update', _update);

        this._cleanup = () => {
          scene.remove(heightfieldObject);

          clearTimeout(refreshChunksTimeout);
          clearTimeout(refreshCullTimeout);

          // elements.destroyListener(elementListener);

          elements.unregisterEntity(this, heightfieldEntity);

          render.removeListener('update', _update);
        };
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

module.exports = Heightfield;
