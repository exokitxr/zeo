const {
  NUM_CELLS,

  NUM_CELLS_HEIGHT,
  HEIGHT_OFFSET,

  RANGE,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS_CHUNK = 0.5 * 1024 * 1024;
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
    float v = (floor(vPosition.y - ${HEIGHT_OFFSET.toFixed(8)}) + 0.5) / ${NUM_CELLS_HEIGHT.toFixed(8)};
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
    const {three, render, pose, world, elements, teleport, stck, stage, utils: {js: {mod, bffr}, random: {chnkr}}} = zeo;
    const {THREE, camera} = three;

    const _getChunkIndex = (x, z) => (mod(x, 0xFFFF) << 16) | mod(z, 0xFFFF);

    const forwardVector = new THREE.Vector3(0, 0, -1);

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

    const buffers = bffr(NUM_POSITIONS_CHUNK, RANGE * RANGE * 9);
    const worker = new Worker('archae/plugins/_plugins_heightfield/build/worker.js');
    const queue = [];
    worker.requestOriginHeight = () => new Promise((accept, reject) => {
      worker.postMessage({
        method: 'getOriginHeight',
      });
      queue.push(originHeight => {
        accept(originHeight);
      });
    });
    worker.requestGenerate = (x, y) => new Promise((accept, reject) => {
      const buffer = buffers.alloc();
      worker.postMessage({
        method: 'generate',
        args: {
          x,
          y,
          buffer,
        },
      }, [buffer]);
      queue.push(accept);
    });
    worker.onmessage = e => {
      queue.shift()(e.data);
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
        const {position, positions, /*normals, */colors, indices, heightfield, heightRange} = mapChunkData;

        const geometry = (() => {
          let geometry = new THREE.BufferGeometry();
          geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
          // geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
          geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
          geometry.setIndex(new THREE.BufferAttribute(indices, 1));
          const [minY, maxY] = heightRange;
          geometry.boundingSphere = new THREE.Sphere(
            new THREE.Vector3(
              (x * NUM_CELLS) + (NUM_CELLS / 2),
              (minY + maxY) / 2,
              (z * NUM_CELLS) + (NUM_CELLS / 2)
            ),
            Math.max(Math.sqrt((NUM_CELLS / 2) * (NUM_CELLS / 2) * 3), (maxY - minY) / 2)
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
        // mesh.frustumCulled = false;

        mesh.offset = new THREE.Vector2(x, z);
        mesh.heightfield = heightfield;
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
        const {heightfield} = mapChunkMesh;
        const stckBody = stck.makeStaticHeightfieldBody(
          new THREE.Vector3(x * NUM_CELLS, 0, z * NUM_CELLS),
          NUM_CELLS,
          NUM_CELLS,
          heightfield
        );
        mapChunkMesh.stckBody = stckBody;

        mapChunkMesh.targeted = true;
      };
      const _removeTarget = mapChunkMesh => {
        const {stckBody} = mapChunkMesh;
        stck.destroyBody(stckBody);

        mapChunkMesh.targeted = false;
      };

      const addedPromises = Array(added.length + relodded.length);
      let index = 0;
      const _addChunk = chunk => {
        const {x, z, lod} = chunk;

        return worker.requestGenerate(x, z)
          .then(mapChunkBuffer => protocolUtils.parseMapChunk(mapChunkBuffer))
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

    return _bootstrap()
      .then(() => {
        const heightfieldEntity = {
          entityAddedCallback(entityElement) {
            const min = new THREE.Vector2();
            const a = new THREE.Vector3();
            const b = new THREE.Vector3();
            const c = new THREE.Vector3();
            const p = new THREE.Vector3();
            const triangle = new THREE.Triangle(a, b, c);
            const baryCoord = new THREE.Vector3();

            const _getHeightfieldIndex = (x, z) => (x + (z * (NUM_CELLS + 1))) * 4;
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
              let bestY = -Infinity;
              let bestYDistance = Infinity;
              for (let i = 0; i < 4; i++) {
                const localY = heightfield[_getHeightfieldIndex(x, z) + i];

                if (localY !== -Infinity) {
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

            const localVector = new THREE.Vector3();
            const localVector2 = new THREE.Vector3();
            const localEuler = new THREE.Euler();
            const _teleportTarget = (position, rotation, scale) => {
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
                  position.y
                );

                if (targetPosition.y > -Infinity) {
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
            entityElement._cleanup = () => {
              teleport.removeTarget(_teleportTarget);
            };
          },
        };
        elements.registerEntity(this, heightfieldEntity);

        let live = true;
        const _recurse = () => {
          _requestRefreshMapChunks()
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

        const _update = () => {
          const dayNightSkyboxEntity = elements.getEntitiesElement().querySelector(DAY_NIGHT_SKYBOX_PLUGIN);
          const sunIntensity = (dayNightSkyboxEntity && dayNightSkyboxEntity.getSunIntensity) ? dayNightSkyboxEntity.getSunIntensity() : 0;

          for (const index in mapChunkMeshes) {
            mapChunkMeshes[index].material.uniforms.sunIntensity.value = sunIntensity;
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

module.exports = Heightfield;
