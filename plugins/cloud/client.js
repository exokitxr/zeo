const {
  NUM_CELLS,

  RANGE,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS_CHUNK = 100 * 1024;
const CLOUD_SPEED = 1;
const DAY_NIGHT_SKYBOX_PLUGIN = 'day-night-skybox';

const CLOUD_SHADER = {
  uniforms: {
    /* worldTime: {
      type: 'f',
      value: 0,
    }, */
    sunIntensity: {
      type: 'f',
      value: 0,
    },
  },
  vertexShader: `\
// uniform float worldTime;
varying vec3 vN;
varying vec3 vP;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, position.y, position.z, 1.0);
  vN = normal;
  vP = normalize(vec3(position.x, 0.0, position.z));
}
`,
  fragmentShader: `\
uniform float sunIntensity;
varying vec3 vN;
varying vec3 vP;

void main() {
  gl_FragColor = vec4(vec3(0.2 + (1.0 * sunIntensity) + (0.1 + (0.4 * sunIntensity)) * dot(vN, vP)), 0.8);
}
`
};

class Cloud {
  mount() {
    const {three, elements, render, pose, /*stage, */utils: {js: {mod, sbffr}, geometry: geometryUtils, random: {alea, chnkr}}} = zeo;
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
          name: 'normals',
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
    const cloudObject = (() => {
      const {positions, normals, indices} = geometryBuffer.getAll();

      const geometry = new THREE.BufferGeometry();
      const positionAttribute = new THREE.BufferAttribute(positions, 3);
      positionAttribute.dynamic = true;
      geometry.addAttribute('position', positionAttribute);
      const normalAttribute = new THREE.BufferAttribute(normals, 3);
      normalAttribute.dynamic = true;
      geometry.addAttribute('normal', normalAttribute);
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
    scene.add(cloudObject);

    const cloudMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(CLOUD_SHADER.uniforms),
      vertexShader: CLOUD_SHADER.vertexShader,
      fragmentShader: CLOUD_SHADER.fragmentShader,
      transparent: true,
      // depthWrite: false,
    });
    cloudMaterial.uniformsNeedUpdate = _uniformsNeedUpdate;

    let generateBuffer = new ArrayBuffer(NUM_POSITIONS_CHUNK);
    let cullBuffer = new ArrayBuffer(4096);
    const worker = new Worker('archae/plugins/cloud/build/worker.js');
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
        console.warn('cloud got unknown worker message type:', JSON.stringify(type));
      }
    };

    const _requestCloudGenerate = (x, y, cb) => {
      worker.requestGenerate(x, y, cloudChunkBuffer => {
        cb(protocolUtils.parseCloudGeometry(cloudChunkBuffer));
      });
    };

    const updates = [];

    const cloudEntity = { // XXX make this a non-entity
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

        const cloudChunkMeshes = {};
        const _makeCloudChunkMesh = (chunk, cloudChunkData) => {
          const {x, z} = chunk;
          const {positions: newPositions, normals: newNormals, indices: newIndices} = cloudChunkData;

          // geometry

          const gbuffer = geometryBuffer.alloc();
          const {index, slices: {positions, normals, indices}} = gbuffer;

          if (newPositions.length > 0) {
            positions.set(newPositions);
            renderer.updateAttribute(cloudObject.geometry.attributes.position, index * positions.length, newPositions.length, false);

            normals.set(newNormals);
            renderer.updateAttribute(cloudObject.geometry.attributes.normal, index * normals.length, newNormals.length, false);

            const positionOffset = index * (positions.length / 3);
            for (let i = 0; i < newIndices.length; i++)  {
              indices[i] = newIndices[i] + positionOffset; // XXX do this in the worker
            }
            renderer.updateAttribute(cloudObject.geometry.index, index * indices.length, newIndices.length, true);
          }

          const mesh = {
            indexOffset: index * indices.length,
            renderListEntry: {
              object: cloudObject,
              material: cloudMaterial,
              groups: [],
            },
            destroy: () => {
              geometryBuffer.free(gbuffer);
            },
          };

          return mesh;
        };

        let running = false;
        const queue = [];
        const _debouncedRequestRefreshCloudChunks = _debounce(next => {
          const {hmd} = pose.getStatus();
          const {worldPosition: hmdPosition} = hmd;
          // const dx = (world.getWorldTime() / 1000) * CLOUD_SPEED;
          const {added, removed} = chunker.update(hmdPosition.x/* + dx*/, hmdPosition.z);

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

              _requestCloudGenerate(chunk.x, chunk.z, cloudChunkData => {
                const cloudChunkMesh = _makeCloudChunkMesh(chunk, cloudChunkData);
                // stage.add('main', cloudChunkMesh);
                cloudObject.renderList.push(cloudChunkMesh.renderListEntry);

                cloudChunkMeshes[_getChunkIndex(chunk.x, chunk.z)] = cloudChunkMesh;

                chunk.data = cloudChunkMesh;

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
            const {x, z, data: cloudChunkMesh} = chunk;

            worker.requestUngenerate(x, z);

            // stage.remove('main', cloudChunkMesh);
            cloudObject.renderList.splice(cloudObject.renderList.indexOf(cloudChunkMesh.renderListEntry), 1);

            cloudChunkMesh.destroy();

            cloudChunkMeshes[_getChunkIndex(x, z)] = null;
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

              const trackedCloudChunkMeshes = cloudChunkMeshes[index];
              if (trackedCloudChunkMeshes) {
                for (let j = 0; j < groups.length; j++) {
                  groups[j].start += trackedCloudChunkMeshes.indexOffset; // XXX do this reindexing in the worker
                }
                trackedCloudChunkMeshes.renderListEntry.groups = groups;
              }
            }

            next();
          });
        });

        let refreshChunksTimeout = null;
        const _recurseRefreshChunks = () => {
          _debouncedRequestRefreshCloudChunks();
          refreshChunksTimeout = setTimeout(_recurseRefreshChunks, 1000);
        };
        _recurseRefreshChunks();
        let refreshCullTimeout = null;
        const _recurseRefreshCull = () => {
          _debouncedRefreshCull();
          refreshCullTimeout = setTimeout(_recurseRefreshCull, 1000 / 30);
        };
        _recurseRefreshCull();

        const update = () => {
          const _updateSunIntensity = () => {
            const dayNightSkyboxEntity = elements.getEntitiesElement().querySelector(DAY_NIGHT_SKYBOX_PLUGIN);
            const sunIntensity = (dayNightSkyboxEntity && dayNightSkyboxEntity.getSunIntensity) ? dayNightSkyboxEntity.getSunIntensity() : 0;

            // cloudMaterial.uniforms.worldTime.value = world.getWorldTime();
            cloudMaterial.uniforms.sunIntensity.value = sunIntensity;
          };
          const _updateMatrices = () => {
            modelViewMatricesValid.left = false;
            modelViewMatricesValid.right = false;
            normalMatricesValid.left = false;
            normalMatricesValid.right = false;
            uniformsNeedUpdate.left = true;
            uniformsNeedUpdate.right = true;
          };

          _updateSunIntensity();
          _updateMatrices();
        };
        updates.push(update);

        entityElement._cleanup = () => {
          clearTimeout(refreshChunksTimeout);
          clearTimeout(refreshCullTimeout);

          for (const index in cloudChunkMeshes) {
            const cloudChunkMesh = cloudChunkMeshes[index];
            if (cloudChunkMesh) {
              // stage.remove('main', cloudChunkMesh);
              cloudObject.renderList.splice(cloudObject.renderList.indexOf(cloudChunkMesh.renderListEntry), 1);
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
            const {cloudsMesh} = entityElement;

            cloudsMesh.position.set(newValue[0], newValue[1], newValue[2]);
            cloudsMesh.quaternion.set(newValue[3], newValue[4], newValue[5], newValue[6]);
            cloudsMesh.scale.set(newValue[7], newValue[8], newValue[9]);

            break;
          }
        }
      },
    };
    elements.registerEntity(this, cloudEntity);

    const _update = () => {
      for (let i = 0; i < updates.length; i++) {
        const update = updates[i];
        update();
      }
    };
    render.on('update', _update);

    this._cleanup = () => {
      scene.remove(cloudObject);

      elements.unregisterEntity(this, cloudEntity);

      render.removeListener('update', _update);
    };
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

module.exports = Cloud;
