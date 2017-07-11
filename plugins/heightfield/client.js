const {
  NUM_CELLS,

  NUM_CELLS_HEIGHT,
  HEIGHT_OFFSET,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS_CHUNK = 100 * 1024;
const LIGHTMAP_PLUGIN = 'plugins-lightmap';

const HEIGHTFIELD_SHADER = {
  uniforms: {
    lightMap: {
      type: 't',
      value: null,
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
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#define saturate(a) clamp( a, 0.0, 1.0 )

#ifdef USE_COLOR
	varying vec3 vColor;
#endif

void main() {
#ifdef USE_COLOR
	vColor.xyz = color.xyz;
#endif

#ifndef FLAT_SHADED
	vNormal = normal;
#endif

  vec4 mvPosition = modelViewMatrix * vec4( position.xyz, 1.0 );
  gl_Position = projectionMatrix * mvPosition;

	vPosition = position.xyz;
	vViewPosition = - mvPosition.xyz;
}
`,
  fragmentShader: `\
precision highp float;
precision highp int;
#define USE_COLOR
#define FLAT_SHADED
// uniform mat4 viewMatrix;
uniform sampler2D lightMap;

#define saturate(a) clamp( a, 0.0, 1.0 )

#ifdef USE_COLOR
	varying vec3 vColor;
#endif

varying vec3 vPosition;
varying vec3 vViewPosition;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif

void main() {
  float u = (floor(vPosition.x) + (floor(vPosition.z) * ${(NUM_CELLS + 1).toFixed(8)}) + 0.5) / (${(NUM_CELLS + 1).toFixed(8)} * ${(NUM_CELLS + 1).toFixed(8)});
  float v = (floor(vPosition.y - ${HEIGHT_OFFSET.toFixed(8)}) + 0.5) / ${NUM_CELLS_HEIGHT.toFixed(8)};
  vec4 diffuseColor = texture2D( lightMap, vec2(u, v) );

#ifdef USE_COLOR
	diffuseColor.rgb *= vColor;
#endif

#ifdef ALPHATEST
	if ( diffuseColor.a < ALPHATEST ) discard;
#endif

#ifdef DOUBLE_SIDED
	float flipNormal = ( float( gl_FrontFacing ) * 2.0 - 1.0 );
#else
	float flipNormal = 1.0;
#endif

#ifdef FLAT_SHADED
	vec3 fdx = vec3( dFdx( vViewPosition.x ), dFdx( vViewPosition.y ), dFdx( vViewPosition.z ) );
	vec3 fdy = vec3( dFdy( vViewPosition.x ), dFdy( vViewPosition.y ), dFdy( vViewPosition.z ) );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = vNormal;
#endif

  float dotNL = saturate( dot( normal, normalize(vec3(1.0, -1.0, 1.0) + vViewPosition) ) );
  float irradiance = 1.0 + (dotNL * 2.0);
	vec3 outgoingLight = irradiance * diffuseColor.rgb;

	gl_FragColor = vec4( outgoingLight, diffuseColor.a );
}
`
};

class Heightfield {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render, pose, world, elements, teleport, /*physics,*/ stck, utils: {random: {chnkr}}} = zeo;
    const {THREE, scene} = three;

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
      const buffer = new ArrayBuffer(NUM_POSITIONS_CHUNK * 3);
      worker.postMessage({
        method: 'generate',
        args: {
          x,
          y,
          buffer,
        },
      }, [buffer]);
      queue.push(buffer => {
        accept(buffer);
      });
    });
    worker.onmessage = e => {
      const {data: buffer} = e;
      const cb = queue.shift();
      cb(buffer);
    };

    let lightmapper = null;
    const _bindLightmapper = lightmapElement => {
      const {Lightmapper} = lightmapElement;

      lightmapper = new Lightmapper({
        width: NUM_CELLS,
        height: NUM_CELLS_HEIGHT,
        depth: NUM_CELLS,
        heightOffset: HEIGHT_OFFSET,
      });
      lightmapper.add(new Lightmapper.Ambient(255 * 0.1));
      lightmapper.add(new Lightmapper.Sphere(NUM_CELLS / 2, 24, NUM_CELLS / 2, 12, 1.5));

      _bindLightmaps();
    };
    const _unbindLightmapper = () => {
      _unbindLightmaps();

      lightmapper = null;
    };
    const _bindLightmaps = () => {
      for (let i = 0; i < mapChunkMeshes.length; i++) {
        const mapChunkMesh = mapChunkMeshes[i];
        _bindLightmap(mapChunkMesh);
      }
    };
    const _unbindLightmaps = () => {
      for (let i = 0; i < mapChunkMeshes.length; i++) {
        const mapChunkMesh = mapChunkMeshes[i];
        _unbindLightmap(mapChunkMesh);
      }
    };
    const _bindLightmap = mapChunkMesh => {
      const {offset} = mapChunkMesh;
      const {x, y} = offset;
      const lightmap = lightmapper.getLightmapAt(x * NUM_CELLS, y * NUM_CELLS);
// if (!(x === 0 && y === 0)) {
      mapChunkMesh.material.uniforms.lightMap.value = lightmap.texture;
// }
      mapChunkMesh.lightmap = lightmap;
    };
    const _unbindLightmap = mapChunkMesh => {
      const {lightmap} = mapChunkMesh;
      lightmapper.releaseLightmap(lightmap);
      lightmapper.remove(mapChunkMesh);
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
    const _requestGenerate = (x, y) => worker.requestGenerate(x, y)
      .then(mapChunkBuffer => protocolUtils.parseMapChunk(mapChunkBuffer));
    const _makeMapChunkMesh = (mapChunkData, x, z) => {
      const {position, positions, normals, colors, heightfield, heightRange} = mapChunkData;

      const geometry = (() => {
        let geometry = new THREE.BufferGeometry();
        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
        geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
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
      const material = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(HEIGHTFIELD_SHADER.uniforms),
        vertexShader: HEIGHTFIELD_SHADER.vertexShader,
        fragmentShader: HEIGHTFIELD_SHADER.fragmentShader,
        transparent: true,
        extensions: {
          derivatives: true,
        },
      });

      const mesh = new THREE.Mesh(geometry, material);
      // mesh.frustumCulled = false;

      mesh.offset = new THREE.Vector2(x, z);
      mesh.heightfield = heightfield;

      mesh.lightmap = null;
      if (lightmapper) {
        _bindLightmap(mesh);
      }

      mesh.destroy = () => {
        geometry.dispose();

        if (mesh.lightmap) {
          _unbindLightmap(mesh);
        }
      };

      return mesh;
    };

    const chunker = chnkr.makeChunker({
      resolution: 32,
      range: 4,
    });
    const mapChunkMeshes = [];

    const _requestRefreshMapChunks = () => {
      const {hmd} = pose.getStatus();
      const {worldPosition: hmdPosition} = hmd;
      const {added, removed, relodded} = chunker.update(hmdPosition.x, hmdPosition.z);
      let retargeted = false;

      const _addTarget = (mapChunkMesh, x, z) => {
        teleport.addTarget(mapChunkMesh, {
          flat: true,
        });

        /* const physicsBody = physics.makeBody(mapChunkMesh, 'heightfield:' + x + ':' + z, {
          mass: 0,
          position: [
            (NUM_CELLS / 2) + (x * NUM_CELLS),
            0,
            (NUM_CELLS / 2) + (z * NUM_CELLS)
          ],
          linearFactor: [0, 0, 0],
          angularFactor: [0, 0, 0],
          bindObject: false,
          bindConnection: false,
        });
        mapChunkMesh.physicsBody = physicsBody; */
        const {heightfield} = mapChunkMesh;
        const stckBody = stck.makeStaticHeightfieldBody(
          [
            x * NUM_CELLS,
            0,
            z * NUM_CELLS,
          ],
          NUM_CELLS,
          NUM_CELLS,
          heightfield
        );
        mapChunkMesh.stckBody = stckBody;

        mapChunkMesh.targeted = true;
      };
      const _removeTarget = mapChunkMesh => {
        teleport.removeTarget(mapChunkMesh);

        /* const {physicsBody} = mapChunkMesh;
        physics.destroyBody(physicsBody); */
        const {stckBody} = mapChunkMesh;
        stck.destroyBody(stckBody);

        mapChunkMesh.targeted = false;
      };

      const addedPromises = added.map(chunk => {
        const {x, z} = chunk;

        return _requestGenerate(x, z)
          .then(mapChunkData => {
            const mapChunkMesh = _makeMapChunkMesh(mapChunkData, x, z);
            scene.add(mapChunkMesh);
            mapChunkMeshes.push(mapChunkMesh);

            const {lod} = chunk;
            if (lod === 1 && !mapChunkMesh.targeted) {
              _addTarget(mapChunkMesh, x, z);

              retargeted = true;
            }

            chunk.data = mapChunkMesh;
          });
      });
      return Promise.all(addedPromises)
        .then(() => {
          removed.forEach(chunk => {
            const {data: mapChunkMesh} = chunk;
            scene.remove(mapChunkMesh);
            mapChunkMesh.destroy();
            mapChunkMeshes.splice(mapChunkMeshes.indexOf(mapChunkMesh), 1);

            const {lod} = chunk;
            if (lod !== 1 && mapChunkMesh.targeted) {
              _removeTarget(mapChunkMesh);

              retargeted = true;
            }
          });
          relodded.forEach(chunk => {
            const {x, z, lod, data: mapChunkMesh} = chunk;

            if (lod === 1 && !mapChunkMesh.targeted) {
              _addTarget(mapChunkMesh, x, z);

              retargeted = true;
            } else if (lod !== 1 && mapChunkMesh.targeted) {
              _removeTarget(mapChunkMesh);

              retargeted = true;
            }
          });
        })
        .then(() => {
          if (retargeted) {
            teleport.reindex();
          }
        });
    };

    return _bootstrap()
      .then(() => {
        let updating = false;
        let updateQueued = false;
        const tryMapChunkUpdate = () => {
          if (!updating) {
            updating = true;

            const done = () => {
              updating = false;

              if (updateQueued) {
                updateQueued = false;

                tryMapChunkUpdate();
              }
            };

            _requestRefreshMapChunks()
              .then(done)
              .catch(err => {
                console.warn(err);

                done();
              });
          } else {
            updateQueued = true;
          }
        };

        let lastLightmapUpdate = Date.now();
        const tryLightmapUpdate = () => {
          const now = Date.now();
          const timeDiff = now - lastLightmapUpdate;

          if (timeDiff > 500) {
            if (lightmapper) {
              lightmapper.update();
            }

            lastLightmapUpdate = now;
          }
        };

        const _update = () => {
          tryMapChunkUpdate();
          tryLightmapUpdate();
        };
        render.on('update', _update);

        this._cleanup = () => {
          // XXX remove chunks from the scene here

          elements.destroyListener(elementListener);

          render.removeListener('update', _update);
        };
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Heightfield;
