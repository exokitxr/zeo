const {
  NUM_CELLS,
  NUM_CELLS_HEIGHT,

  HEIGHTFIELD_DEPTH,

  RANGE,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS_CHUNK = 1 * 1024 * 1024;
const LIGHTMAP_PLUGIN = 'plugins-lightmap';
const DAY_NIGHT_SKYBOX_PLUGIN = 'plugins-day-night-skybox';

const HEIGHTFIELD_SHADER = {
  uniforms: {
    lightMap: {
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
    },
    sunIntensity: {
      type: 'f',
      value: 0,
    },
  },
  vertexShader: `\
precision highp float;
precision highp int;
#define USE_COLOR
#define FLAT_SHADED
/*uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv; */
#ifdef USE_COLOR
	attribute vec3 color;
#endif

varying vec3 vPosition;
varying vec3 vViewPosition;

#ifdef USE_COLOR
	varying vec3 vColor;
#endif

void main() {
#ifdef USE_COLOR
	vColor.xyz = color.xyz;
#endif

  vec4 mvPosition = modelViewMatrix * vec4( position.xyz, 1.0 );
  gl_Position = projectionMatrix * mvPosition;

	vPosition = position.xyz;
  vViewPosition = -mvPosition.xyz;
}
`,
  fragmentShader: `\
precision highp float;
precision highp int;
#define USE_COLOR
#define FLAT_SHADED
// uniform mat4 viewMatrix;
uniform vec3 ambientLightColor;
uniform sampler2D lightMap;
uniform float useLightMap;
uniform vec2 d;
uniform float sunIntensity;

#define saturate(a) clamp( a, 0.0, 1.0 )

#ifdef USE_COLOR
	varying vec3 vColor;
#endif

varying vec3 vPosition;
varying vec3 vViewPosition;

void main() {
	vec3 diffuseColor = vColor;

  vec4 lightColor;
  if (useLightMap > 0.0) {
    float u = (
      floor(clamp(vPosition.x - d.x, 0.0, ${(NUM_CELLS).toFixed(8)})) +
      (floor(clamp(vPosition.z - d.y, 0.0, ${(NUM_CELLS).toFixed(8)})) * ${(NUM_CELLS + 1).toFixed(8)}) +
      0.5
    ) / (${(NUM_CELLS + 1).toFixed(8)} * ${(NUM_CELLS + 1).toFixed(8)});
    float v = (floor(vPosition.y) + 0.5) / ${NUM_CELLS_HEIGHT.toFixed(8)};
    lightColor = texture2D( lightMap, vec2(u, v) );
  } else {
    lightColor = vec4(0.5, 0.5, 0.5, 0.1);
  }

  vec3 fdx = vec3( dFdx( vViewPosition.x ), dFdx( vViewPosition.y ), dFdx( vViewPosition.z ) );
  vec3 fdy = vec3( dFdy( vViewPosition.x ), dFdy( vViewPosition.y ), dFdy( vViewPosition.z ) );
  vec3 normal = normalize( cross( fdx, fdy ) );
  float dotNL = saturate( dot( normal, normalize(vViewPosition)) );
  vec3 irradiance = ambientLightColor + (dotNL * 1.5);
  vec3 outgoingLight = diffuseColor *
    (
      (irradiance * (0.1 + sunIntensity * 0.9)) +
      (
        min((lightColor.rgb - 0.5) * 2.0, 0.0) * sunIntensity +
        max((lightColor.rgb - 0.5) * 2.0, 0.0) * (1.0 - sunIntensity)
      )
    );

	gl_FragColor = vec4( outgoingLight, 1.0 );
}
`
};

class Heightfield {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render, pose, input, world, elements, teleport, stck, stage, utils: {js: {mod, bffr}, random: {chnkr}}} = zeo;
    const {THREE, camera} = three;

    const _getChunkIndex = (x, z) => (mod(x, 0xFFFF) << 16) | mod(z, 0xFFFF);

    const forwardVector = new THREE.Vector3(0, 0, -1);
    const localVector = new THREE.Vector3();
    const localVector2 = new THREE.Vector3();
    const localEuler = new THREE.Euler();

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

    class QueueEntry {
      constructor(id, cb) {
        this.id = id;
        this.cb = cb;
      }
    }

    const buffers = bffr(NUM_POSITIONS_CHUNK, RANGE * RANGE * 9);
    const worker = new Worker('archae/plugins/_plugins_heightfield/build/worker.js');
    const queues = [];
    worker.requestOriginHeight = () => new Promise((accept, reject) => {
      const id = _makeId();
      worker.postMessage({
        method: 'getOriginHeight',
        id,
      });
      queues.push(new QueueEntry(id, accept));
    });
    worker.requestGenerate = (x, y) => new Promise((accept, reject) => {
      const id = _makeId();
      const buffer = buffers.alloc();
      worker.postMessage({
        method: 'generate',
        id,
        args: {
          x,
          y,
          buffer,
        },
      }, [buffer]);
      queues.push(new QueueEntry(id, accept));
    });
    worker.requestUngenerate = (x, y) => {
      worker.postMessage({
        method: 'ungenerate',
        args: {
          x,
          y,
        },
      });

      return Promise.resolve();
    };
    worker.requestAddVoxel = (x, y, z) => new Promise((accept, reject) => {
      const id = _makeId();
      worker.postMessage({
        method: 'addVoxel',
        id,
        args: {
          position: [x, y, z],
        },
      });
      queues.push(new QueueEntry(id, accept));
    });
    worker.requestSubVoxel = (x, y, z) => new Promise((accept, reject) => {
      const id = _makeId();
      worker.postMessage({
        method: 'subVoxel',
        id,
        args: {
          position: [x, y, z],
        },
      });
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
        } else {
          console.warn('heightfield got unknown worker message type:', JSON.stringify(type));
        }
      } else {
        const queueEntryIndex = queues.findIndex(queueEntry => queueEntry.id === pendingResponseId);
        const queueEntry = queues[queueEntryIndex];
        queueEntry.cb(data);
        queues.splice(queueEntryIndex, 1);
        pendingResponseId = null;
      }
    };

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
      for (const index in mapChunkMeshes) {
        const mapChunkMesh = mapChunkMeshes[index];
        if (mapChunkMesh) {
          _bindLightmap(mapChunkMesh);
        }
      }
    };
    const _unbindLightmaps = () => {
      for (const index in mapChunkMeshes) {
        const mapChunkMesh = mapChunkMeshes[index];
        if (mapChunkMesh && mapChunkMesh.lightmap) {
          _unbindLightmap(mapChunkMesh);
        }
      }
    };
    const _bindLightmap = mapChunkMesh => {
      const {offset} = mapChunkMesh;
      const {x, y} = offset;
      const lightmap = lightmapper.getLightmapAt(x * NUM_CELLS, y * NUM_CELLS);
      mapChunkMesh.material.uniforms.lightMap.value = lightmap.texture;
      mapChunkMesh.material.uniforms.useLightMap.value = 1;
      mapChunkMesh.lightmap = lightmap;
    };
    const _unbindLightmap = mapChunkMesh => {
      const {lightmap} = mapChunkMesh;
      lightmapper.releaseLightmap(lightmap);
      mapChunkMesh.lightmap = null;
    };
    const elementListener = elements.makeListener(LIGHTMAP_PLUGIN);
    elementListener.on('add', entityElement => {
      _bindLightmapper(entityElement);
    });
    elementListener.on('remove', () => {
      _unbindLightmapper();
    });

    const _bootstrap = () => worker.requestOriginHeight()
      .then(originHeight => {
        world.setSpawnMatrix(new THREE.Matrix4().makeTranslation(0, originHeight, 0));
      });
    const _makeMapChunkMesh = (chunk, mapChunkData, x, z) => {
      const mesh = (() => {
        const {positions, colors, indices, heightfield, staticHeightfield, boundingSphere} = mapChunkData;

        const geometry = (() => {
          let geometry = new THREE.BufferGeometry();
          geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
          geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
          geometry.setIndex(new THREE.BufferAttribute(indices, 1));
          geometry.boundingSphere = new THREE.Sphere(
            new THREE.Vector3().fromArray(boundingSphere, 0),
            boundingSphere[3]
          );
          return geometry;
        })();
        const uniforms = Object.assign(
          THREE.UniformsUtils.clone(THREE.UniformsLib.lights),
          THREE.UniformsUtils.clone(HEIGHTFIELD_SHADER.uniforms)
        );
        uniforms.d.value = new THREE.Vector2(x * NUM_CELLS, z * NUM_CELLS);
        const material = new THREE.ShaderMaterial({
          uniforms: uniforms,
          vertexShader: HEIGHTFIELD_SHADER.vertexShader,
          fragmentShader: HEIGHTFIELD_SHADER.fragmentShader,
          lights: true,
          // transparent: true,
          extensions: {
            derivatives: true,
          },
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.x = x;
        mesh.z = z;

        mesh.offset = new THREE.Vector2(x, z);
        mesh.heightfield = heightfield;
        mesh.staticHeightfield = staticHeightfield;
        mesh.lod = chunk.lod;

        mesh.lightmap = null;
        if (lightmapper && chunk.lod === 1) {
          _bindLightmap(mesh);
        }

        return mesh;
      })();

      mesh.destroy = () => {
        mesh.geometry.dispose();

        const {buffer} = mapChunkData;
        buffers.free(buffer);

        if (mesh.lightmap) {
          _unbindLightmap(mesh);
        }
      };

      return mesh;
    };

    const chunker = chnkr.makeChunker({
      resolution: NUM_CELLS,
      range: RANGE,
    });
    let mapChunkMeshes = {};

    const _requestRefreshMapChunks = () => {
      const {hmd} = pose.getStatus();
      const {worldPosition: hmdPosition} = hmd;
      const {added, removed, relodded} = chunker.update(hmdPosition.x, hmdPosition.z);

      const _addTarget = (mapChunkMesh, x, z) => {
        const stckBody = stck.makeStaticHeightfieldBody(
          new THREE.Vector3(x * NUM_CELLS, 0, z * NUM_CELLS),
          NUM_CELLS,
          NUM_CELLS,
          mapChunkMesh.staticHeightfield
        );
        mapChunkMesh.stckBody = stckBody;

        mapChunkMesh.targeted = true;
      };
      const _removeTarget = mapChunkMesh => {
        stck.destroyBody(mapChunkMesh.stckBody);

        mapChunkMesh.targeted = false;
      };

      const addedPromises = Array(added.length + relodded.length);
      let index = 0;
      const _addChunk = chunk => {
        const {x, z, lod} = chunk;

        return worker.requestGenerate(x, z)
          .then(mapChunkBuffer => protocolUtils.parseRenderChunk(mapChunkBuffer))
          .then(mapChunkData => {
            const index = _getChunkIndex(x, z);
            const oldMapChunkMesh = mapChunkMeshes[index];
            if (oldMapChunkMesh) {
              stage.remove('main', oldMapChunkMesh);
              oldMapChunkMesh.destroy();

              mapChunkMeshes[index] = null;

              if (lod !== 1 && oldMapChunkMesh.targeted) {
                _removeTarget(oldMapChunkMesh);
              }
            }

            const newMapChunkMesh = _makeMapChunkMesh(chunk, mapChunkData, x, z);
            stage.add('main', newMapChunkMesh);
            mapChunkMeshes[index] = newMapChunkMesh;

            if (lod === 1 && !newMapChunkMesh.targeted) {
              _addTarget(newMapChunkMesh, x, z);
            }

            chunk.data = newMapChunkMesh;
          });
      };
      for (let i = 0; i < added.length; i++) {
        addedPromises[index++] = _addChunk(added[i]);
      }
      for (let i = 0; i < relodded.length; i++) {
        addedPromises[index++] = _addChunk(relodded[i]);
      }
      return Promise.all(addedPromises)
        .then(() => {
          for (let i = 0; i < removed.length; i++) {
            const chunk = removed[i];
            const {x, z, data: mapChunkMesh} = chunk;
            stage.remove('main', mapChunkMesh);
            mapChunkMesh.destroy();

            const index = _getChunkIndex(x, z);
            mapChunkMeshes[index] = null;

            const {lod} = chunk;
            if (lod !== 1 && mapChunkMesh.targeted) {
              _removeTarget(mapChunkMesh);
            }

            worker.requestUngenerate(x, z);
          }
          for (let i = 0; i < relodded.length; i++) {
            const chunk = relodded[i];
            const {x, z, lod, data: mapChunkMesh} = chunk;

            if (lod === 1 && !mapChunkMesh.targeted) {
              _addTarget(mapChunkMesh, x, z);
            } else if (lod !== 1 && mapChunkMesh.targeted) {
              _removeTarget(mapChunkMesh);
            }
          }

          const newMapChunkMeshes = {};
          for (const index in mapChunkMeshes) {
            const mapChunkMesh = mapChunkMeshes[index];
            if (mapChunkMesh) {
              newMapChunkMeshes[index] = mapChunkMesh;
            }
          }
          mapChunkMeshes = newMapChunkMeshes;
        });
    };
    const _debouncedRequestRefreshMapChunks = _debounce(next => {
      _requestRefreshMapChunks()
        .then(next)
        .catch(err => {
          console.warn(err);

          next();
        });
    });

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

      if (mapChunkMesh) {
        return _getTopHeightfieldTriangleElevation(mapChunkMesh.heightfield, x, z);
      } else {
        return 0;
      }
    };
    const _getBestElevation = (x, z, y) => {
      const ox = Math.floor(x / NUM_CELLS);
      const oz = Math.floor(z / NUM_CELLS);
      const mapChunkMesh = mapChunkMeshes[_getChunkIndex(ox, oz)];

      if (mapChunkMesh) {
        return _getBestHeightfieldTriangleElevation(mapChunkMesh.heightfield, x, z, y);
      } else {
        return 0;
      }
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

    return _bootstrap()
      .then(() => {
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

            entityElement.getElevation = _getElevation;
            entityElement.getBestElevation = _getBestElevation;
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
          const lx = localVector.x;
          const lz = localVector.z;
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
              worker.requestSubVoxel(Math.round(lx), Math.round(ly), Math.round(lz))
                .then(regenerated => {
                  if (regenerated.length > 0) {
                    for (let i = 0; i < regenerated.length; i++) {
                      const [ox, oz] = regenerated[i];
                      const chunk = chunker.getChunk(ox, oz);
                      if (chunk) {
                        chunk.lod = -1; // force chunk refresh
                      }
                    }
                    _debouncedRequestRefreshMapChunks();
                  }
                });

              e.stopImmediatePropagation();
            }
          }
        };
        input.on('triggerdown', _triggerdown, {
          priority: -1,
        });

        let live = true;
        const _recurse = () => {
          _debouncedRequestRefreshMapChunks(() => {
            if (live) {
              setTimeout(_recurse, 1000);
            }
          });
        };
        _recurse();

        const _update = () => {
          const dayNightSkyboxEntity = elements.getEntitiesElement().querySelector(DAY_NIGHT_SKYBOX_PLUGIN);
          const sunIntensity = (dayNightSkyboxEntity && dayNightSkyboxEntity.getSunIntensity) ? dayNightSkyboxEntity.getSunIntensity() : 0;

          for (const index in mapChunkMeshes) {
            const mapChunkMesh = mapChunkMeshes[index];
            if (mapChunkMesh) {
              mapChunkMesh.material.uniforms.sunIntensity.value = sunIntensity;
            }
          }
        };
        render.on('update', _update);

        this._cleanup = () => {
          live = false;

          // XXX remove chunks from the scene here

          elements.destroyListener(elementListener);

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
