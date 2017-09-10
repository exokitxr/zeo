const {
  NUM_CELLS,

  NUM_CELLS_HEIGHT,

  RANGE,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS_CHUNK = 200 * 1024;
// const LIGHTMAP_BUFFER_SIZE = 100 * 1024 * 4;
// const NUM_BUFFERS = RANGE * RANGE + RANGE;
const TEXTURE_SIZE = 1024;
const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
// const LIGHTMAP_PLUGIN = 'plugins-lightmap';
const DAY_NIGHT_SKYBOX_PLUGIN = 'plugins-day-night-skybox';

const dataSymbol = Symbol();

const GRASS_SHADER = {
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
/*uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv; */
attribute float skyLightmap;
attribute float torchLightmap;

varying vec3 vPosition;
varying vec2 vUv;
varying float vSkyLightmap;
varying float vTorchLightmap;

void main() {
  vUv = uv;

  vec4 mvPosition = modelViewMatrix * vec4( position.xyz, 1.0 );
  gl_Position = projectionMatrix * mvPosition;

	vPosition = position.xyz;

  vSkyLightmap = skyLightmap;
  vTorchLightmap = torchLightmap;
}
`,
  fragmentShader: `\
precision highp float;
precision highp int;
#define ALPHATEST 0.7
// uniform mat4 viewMatrix;
// uniform vec3 ambientLightColor;
uniform sampler2D map;
// uniform sampler2D lightMap;
// uniform float useLightMap;
// uniform vec2 d;
uniform float sunIntensity;

varying vec3 vPosition;
varying vec2 vUv;
varying float vSkyLightmap;
varying float vTorchLightmap;

void main() {
  vec4 diffuseColor = texture2D( map, vUv );

  // vec3 lightColor = vec3(floor(vSkyLightmap * 4.0 + 0.5) / 4.0);
  vec3 lightColor = vec3(floor(
    (
      min((vSkyLightmap * sunIntensity) + vTorchLightmap, 1.0)
    ) * 4.0 + 0.5) / 4.0
  );
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

#ifdef ALPHATEST
	if ( diffuseColor.a < ALPHATEST ) discard;
#endif

  vec3 outgoingLight = diffuseColor.rgb * (0.1 + lightColor * 0.9);

	gl_FragColor = vec4( outgoingLight, diffuseColor.a );
}
`
};

class Grass {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render, pose, elements, /*stage, */utils: {js: {mod, sbffr}, random: {chnkr}}} = zeo;
    const {THREE, scene, camera, renderer} = three;

    return elements.requestElement(HEIGHTFIELD_PLUGIN)
      .then(heightfieldElement => {
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

        const localArray3 = Array(3);
        const localArray16 = Array(16);
        const localArray162 = Array(16);

        let live = true;
        this._cleanup = () => {
          live  = false;
        };

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

            const {positions, uvs, skyLightmaps, torchLightmaps, indices} = geometryBuffers[i].getAll();

            const positionAttribute = new THREE.BufferAttribute(positions, 3);
            positionAttribute.dynamic = true;
            geometry.addAttribute('position', positionAttribute);
            const uvAttribute = new THREE.BufferAttribute(uvs, 2);
            uvAttribute.dynamic = true;
            geometry.addAttribute('uv', uvAttribute);
            const skyLightmapAttribute = new THREE.BufferAttribute(skyLightmaps, 1, true);
            skyLightmapAttribute.dynamic = true;
            geometry.addAttribute('skyLightmap', skyLightmapAttribute);
            const torchLightmapsAttribute = new THREE.BufferAttribute(torchLightmaps, 1, true);
            torchLightmapsAttribute.dynamic = true;
            geometry.addAttribute('torchLightmap', torchLightmapsAttribute);
            const indexAttribute = new THREE.BufferAttribute(indices, 1);
            indexAttribute.dynamic = true;
            geometry.setIndex(indexAttribute);

            renderer.updateAttribute(geometry.attributes.position, 0, geometry.attributes.position.array.length, false);
            renderer.updateAttribute(geometry.attributes.uv, 0, geometry.attributes.uv.array.length, false);
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
        const grassMesh = (() => {
          /* const {positions, uvs, skyLightmaps, torchLightmaps, indices} = geometryBuffer.getAll();

          const geometry = new THREE.BufferGeometry();
          const positionAttribute = new THREE.BufferAttribute(positions, 3);
          positionAttribute.dynamic = true;
          geometry.addAttribute('position', positionAttribute);
          const uvAttribute = new THREE.BufferAttribute(uvs, 2);
          uvAttribute.dynamic = true;
          geometry.addAttribute('uv', uvAttribute);
          const skyLightmapAttribute = new THREE.BufferAttribute(skyLightmaps, 1, true);
          skyLightmapAttribute.dynamic = true;
          geometry.addAttribute('skyLightmap', skyLightmapAttribute);
          const torchLightmapsAttribute = new THREE.BufferAttribute(torchLightmaps, 1, true);
          torchLightmapsAttribute.dynamic = true;
          geometry.addAttribute('torchLightmap', torchLightmapsAttribute);
          const indexAttribute = new THREE.BufferAttribute(indices, 1);
          indexAttribute.dynamic = true;
          geometry.setIndex(indexAttribute); */

          const mesh = new THREE.Object3D();
          mesh.updateModelViewMatrix = _updateModelViewMatrix;
          mesh.updateNormalMatrix = _updateNormalMatrix;
          mesh.renderList = [];
          return mesh;
        })();
        scene.add(grassMesh);

        const grassChunkMeshes = {};

        let generateBuffer = new ArrayBuffer(NUM_POSITIONS_CHUNK);
        // let lightmapBuffer = new Uint8Array(LIGHTMAP_BUFFER_SIZE * NUM_BUFFERS);
        let cullBuffer = new ArrayBuffer(100 * 1024);
        const worker = new Worker('archae/plugins/_plugins_grass/build/worker.js');
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
        worker.requestGenerate = (x, y, index, numPositions, numIndices, cb) => {
          const id = _makeId();
          worker.postMessage({
            type: 'generate',
            id,
            x,
            y,
            index,
            numPositions,
            numIndices,
            buffer: generateBuffer,
          }, [generateBuffer]);
          queues[id] = newGenerateBuffer => {
            generateBuffer = newGenerateBuffer;

            cb(newGenerateBuffer);
          };
        };
        worker.requestUngenerate = (x, y) => {
          worker.postMessage({
            type: 'ungenerate',
            x,
            y,
          });
        };
        /* worker.requestLightmaps = (lightmapBuffer, cb) => {
          const id = _makeId();
          worker.postMessage({
            type: 'lightmaps',
            id,
            args: {
              lightmapBuffer,
            },
          }, [lightmapBuffer.buffer]);
          queues[id] = cb;
        }; */
        worker.requestCull = (hmdPosition, projectionMatrix, matrixWorldInverse, cb) => { // XXX hmdPosition is unused
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
            const {method} = data;

            if (method === 'render') {
              throw new Error('not implemented');

              /* const {lightmapBuffer} = data;

              elements.requestElement(LIGHTMAP_PLUGIN)
                .then(lightmapElement => {
                  lightmapElement.lightmapper.requestRender(lightmapBuffer, lightmapBuffer => {
                    worker.requestResponse(id, lightmapBuffer, [lightmapBuffer.buffer]);
                  });
                }); */
            } else if (method === 'heightfield') {
              const [id, x, y] = args;
              const {buffer} = data;

              heightfieldElement.requestHeightfield(x, y, buffer, heightfield => {
                worker.requestResponse(id, heightfield, [heightfield.buffer]);
              });
            } else {
              console.warn('grass got unknown worker response method type:', JSON.stringify(method));
            }
          } else {
            console.warn('grass got unknown worker message type:', JSON.stringify(type));
          }
        };
        const _requestTexture = () => _requestImageData('archae/grass/img/texture-atlas.png')
          .then(imageData => {
            const texture = new THREE.Texture(
              imageData,
              THREE.UVMapping,
              THREE.ClampToEdgeWrapping,
              THREE.ClampToEdgeWrapping,
              THREE.NearestMipMapLinearFilter,
              THREE.NearestMipMapLinearFilter,
              THREE.RGBAFormat,
              THREE.UnsignedByteType,
              16
            );
            texture.needsUpdate = true;
            return texture;
          });
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
        const _requestImageData = src => _requestImage(src)
          .then(img => createImageBitmap(img, 0, 0, img.width, img.height, {
            imageOrientation: 'flipY',
          }));

        _requestTexture()
          .then(mapTexture => {
            if (live) {
              const uniforms = Object.assign(
                THREE.UniformsUtils.clone(THREE.UniformsLib.lights),
                THREE.UniformsUtils.clone(GRASS_SHADER.uniforms)
              );
              uniforms.map.value = mapTexture;
              const grassMaterial = new THREE.ShaderMaterial({
                uniforms: uniforms,
                vertexShader: GRASS_SHADER.vertexShader,
                fragmentShader: GRASS_SHADER.fragmentShader,
                lights: true,
                side: THREE.DoubleSide,
              });
              grassMaterial.uniformsNeedUpdate = _uniformsNeedUpdate;

              const _requestGrassGenerate = (x, y, index, numPositions, numIndices, cb) => {
                worker.requestGenerate(x, y, index, numPositions, numIndices, grassChunkBuffer => {
                  cb(protocolUtils.parseRenderGeometry(grassChunkBuffer));
                });
              };
              const _makeGrassChunkMesh = (chunk, gbuffer, grassChunkData) => {
                const {x, z} = chunk;

                const {index, geometry, slices: {positions, uvs, skyLightmaps, torchLightmaps, indices}} = gbuffer;
                const {positions: newPositions, uvs: newUvs, skyLightmaps: newSkyLightmaps, torchLightmaps: newTorchLightmaps, indices: newIndices} = grassChunkData;

                const material = grassMaterial;

                const renderListEntry = {
                  object: grassMesh,
                  geometry,
                  material,
                  groups: [],
                  visible: false,
                };
                let version = 0;

                const mesh = {
                  renderListEntry,
                  index,
                  offset: new THREE.Vector2(x, z),
                  skyLightmaps,
                  torchLightmaps,
                  destroy: () => {
                    version++;

                    geometries.free(gbuffer);
                  },
                };

                if (newPositions.length > 0) {
                  version++;

                  positions.set(newPositions);
                  uvs.set(newUvs);
                  skyLightmaps.set(newSkyLightmaps);
                  torchLightmaps.set(newTorchLightmaps);
                  indices.set(newIndices);

                  const newPositionsLength = newPositions.length;
                  const newUvsLength = newUvs.length;
                  const newSkyLightmapsLength = newSkyLightmaps.length;
                  const newTorchLightmapsLength = newTorchLightmaps.length;
                  const newIndicesLength = newIndices.length;

                  const localVersion = version;
                  heightfieldElement.requestFrame(next => {
                    if (version === localVersion) {
                      renderListEntry.visible = false;

                      renderer.updateAttribute(geometry.attributes.position, index * positions.length, newPositionsLength, false);
                      renderer.updateAttribute(geometry.attributes.uv, index * uvs.length, newUvsLength, false);
                      renderer.updateAttribute(geometry.attributes.skyLightmap, index * skyLightmaps.length, newSkyLightmapsLength, false);
                      renderer.updateAttribute(geometry.attributes.torchLightmap, index * torchLightmaps.length, newTorchLightmapsLength, false);
                      renderer.updateAttribute(geometry.index, index * indices.length, newIndicesLength, true);
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

                return mesh;
              };

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
                  const gbuffer = geometries.alloc();
                  _requestGrassGenerate(x, z, gbuffer.index, gbuffer.slices.positions.length, gbuffer.slices.indices.length, grassChunkData => {
                    const grassChunkMesh = _makeGrassChunkMesh(chunk, gbuffer, grassChunkData);
                    // stage.add('main', grassChunkMesh);
                    grassMesh.renderList.push(grassChunkMesh.renderListEntry);

                    grassChunkMeshes[_getChunkIndex(x, z)] = grassChunkMesh;

                    chunk[dataSymbol] = grassChunkMesh;

                    _next();
                  });
                } else {
                  queue.push(_addChunk.bind(this, chunk));
                }
              };
              const _removeChunk = chunk => {
                if (!running) {
                  running = true;

                  const {x, z, [dataSymbol]: grassChunkMesh} = chunk;
                  worker.requestUngenerate(x, z);

                  // stage.remove('main', grassChunkMesh);
                  grassMesh.renderList.splice(grassMesh.renderList.indexOf(grassChunkMesh.renderListEntry), 1);

                  grassChunkMeshes[_getChunkIndex(x, z)] = null;

                  grassChunkMesh.destroy();

                  _next();
                } else {
                  queue.push(_removeChunk.bind(this, chunk));
                }
              };

              /* const _debouncedRefreshLightmaps = _debounce(next => {
                (() => {
                  let wordOffset = 0;
                  const uint32Array = new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset);
                  const int32Array = new Int32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset);
                  wordOffset++;

                  let numLightmaps = 0;
                  for (const index in grassChunkMeshes) {
                    const trackedGrassChunkMeshes = grassChunkMeshes[index];

                    if (trackedGrassChunkMeshes) {
                       const {offset: {x, y}} = trackedGrassChunkMeshes;

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

                    const trackedGrassChunkMeshes = grassChunkMeshes[_getChunkIndex(x, z)];
                    if (trackedGrassChunkMeshes) {
                      if (newSkyLightmaps.length > 0) {
                        const {index, skyLightmaps} = trackedGrassChunkMeshes;
                        skyLightmaps.set(newSkyLightmaps);
                        renderer.updateAttribute(grassMesh.geometry.attributes.skyLightmap, index * skyLightmaps.length, newSkyLightmaps.length, false);
                      }
                      if (newTorchLightmaps.length > 0) {
                        const {index, torchLightmaps} = trackedGrassChunkMeshes;
                        torchLightmaps.set(newTorchLightmaps);
                        renderer.updateAttribute(grassMesh.geometry.attributes.torchLightmap, index * torchLightmaps.length, newTorchLightmaps.length, false);
                      }
                    }
                  }

                  lightmapBuffer = newLightmapBuffer;

                  next();
                });
              }); */

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

                    const trackedGrassChunkMeshes = grassChunkMeshes[index];
                    if (trackedGrassChunkMeshes) {
                      trackedGrassChunkMeshes.renderListEntry.groups = groups;
                    }
                  }

                  next();
                });
              });

              /* let refreshChunksTimeout = null;
              const _recurseRefreshChunks = () => {
                _debouncedRequestRefreshGrassChunks();
                refreshChunksTimeout = setTimeout(_recurseRefreshChunks, 1000);
              };
              _recurseRefreshChunks(); */
              /* let refreshLightmapsTimeout = null;
              const _recurseRefreshLightmaps = () => {
                _debouncedRefreshLightmaps();
                refreshLightmapsTimeout = setTimeout(_recurseRefreshLightmaps, 2000);
              };
              _recurseRefreshLightmaps(); */
              let refreshCullTimeout = null;
              const _recurseRefreshCull = () => {
                _debouncedRefreshCull();
                refreshCullTimeout = setTimeout(_recurseRefreshCull, 1000 / 30);
              };
              _recurseRefreshCull();

              const _add = chunk => {
                _addChunk(chunk);
              };
              heightfieldElement.on('add', _add);
              const _remove = chunk => {
                _removeChunk(chunk);
              };
              heightfieldElement.on('remove', _remove);

              heightfieldElement.forEachChunk(chunk => {
                _add(chunk);
              });

              const _update = () => {
                const _updateMaterial = () => {
                  const dayNightSkyboxEntity = elements.getEntitiesElement().querySelector(DAY_NIGHT_SKYBOX_PLUGIN);
                  grassMaterial.uniforms.sunIntensity.value =
                    (dayNightSkyboxEntity && dayNightSkyboxEntity.getSunIntensity) ? dayNightSkyboxEntity.getSunIntensity() : 0;
                };
                const _updateMatrices = () => {
                  modelViewMatricesValid.left = false;
                  modelViewMatricesValid.right = false;
                  normalMatricesValid.left = false;
                  normalMatricesValid.right = false;
                  uniformsNeedUpdate.left = true;
                  uniformsNeedUpdate.right = true;
                };

                _updateMaterial();
                _updateMatrices();
              };
              render.on('update', _update);

              this._cleanup = () => {
                scene.remove(grassMesh);

                // clearTimeout(refreshChunksTimeout);
                // clearTimeout(refreshLightmapsTimeout);
                clearTimeout(refreshCullTimeout);

                heightfieldElement.removeListener('add', _add);
                heightfieldElement.removeListener('remove', _remove);

                render.removeListener('update', _update);
              };
            }
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

module.exports = Grass;
