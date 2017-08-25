const {
  NUM_CELLS,

  NUM_CELLS_HEIGHT,

  RANGE,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS_CHUNK = 200 * 1024;
const LIGHTMAP_BUFFER_SIZE = 100 * 1024 * 4;
const NUM_BUFFERS = RANGE * RANGE * 9;
const TEXTURE_SIZE = 1024;
const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
const LIGHTMAP_PLUGIN = 'plugins-lightmap';
const DAY_NIGHT_SKYBOX_PLUGIN = 'plugins-day-night-skybox';

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
    }, */
    d: {
      type: 'v2',
      value: null,
    },
    /* sunIntensity: {
      type: 'f',
      value: 0,
    }, */
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
attribute float lightmap;

varying vec3 vPosition;
varying vec2 vUv;
varying float vLightmap;

void main() {
  vUv = uv;

  vec4 mvPosition = modelViewMatrix * vec4( position.xyz, 1.0 );
  gl_Position = projectionMatrix * mvPosition;

	vPosition = position.xyz;

  vLightmap = lightmap;
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
uniform vec2 d;
// uniform float sunIntensity;

varying vec3 vPosition;
varying vec2 vUv;
varying float vLightmap;

void main() {
  vec4 diffuseColor = texture2D( map, vUv );

  vec3 lightColor = vec3(floor(vLightmap * 4.0 + 0.5) / 4.0);
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
    const {three, render, pose, elements, /*stage, */utils: {js: {mod, bffr, sbffr}, random: {chnkr}}} = zeo;
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

    const localArray3 = Array(3);
    const localArray16 = Array(16);
    const localArray162 = Array(16);

    let live = true;
    this._cleanup = () => {
      live  = false;
    };

    const _ensureHeightfieldElement = () => elements.requestElement(HEIGHTFIELD_PLUGIN)
      .then(() => {});

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
      for (const index in grassChunkMeshes) {
        const grassChunkMesh = grassChunkMeshes[index];
        if (grassChunkMesh) {
          _bindLightmap(grassChunkMesh);
        }
      }
    };
    const _unbindLightmaps = () => {
      for (const index in grassChunkMeshes) {
        const grassChunkMesh = grassChunkMeshes[index];
        if (grassChunkMesh && grassChunkMesh.lightmap) {
          _unbindLightmap(grassChunkMesh);
        }
      }
    };
    const _bindLightmap = grassChunkMesh => {
      const lightmap = lightmapper.getLightmapAt(grassChunkMesh.offset.x * NUM_CELLS, grassChunkMesh.offset.y * NUM_CELLS);
      grassChunkMesh.material.uniforms.lightMap.value = lightmap.texture;
      grassChunkMesh.material.uniforms.useLightMap.value = 1;
      grassChunkMesh.lightmap = lightmap;
    };
    const _unbindLightmap = grassChunkMesh => {
      const {lightmap} = grassChunkMesh;
      lightmapper.releaseLightmap(lightmap);
      grassChunkMesh.material.uniforms.lightMap.value = null;
      grassChunkMesh.material.uniforms.useLightMap.value = 0;
      grassChunkMesh.lightmap = null;
    };
    const elementListener = elements.makeListener(LIGHTMAP_PLUGIN); // XXX clean this up properly
    elementListener.on('add', entityElement => {
      _bindLightmapper(entityElement);
    });
    elementListener.on('remove', () => {
      _unbindLightmapper();
    });

    const buffers = bffr(NUM_POSITIONS_CHUNK, NUM_BUFFERS);
    let lightmapBuffer = new Uint8Array(LIGHTMAP_BUFFER_SIZE * NUM_BUFFERS);
    let cullBuffer = new ArrayBuffer(4096);
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
    worker.requestGenerate = (x, y, cb) => {
      _ensureHeightfieldElement()
        .then(() => new Promise((accept, reject) => {
          const id = _makeId();
          const buffer = buffers.alloc();
          worker.postMessage({
            type: 'generate',
            id,
            x,
            y,
            buffer,
          }, [buffer]);
          queues[id] = cb;
        }));
    };
    worker.requestUngenerate = (x, y) => {
      worker.postMessage({
        type: 'ungenerate',
        x,
        y,
      });
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
    worker.requestTexture = cb => {
      const id = _makeId();
      const buffer = new ArrayBuffer(TEXTURE_SIZE * TEXTURE_SIZE  * 4);
      worker.postMessage({
        type: 'texture',
        id,
        buffer,
      }, [buffer]);
      queues[id] = buffer => {
        const canvas = document.createElement('canvas');
        canvas.width = TEXTURE_SIZE;
        canvas.height = TEXTURE_SIZE;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        imageData.data.set(new Uint8Array(buffer));
        ctx.putImageData(imageData, 0, 0);

        cb(canvas);
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
        } else if (method === 'heightfield') {
          const [id, x, y] = args;
          const {buffer} = data;

          const heightfieldElement = elements.getEntitiesElement().querySelector(HEIGHTFIELD_PLUGIN);
          if (heightfieldElement) {
            heightfieldElement.requestHeightfield(x, y, buffer, heightfield => {
              worker.requestResponse(id, heightfield, [heightfield.buffer]);
            });
          } else {
            const heightfield = new Float32Array(buffer, 0, (NUM_CELLS + 1) * (NUM_CELLS + 1));
            heightfield.fill(0);
            worker.requestResponse(id, buffer, [buffer]);
          }
        } else {
          console.warn('grass got unknown worker response method type:', JSON.stringify(method));
        }
      } else {
        console.warn('grass got unknown worker message type:', JSON.stringify(type));
      }
    };
    const _requestTexture = () => new Promise((accept, reject) => {
      worker.requestTexture(canvas => {
        accept(canvas);
      });
    });

    _requestTexture()
      .then(mapTextureImg => {
        if (live) {
          const mapTexture = new THREE.Texture(
            mapTextureImg,
            THREE.UVMapping,
            THREE.ClampToEdgeWrapping,
            THREE.ClampToEdgeWrapping,
            THREE.NearestMipMapLinearFilter,
            THREE.NearestMipMapLinearFilter,
            THREE.RGBAFormat,
            THREE.UnsignedByteType,
            16
          );
          mapTexture.needsUpdate = true;

          const _requestGrassGenerate = (x, y) => new Promise((accept, reject) => {
            worker.requestGenerate(x, y, grassChunkBuffer => {
              accept(protocolUtils.parseGrassGeometry(grassChunkBuffer));
            });
          });
          const _makeGrassChunkMesh = (chunk, grassChunkData) => {
            const {x, z} = chunk;
            const {positions: newPositions, uvs: newUvs, lightmaps: newLightmaps, indices: newIndices} = grassChunkData;

            // geometry

            const gbuffer = geometryBuffer.alloc();
            const {index, slices: {positions, uvs, lightmaps, indices}} = gbuffer;

            if (newPositions.length > 0) {
              positions.set(newPositions);
              renderer.updateAttribute(grassMesh.geometry.attributes.position, index * positions.length, newPositions.length, false);

              uvs.set(newUvs);
              renderer.updateAttribute(grassMesh.geometry.attributes.uv, index * uvs.length, newUvs.length, false);

              lightmaps.set(newLightmaps);
              renderer.updateAttribute(grassMesh.geometry.attributes.lightmap, index * lightmaps.length, newLightmaps.length, false);

              const positionOffset = index * (positions.length / 3);
              for (let i = 0; i < newIndices.length; i++)  {
                indices[i] = newIndices[i] + positionOffset; // XXX do this in the worker
              }
              renderer.updateAttribute(grassMesh.geometry.index, index * indices.length, newIndices.length, true);
            }

            // material

            const uniforms = Object.assign(
              THREE.UniformsUtils.clone(THREE.UniformsLib.lights),
              THREE.UniformsUtils.clone(GRASS_SHADER.uniforms)
            );
            uniforms.map.value = mapTexture;
            uniforms.d.value = new THREE.Vector2(x * NUM_CELLS, z * NUM_CELLS);
            const material = new THREE.ShaderMaterial({
              uniforms: uniforms,
              vertexShader: GRASS_SHADER.vertexShader,
              fragmentShader: GRASS_SHADER.fragmentShader,
              lights: true,
              side: THREE.DoubleSide,
            });
            material.uniformsNeedUpdate = _uniformsNeedUpdate;

            const mesh = {
              material,
              renderListEntry: {
                object: grassMesh,
                material: material,
                groups: [],
              },
              index,
              indexOffset: index * indices.length,
              offset: new THREE.Vector2(x, z),
              lightmaps,
              lightmap: null,
              destroy: () => {
                buffers.free(grassChunkData.buffer);
                geometryBuffer.free(gbuffer);

                material.dispose();

                if (mesh.lightmap) {
                  _unbindLightmap(mesh);
                }
              },
            };
            if (lightmapper && chunk.lod === 1) {
              // _bindLightmap(mesh);
            }

            return mesh;
          };

          const chunker = chnkr.makeChunker({
            resolution: NUM_CELLS,
            range: RANGE,
          });
          const grassChunkMeshes = {};

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
                name: 'lightmaps',
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
          const grassMesh = (() => {
            const {positions, uvs, lightmaps, indices} = geometryBuffer.getAll();

            const geometry = new THREE.BufferGeometry();
            const positionAttribute = new THREE.BufferAttribute(positions, 3);
            positionAttribute.dynamic = true;
            geometry.addAttribute('position', positionAttribute);
            const uvAttribute = new THREE.BufferAttribute(uvs, 2);
            uvAttribute.dynamic = true;
            geometry.addAttribute('uv', uvAttribute);
            const lightmapAttribute = new THREE.BufferAttribute(lightmaps, 1, true);
            lightmapAttribute.dynamic = true;
            geometry.addAttribute('lightmap', lightmapAttribute);
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
          scene.add(grassMesh);

          const _debouncedRequestRefreshGrassChunks = _debounce(next => {
            const {hmd} = pose.getStatus();
            const {worldPosition: hmdPosition} = hmd;
            const {added, removed, relodded} = chunker.update(hmdPosition.x, hmdPosition.z);

            const addedPromises = Array(added.length);
            let index = 0;
            for (let i = 0; i < added.length; i++) {
              const chunk = added[i];
              const {x, z} = chunk;

              const promise = _requestGrassGenerate(x, z)
                .then(grassChunkData => {
                  const grassChunkMesh = _makeGrassChunkMesh(chunk, grassChunkData);
                  // stage.add('main', grassChunkMesh);
                  grassMesh.renderList.push(grassChunkMesh.renderListEntry);

                  grassChunkMeshes[_getChunkIndex(x, z)] = grassChunkMesh;

                  chunk.data = grassChunkMesh;
                });
              addedPromises[index++] = promise;
            }
            for (let i = 0; i < relodded.length; i++) {
              const chunk = relodded[i];
              const {lod, data: grassChunkMesh} = chunk;

              if (!grassChunkMesh.lightmap && lod === 1) {
                // _bindLightmap(grassChunkMesh);
              } else if (grassChunkMesh.lightmap && lod !== 1) {
                // _unbindLightmap(grassChunkMesh);
              }
            }
            for (let i = 0; i < removed.length; i++) {
              const chunk = removed[i];
              const {x, z, data: grassChunkMesh} = chunk;

              worker.requestUngenerate(x, z);

              // stage.remove('main', grassChunkMesh);
              grassMesh.renderList.splice(grassMesh.renderList.indexOf(grassChunkMesh.renderListEntry), 1);

              grassChunkMeshes[_getChunkIndex(x, z)] = null;

              grassChunkMesh.destroy();
            }

            Promise.all(addedPromises)
              .then(() => {
                next();
              })
              .catch(err => {
                console.warn(err);
                next();
              });
          });

          const _debouncedRefreshLightmaps = _debounce(next => {
            const requestGrassChunkMeshes = [];
            for (const index in grassChunkMeshes) {
              const trackedGrassChunkMeshes = grassChunkMeshes[index];

              if (trackedGrassChunkMeshes) {
                requestGrassChunkMeshes.push(trackedGrassChunkMeshes);
              }
            }

            let byteOffset = 0;
            new Uint32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 1)[0] = requestGrassChunkMeshes.length;
            byteOffset += 4;

            for (let i = 0; i < requestGrassChunkMeshes.length; i++) {
              const trackedGrassChunkMeshes = requestGrassChunkMeshes[i];
              const {offset: {x, y}} = trackedGrassChunkMeshes;

              const lightmapRequestHeaderBuffer = new Int32Array(lightmapBuffer.buffer, lightmapBuffer.byteOffset + byteOffset, 2);
              lightmapRequestHeaderBuffer[0] = x;
              lightmapRequestHeaderBuffer[1] = y;
              byteOffset += 4 * 2;
            }

            worker.requestLightmaps(lightmapBuffer, newLightmapBuffer => {
              let byteOffset = 0;
              for (let i = 0; i < requestGrassChunkMeshes.length; i++) {
                const lightmapsLength = new Uint32Array(newLightmapBuffer.buffer, newLightmapBuffer.byteOffset + byteOffset, 1)[0];
                byteOffset += 4;

                const newLightmaps = new Uint8Array(newLightmapBuffer.buffer, newLightmapBuffer.byteOffset + byteOffset, lightmapsLength);
                byteOffset += lightmapsLength;
                const alignDiff = byteOffset % 4;
                if (alignDiff > 0) {
                  byteOffset += 4 - alignDiff;
                }

                if (newLightmaps.length > 0) {
                  const trackedGrassChunkMeshes = requestGrassChunkMeshes[i];
                  const {index, lightmaps} = trackedGrassChunkMeshes;
                  lightmaps.set(newLightmaps);
                  renderer.updateAttribute(grassMesh.geometry.attributes.lightmap, index * lightmaps.length, newLightmaps.length, false);
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

                const trackedGrassChunkMeshes = grassChunkMeshes[index];
                if (trackedGrassChunkMeshes) {
                  for (let j = 0; j < groups.length; j++) {
                    groups[j].start += trackedGrassChunkMeshes.indexOffset; // XXX do this reindexing in the worker
                  }
                  trackedGrassChunkMeshes.renderListEntry.groups = groups;
                }
              }

              next();
            });
          });

          let refreshChunksTimeout = null;
          const _recurseRefreshChunks = () => {
            _debouncedRequestRefreshGrassChunks();
            refreshChunksTimeout = setTimeout(_recurseRefreshChunks, 1000);
          };
          _recurseRefreshChunks();
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

          const _update = () => {
            /* const _updateSunIntensity = () => {
              const dayNightSkyboxEntity = elements.getEntitiesElement().querySelector(DAY_NIGHT_SKYBOX_PLUGIN);
              const sunIntensity = (dayNightSkyboxEntity && dayNightSkyboxEntity.getSunIntensity) ? dayNightSkyboxEntity.getSunIntensity() : 0;

              for (const index in grassChunkMeshes) {
                const grassChunkMesh = grassChunkMeshes[index];
                if (grassChunkMesh) {
                  grassChunkMesh.material.uniforms.sunIntensity.value = sunIntensity;
                }
              }
            }; */
            const _updateMatrices = () => {
              modelViewMatricesValid.left = false;
              modelViewMatricesValid.right = false;
              normalMatricesValid.left = false;
              normalMatricesValid.right = false;
              uniformsNeedUpdate.left = true;
              uniformsNeedUpdate.right = true;
            };

            // _updateSunIntensity();
            _updateMatrices();
          };
          render.on('update', _update);

          this._cleanup = () => {
            scene.remove(grassMesh);

            clearTimeout(refreshChunksTimeout);
            clearTimeout(refreshLightmapsTimeout);
            clearTimeout(refreshCullTimeout);

            elements.destroyListener(elementListener);

            render.removeListener('update', _update);
          };
        }
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
