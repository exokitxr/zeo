const {
  NUM_CELLS,
  NUM_CELLS_HEIGHT,

  NUM_CHUNKS_HEIGHT,
  NUM_RENDER_GROUPS,

  HEIGHTFIELD_DEPTH,

  RANGE,

  NUM_POSITIONS_CHUNK,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const dataSymbol = Symbol();

class Generator {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render, pose, input, world, elements, stck, utils: {js: {mod, sbffr}, random: {chnkr}, hash: {murmur}}} = zeo;
    const {THREE, scene, camera, renderer} = three;

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
    const _getObjectId = (x, z, i) => (mod(x, 0xFF) << 24) | (mod(z, 0xFF) << 16) | (i & 0xFFFF);

    const forwardVector = new THREE.Vector3(0, 0, -1);
    const localVector = new THREE.Vector3();
    const localVector2 = new THREE.Vector3();
    const localQuaternion = new THREE.Quaternion();
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

    let terrainGenerateBuffer = new ArrayBuffer(NUM_POSITIONS_CHUNK);
    let objectsGenerateBuffer = new ArrayBuffer(NUM_POSITIONS_CHUNK);
    let voxelBuffer = new ArrayBuffer(NUM_POSITIONS_CHUNK * 4);
    let terrainCullBuffer = new ArrayBuffer(100 * 1024);
    let objectsCullBuffer = new ArrayBuffer(100 * 1024);
    let hoveredObjectsBuffer = new ArrayBuffer(12 * 2 * 4);
    const teleportObjectBuffers = {
      left: new ArrayBuffer((1 + 3 + 3 + 3 + 4 + 4) * 4),
      right: new ArrayBuffer((1 + 3 + 3 + 3 + 4 + 4) * 4),
    };
    let bodyObjectBuffer = new ArrayBuffer(4 * 4);

    const worker = new Worker('archae/plugins/_plugins_generator/build/worker.js');
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
        type: 'getOriginHeight',
        id,
      });
      queues[id] = cb;
    };
    worker.requestGenerate = (x, y, cb) => {
      const id = _makeId();
      worker.postMessage({
        type: 'generate',
        id,
        args: {
          x,
          y,
        },
      });
      queues[id] = cb;
    };
    worker.requestTerrainGenerate = (x, y, index, numPositions, numIndices, cb) => {
      const id = _makeId();
      worker.postMessage({
        type: 'terrainGenerate',
        id,
        args: {
          x,
          y,
          index,
          numPositions,
          numIndices,
          buffer: terrainGenerateBuffer,
        },
      }, [terrainGenerateBuffer]);
      queues[id] = newGenerateBuffer => {
        terrainGenerateBuffer = newGenerateBuffer;

        cb(newGenerateBuffer);
      };
    };
    worker.requestObjectsGenerate = (x, z, index, numPositions, numObjectIndices, numIndices, cb) => {
      const id = _makeId();
      worker.postMessage({
        type: 'objectsGenerate',
        id,
        args: {
          x,
          z,
          index,
          numPositions,
          numObjectIndices,
          numIndices,
          buffer: objectsGenerateBuffer,
        },
      }, [objectsGenerateBuffer]);
      queues[id] = newGenerateBuffer => {
        objectsGenerateBuffer = newGenerateBuffer;

        cb(newGenerateBuffer);
      };
    };
    worker.requestUngenerate = (x, z) => {
      worker.postMessage({
        type: 'ungenerate',
        args: {
          x,
          z,
        },
      });
    };
    worker.requestRegisterObject = (n, added, removed, updated, set, clear) => {
      worker.postMessage({
        type: 'registerObject',
        n,
        added,
        removed,
        updated,
        set,
        clear,
      });
    };
    worker.requestUnregisterObject = (n, added, removed, updated, set, clear) => {
      worker.postMessage({
        type: 'unregisterObject',
        n,
        added,
        removed,
        updated,
        set,
        clear,
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
    worker.requestSetBlock = (x, y, z, v) => {
      worker.postMessage({
        type: 'setBlock',
        name,
        x,
        y,
        z,
        v,
      });
    };
    worker.requestClearBlock = (x, y, z) => {
      worker.postMessage({
        type: 'clearBlock',
        x,
        y,
        z,
      });
    };
    worker.requestTerrainCull = (hmdPosition, projectionMatrix, matrixWorldInverse, cb) => {
      const id = _makeId();
      worker.postMessage({
        type: 'terrainCull',
        id,
        args: {
          hmdPosition: hmdPosition.toArray(localArray3),
          projectionMatrix: projectionMatrix.toArray(localArray16),
          matrixWorldInverse: matrixWorldInverse.toArray(localArray162),
          buffer: terrainCullBuffer,
        },
      }, [terrainCullBuffer]);
      terrainCullBuffer = null;

      queues[id] = buffer => {
        terrainCullBuffer = buffer;
        cb(buffer);
      };
    };
    worker.requestObjectsCull = (hmdPosition, projectionMatrix, matrixWorldInverse, cb) => {
      const id = _makeId();
      worker.postMessage({
        type: 'objectsCull',
        id,
        args: {
          hmdPosition: hmdPosition.toArray(localArray3),
          projectionMatrix: projectionMatrix.toArray(localArray16),
          matrixWorldInverse: matrixWorldInverse.toArray(localArray162),
          buffer: objectsCullBuffer,
        },
      }, [objectsCullBuffer]);
      objectsCullBuffer = null;

      queues[id] = buffer => {
        objectsCullBuffer = buffer;
        cb(buffer);
      };
    };
    worker.requestHoveredObjects = cb => {
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
    worker.requestTeleportObject = (position, side, cb) => {
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
    worker.requestBodyObject = (position, cb) => {
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
    worker.requestSubVoxel = (x, y, z, gslots, cb) => {
      const id = _makeId();
      worker.postMessage({
        type: 'subVoxel',
        id,
        args: {
          position: [x, y, z],
          gslots,
          buffer: voxelBuffer,
        },
      }, [voxelBuffer]);
      queues[id] = newTerrainBuffer => {
        voxelBuffer = newTerrainBuffer;

        cb(newTerrainBuffer);
      };
    };
    /* worker.respond = (id, result, transfers) => {
      worker.postMessage({
        type: 'response',
        id,
        result,
      }, transfers);
    }; */
    worker.onmessage = e => {
      const {data} = e;
      const {type, args} = data;

      if (type === 'response') {
        const [id] = args;
        const {result} = data;

        queues[id](result);
        queues[id] = null;

        _cleanupQueues();
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
        const [n, x, z, objectIndex] = args;

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
        console.warn('generator got unknown worker message type:', JSON.stringify(type));
      }
    };

    const listeners = {};
    const _emit = (event, data) => {
      const entry = listeners[event];
      if (entry) {
        for (let i = 0; i < entry.length; i++) {
          entry[i](data);
        }
      }
    };

    const generatorEntity = {
      entityAddedCallback(generatorElement) {
        generatorElement.on = (event, listener) => {
          let entry = listeners[event];
          if (!entry) {
            entry = [];
            listeners[event] = entry;
          }
          entry.push(listener);
        };
        generatorElement.removeListener = (event, listener) => {
          const entry = listeners[event];
          entry.splice(entry.indexOf(listener), 1);
        };

        /* generatorElement.getChunk = (x, z) => chunker.getChunk(x, z);
        generatorElement.getElevation = _getElevation;
        generatorElement.getBestElevation = _getBestElevation; */
        generatorElement.forEachChunk = fn => {
          for (const index in chunker.chunks) {
            fn(chunker.chunks[index]);
          }
        };

        generatorElement.getTextureAtlas = () => textureAtlas;
        generatorElement.requestOriginHeight = cb => {
          worker.requestOriginHeight(cb);
        };
        generatorElement.requestTerrainGenerate = (x, z, index, numPositions, numIndices, cb) => {
          worker.requestTerrainGenerate(x, z, index, numPositions, numIndices, buffer => {
            cb(protocolUtils.parseTerrainRenderChunk(buffer));
          });
        };
        generatorElement.requestObjectsGenerate = (x, z, index, numPositions, numObjectIndices, numIndices, cb) => {
          worker.requestObjectsGenerate(x, z, index, numPositions, numObjectIndices, numIndices, buffer => {
            cb(protocolUtils.parseWorker(buffer));
          });
        };
        generatorElement.requestSubVoxel = (x, y, z, gslots, cb) => {
          worker.requestSubVoxel(x, y, z, gslots, cb);
        };
        generatorElement.requestAddObject = (name, position, rotation, value) => {
          worker.requestAddObject(name, position, rotation, value);
        };
        generatorElement.requestRemoveObject = (x, z, objectIndex) => {
          worker.requestRemoveObject(x, z, objectIndex);
        };
        generatorElement.setData = (x, z, objectIndex, value) => {
          worker.requestSetObjectData(x, z, objectIndex, value);
        }
        generatorElement.getObjectApi = n => objectApis[n];
        generatorElement.registerObject = objectApi => {
          const n = murmur(objectApi.object);
          objectApis[n] = objectApi;

          worker.requestRegisterObject(
            n,
            Boolean(objectApi.addedCallback),
            Boolean(objectApi.removedCallback),
            Boolean(objectApi.updateCallback),
            Boolean(objectApi.setCallback),
            Boolean(objectApi.clearCallback)
          );
        };
        generatorElement.unregisterObject = objectApi => {
          const n = murmur(objectApi.object);
          objectApis[n] = null;

          worker.requestUnregisterObject(
            n,
            Boolean(objectApi.addedCallback),
            Boolean(objectApi.removedCallback),
            Boolean(objectApi.updateCallback),
            Boolean(objectApi.setCallback),
            Boolean(objectApi.clearCallback)
          );
        };
        generatorElement.setBlock = (x, y, z, block) => {
          worker.requestSetBlock(x, y, z, murmur(block));
        };
        generatorElement.clearBlock = (x, y, z) => {
          worker.requestClearBlock(x, y, z);
        };
        generatorElement.requestTerrainCull = (hmdPosition, projectionMatrix, matrixWorldInverse, cb) => {
          worker.requestTerrainCull(hmdPosition, projectionMatrix, matrixWorldInverse, buffer => {
            cb(protocolUtils.parseTerrainCull(buffer));
          });
        };
        generatorElement.requestObjectsCull = (hmdPosition, projectionMatrix, matrixWorldInverse, cb) => {
          worker.requestObjectsCull(hmdPosition, projectionMatrix, matrixWorldInverse, buffer => {
            cb(protocolUtils.parseObjectsCull(buffer));
          });
        };
        generatorElement.requestHoveredObjects = cb => {
          worker.requestHoveredObjects(cb);
        };
        generatorElement.requestTeleportObject = cb => {
          worker.requestTeleportObject(cb);
        };
        generatorElement.requestBodyObject = (position, cb) => {
          worker.requestBodyObject(position, cb);
        };
      },
    };
    elements.registerEntity(this, generatorEntity);

    const chunker = chnkr.makeChunker({
      resolution: NUM_CELLS,
      range: RANGE,
    });

    let mapChunkMeshes = {};
    const objectApis = {};

    const _requestGenerate = (x, z, cb) => {
      worker.requestGenerate(x, z, cb);
    };
    const _maybeGcMapChunkMeshes = (() => {
      let numGcs = 0;
      return () => {
        if (++numGcs === 16) {
          const newMapChunkMeshes = {};
          for (const index in mapChunkMeshes) {
            const mapChunkMesh = mapChunkMeshes[index];
            if (mapChunkMesh) {
              newMapChunkMeshes[index] = mapChunkMesh;
            }
          }
          mapChunkMeshes = newMapChunkMeshes;

          numGcs = 0;
        }
      };
    })();
    const _debouncedRequestRefreshMapChunks = _debounce(nextDebounce => {
      const {hmd} = pose.getStatus();
      const {worldPosition: hmdPosition} = hmd;
      const {added, removed, done} = chunker.update(hmdPosition.x, hmdPosition.z);

      let running = false;
      const queue = [];
      const nextAddChunk = () => {
        running = false;

        if (queue.length > 0) {
          _addChunk(queue.shift());
        } else {
          doneAddChunks();
        }
      };
      const doneAddChunks = () => {
        if (!done) {
          _debouncedRequestRefreshMapChunks();
        }

        nextDebounce();
      };
      const _addChunk = chunk => {
        if (!running) {
          running = true;

          const {x, z, lod} = chunk;
          const index = _getChunkIndex(x, z);
          const oldMapChunkMesh = mapChunkMeshes[index];
          if (oldMapChunkMesh) {
            _emit('remove', oldMapChunkMesh);

            mapChunkMeshes[index] = null;

            _maybeGcMapChunkMeshes();
          }

          _requestGenerate(x, z, () => {
            mapChunkMeshes[index] = true;

            _emit('add', chunk);

            nextAddChunk();
          });
        } else {
          queue.push(chunk);
        }
      };
      if (removed.length > 0) {
        for (let i = 0; i < removed.length; i++) {
          const chunk = removed[i];
          const {x, z} = chunk;

          worker.requestUngenerate(x, z);

          mapChunkMeshes[_getChunkIndex(x, z)] = null;

          _maybeGcMapChunkMeshes();

          _emit('remove', chunk);
        }
      }
      for (let i = 0; i < added.length; i++) {
        _addChunk(added[i]);
      }

      if (!running) {
        doneAddChunks();
      }
    });

    let refreshChunksTimeout = null;
    const _recurseRefreshChunks = () => {
      const {hmd: {worldPosition: hmdPosition}} = pose.getStatus();
      _debouncedRequestRefreshMapChunks();
      refreshChunksTimeout = setTimeout(_recurseRefreshChunks, 1000);
    };
    _recurseRefreshChunks();

    this._cleanup = () => {
      elements.unregisterEntity(this, heightfieldEntity);

      clearTimeout(refreshChunksTimeout);
    };
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

module.exports = Generator;
