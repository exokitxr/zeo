const {
  NUM_CELLS,

  RANGE,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS_CHUNK = 30 * 1024;
const DAY_NIGHT_SKYBOX_PLUGIN = 'day-night-skybox';

class Ocean {
  mount() {
return;
    const {three, render, elements, pose, world, /*stage, */utils: {js: jsUtils, random: randomUtils, hash: hashUtils}} = zeo;
    const {THREE, scene, camera, renderer} = three;
    const {mod, sbffr} = jsUtils;
    const {chnkr} = randomUtils;

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
        fogColor: {
          type: '3f',
          value: new THREE.Color(),
        },
        fogDensity: {
          type: 'f',
          value: 0,
        },
        sunIntensity: {
          type: 'f',
          value: 0,
        },
      },
      vertexShader: [
        "uniform float worldTime;",
        "attribute vec3 wave;",
        "varying vec2 vUv;",
        "varying float fogDepth;",
        "void main() {",
        "  float ang = wave[0];",
        "  float amp = wave[1];",
        "  float speed = wave[2];",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, position.y + ((sin(ang + (speed * worldTime))) * amp), position.z, 1.0);",
        "  vUv = uv;",
        "  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",
        "  fogDepth = -mvPosition.z;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "#define PI 3.1415926535897932384626433832795",
        "#define LOG2 1.442695",
        "#define whiteCompliment(a) ( 1.0 - saturate( a ) )",
        "uniform float worldTime;",
        "uniform sampler2D map;",
        "uniform vec3 fogColor;",
        "uniform float fogDensity;",
        "uniform float sunIntensity;",
        "varying vec2 vUv;",
        "varying float fogDepth;",
        "float speed = 2.0;",
        "void main() {",
        "  float animationFactor = (speed - abs(mod(worldTime / 1000.0, speed*2.0) - speed)) / speed;",
        "  float frame1 = mod(floor(animationFactor / 16.0), 1.0);",
        "  float frame2 = mod(frame1 + 1.0/16.0, 1.0);",
        "  float mixFactor = fract(animationFactor / 16.0) * 16.0;",
        "  vec4 diffuseColor = mix(texture2D( map, vUv * vec2(1.0, 1.0 - frame1) ), texture2D( map, vUv * vec2(1.0, 1.0 - frame2) ), mixFactor);",
        "  diffuseColor = vec4((0.2 + 0.8 * sunIntensity) * diffuseColor.xyz, 0.7);",
        "  float fogFactor = whiteCompliment( exp2( - fogDensity * fogDensity * fogDepth * fogDepth * LOG2 ) );",
        "  gl_FragColor = vec4(mix( diffuseColor.rgb, fogColor, fogFactor ), diffuseColor.a);",
        "}"
      ].join("\n")
    };

    const _getChunkIndex = (x, z) => (mod(x, 0xFFFF) << 16) | mod(z, 0xFFFF);

    const localArray3 = Array(3);
    const localArray16 = Array(16);
    const localArray162 = Array(16);

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    let generateBuffer = new ArrayBuffer(NUM_POSITIONS_CHUNK);
    let cullBuffer = new ArrayBuffer(4096);
    const worker = new Worker('archae/plugins/ocean/build/worker.js');
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
      const id = _makeId();
      worker.postMessage({
        type: 'generate',
        id,
        x,
        y,
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
    worker.onmessage = e => {
      const {data} = e;
      const {type, args} = data;

      if (type === 'response') {
        const [id] = args;
        const {result} = data;

        queues[id](result);
        queues[id] = null;

        _cleanupQueues();
      } else {
        console.warn('ocean got unknown worker message type:', JSON.stringify(type));
      }
    };

    const _requestOceanGenerate = (x, z, cb) => {
      worker.requestGenerate(x, z, oceanBuffer => {
        cb(protocolUtils.parseGeometry(oceanBuffer));
      });
    };
    const _requestImg = src => new Promise((accept, reject) => {
      const img = new Image();
      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(err);
      };
      img.src = src;
    });

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
          name: 'waves',
          constructor: Float32Array,
          size: 3 * 3 * 4,
        },
        {
          name: 'indices',
          constructor: Uint32Array,
          size: 3 * 4,
        }
      ]
    );
    const oceanObject = (() => {
      const {positions, uvs, waves, indices} = geometryBuffer.getAll();

      const geometry = new THREE.BufferGeometry();
      const positionAttribute = new THREE.BufferAttribute(positions, 3);
      positionAttribute.dynamic = true;
      geometry.addAttribute('position', positionAttribute);
      const uvAttribute = new THREE.BufferAttribute(uvs, 2);
      uvAttribute.dynamic = true;
      geometry.addAttribute('uv', uvAttribute);
      const waveAttribute = new THREE.BufferAttribute(waves, 3);
      waveAttribute.dynamic = true;
      geometry.addAttribute('wave', waveAttribute);
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
    scene.add(oceanObject);

    return _requestImg('/archae/ocean/img/water.png')
      .then(waterImg => {
        if (live) {
          const texture = new THREE.Texture(
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
          texture.needsUpdate = true;

          const uniforms = THREE.UniformsUtils.clone(OCEAN_SHADER.uniforms);
          uniforms.map.value = texture;
          // uniforms.fogColor.value = scene.fog.color;
          // uniforms.fogDensity.value = scene.fog.density;
          const oceanMaterial = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: OCEAN_SHADER.vertexShader,
            fragmentShader: OCEAN_SHADER.fragmentShader,
            transparent: true,
          });
          oceanMaterial.uniformsNeedUpdate = _uniformsNeedUpdate;

          const updates = [];
          const _update = () => {
            for (let i = 0; i < updates.length; i++) {
              const update = updates[i];
              update();
            }
          };

          const oceanEntity = {
            attributes: {
              position: {
                type: 'matrix',
                value: [
                  0, 0, 0,
                  0, 0, 0, 1,
                  1, 1, 1,
                ],
              },
            },
            entityAddedCallback(entityElement) {
              const chunker = chnkr.makeChunker({
                resolution: NUM_CELLS,
                range: RANGE,
              });
              const oceanChunkMeshes = {};

              const update = () => {
                const _updateMaterial = () => {
                  // oceanMaterial.uniforms.fogColor.value = scene.fog.color;
                  // oceanMaterial.uniforms.fogDensity.value = scene.fog.density;
                  oceanMaterial.uniforms.worldTime.value = world.getWorldTime();

                  const dayNightSkyboxEntity = elements.getEntitiesElement().querySelector(DAY_NIGHT_SKYBOX_PLUGIN);
                  const sunIntensity = (dayNightSkyboxEntity && dayNightSkyboxEntity.getSunIntensity) ? dayNightSkyboxEntity.getSunIntensity() : 0;
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

                _updateMaterial();
                _updateMatrices();
              };
              updates.push(update);

              const _makeOceanChunkMesh = (chunk, oceanChunkData) => {
                const {x, z} = chunk;
                const {positions: newPositions, uvs: newUvs, waves: newWaves, indices: newIndices} = oceanChunkData;

                // geometry

                const gbuffer = geometryBuffer.alloc();
                const {index, slices: {positions, uvs, waves, indices}} = gbuffer;

                if (newPositions.length > 0) {
                  positions.set(newPositions);
                  renderer.updateAttribute(oceanObject.geometry.attributes.position, index * positions.length, newPositions.length, false);

                  uvs.set(newUvs);
                  renderer.updateAttribute(oceanObject.geometry.attributes.uv, index * uvs.length, newUvs.length, false);

                  waves.set(newWaves);
                  renderer.updateAttribute(oceanObject.geometry.attributes.wave, index * waves.length, newWaves.length, false);

                  const positionOffset = index * (positions.length / 3);
                  for (let i = 0; i < newIndices.length; i++)  {
                    indices[i] = newIndices[i] + positionOffset; // XXX do this in the worker
                  }
                  renderer.updateAttribute(oceanObject.geometry.index, index * indices.length, newIndices.length, true);
                }

                // material

                const material = oceanMaterial;

                const mesh = {
                  material,
                  indexOffset: index * indices.length,
                  renderListEntry: {
                    object: oceanObject,
                    material: material,
                    groups: [],
                  },
                  destroy: () => {
                    geometryBuffer.free(gbuffer);
                  },
                };

                return mesh;
              };

              const _debouncedRequestRefreshOceanChunks = _debounce(next => {
                const {hmd} = pose.getStatus();
                const {worldPosition: hmdPosition} = hmd;
                const {added, removed} = chunker.update(hmdPosition.x, hmdPosition.z);

                let running = false;
                const queue = [];
                const _addChunk = chunk => {
                  if (!running) {
                    running = true;

                    const _next = () => {
                      running = false;

                      if (queue.length > 0) {
                        _addChunk(queue.shift());
                      } else {
                        next();
                      }
                    };

                    const {x, z, data: oldOceanChunkMesh} = chunk;
                    const index = _getChunkIndex(x, z);
                    if (oldOceanChunkMesh) {
                      // scene.remove(oldOceanChunkMesh);
                      oceanObject.renderList.splice(oceanObject.renderList.indexOf(oldOceanChunkMesh.renderListEntry), 1);

                      oldOceanChunkMesh.destroy();

                      oceanChunkMeshes[index] = null;
                    }

                    _requestOceanGenerate(x, z, oceanChunkData => {
                      const oceanChunkMesh = _makeOceanChunkMesh(chunk, oceanChunkData);
                      // scene.add(oceanChunkMesh);
                      oceanObject.renderList.push(oceanChunkMesh.renderListEntry);

                      oceanChunkMeshes[index] = oceanChunkMesh;

                      chunk.data = oceanChunkMesh;

                      _next();
                    });
                  } else {
                    queue.push(chunk);
                  }
                };
                for (let i = 0; i < added.length; i++) {
                  _addChunk(added[i]);
                }
                for (let i = 0; i < removed.length; i++) {
                  const chunk = removed[i];
                  const {x, z, data: oceanChunkMesh} = chunk;

                  worker.requestUngenerate(x, z);

                  // scene.remove(oceanChunkMesh);
                  oceanObject.renderList.splice(oceanObject.renderList.indexOf(oceanChunkMesh.renderListEntry), 1);

                  oceanChunkMesh.destroy();

                  oceanChunkMeshes[_getChunkIndex(x, z)] = null;
                }

                if (!running) {
                  next();
                }
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

                    const trackedOceanChunkMeshes = oceanChunkMeshes[index];
                    if (trackedOceanChunkMeshes) {
                      for (let j = 0; j < groups.length; j++) {
                        groups[j].start += trackedOceanChunkMeshes.indexOffset; // XXX do this reindexing in the worker
                      }
                      trackedOceanChunkMeshes.renderListEntry.groups = groups;
                    }
                  }

                  next();
                });
              });

              let refreshChunksTimeout = null;
              const _recurseRefreshChunks = () => {
                _debouncedRequestRefreshOceanChunks();
                refreshChunksTimeout = setTimeout(_recurseRefreshChunks, 1000);
              };
              _recurseRefreshChunks();
              let refreshCullTimeout = null;
              const _recurseRefreshCull = () => {
                _debouncedRefreshCull();
                refreshCullTimeout = setTimeout(_recurseRefreshCull, 1000 / 30);
              };
              _recurseRefreshCull();
            
              entityElement._cleanup = () => {
                clearTimeout(refreshChunksTimeout);
                clearTimeout(refreshCullTimeout);

                for (const index in oceanChunkMeshes) {
                  const oceanChunkMesh = oceanChunkMeshes[index];
                  if (oceanChunkMesh) {
                    // stage.remove('main', oceanMesh);
                    oceanObject.renderList.splice(oceanObject.renderList.indexOf(oceanChunkMesh.renderListEntry), 1);
                  }
                }

                updates.splice(updates.indexOf(update), 1);
              };
            },
            entityRemovedCallback(entityElement) {
              entityElement._cleanup();
            },
            entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
              switch (name) {
                case 'position': {
                  const {mesh} = entityElement;

                  mesh.position.set(newValue[0], newValue[1], newValue[2]);
                  mesh.quaternion.set(newValue[3], newValue[4], newValue[5], newValue[6]);
                  mesh.scale.set(newValue[7], newValue[8], newValue[9]);

                  break;
                }
              }
            },
          };
          elements.registerEntity(this, oceanEntity);

          render.on('update', _update);

          this._cleanup = () => {
            scene.remove(oceanObject);

            worker.terminate();

            elements.unregisterEntity(this, oceanEntity);

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

module.exports = Ocean;
