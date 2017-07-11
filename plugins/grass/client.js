const {
  NUM_CELLS,

  NUM_CELLS_HEIGHT,
  HEIGHT_OFFSET,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const TEXTURE_SIZE = 1024;
const NUM_POSITIONS_CHUNK = 200 * 1024;
const LIGHTMAP_PLUGIN = 'plugins-lightmap';

const GRASS_SHADER = {
  uniforms: {
    map: {
      type: 't',
      value: null,
    },
    lightMap: {
      type: 't',
      value: null,
    },
  },
  vertexShader: `\
precision highp float;
precision highp int;
#define USE_COLOR
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
varying vec2 vUv;
varying vec3 vNormal;
#define saturate(a) clamp( a, 0.0, 1.0 )

#ifdef USE_COLOR
	varying vec3 vColor;
#endif

void main() {
#ifdef USE_COLOR
	vColor.xyz = color.xyz;
#endif

  vUv = uv;
	vNormal = normal;

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
#define ALPHATEST 0.5
#define DOUBLE_SIDED
// uniform mat4 viewMatrix;
uniform sampler2D map;
uniform sampler2D lightMap;

#define saturate(a) clamp( a, 0.0, 1.0 )

#ifdef USE_COLOR
	varying vec3 vColor;
#endif

varying vec3 vPosition;
varying vec3 vViewPosition;
varying vec2 vUv;
varying vec3 vNormal;

void main() {
  vec4 diffuseColor = texture2D( map, vUv );

  float lu = (floor(vPosition.x) + (floor(vPosition.z) * ${(NUM_CELLS + 1).toFixed(8)}) + 0.5) / (${(NUM_CELLS + 1).toFixed(8)} * ${(NUM_CELLS + 1).toFixed(8)});
  float lv = (floor(vPosition.y - ${HEIGHT_OFFSET.toFixed(8)}) + 0.5) / ${NUM_CELLS_HEIGHT.toFixed(8)};
  vec3 lightColor = texture2D( lightMap, vec2(lu, lv) ).rgb * 1.5;

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

  /* float dotNL = saturate( dot( vNormal, normalize(vec3(1.0, -1.0, 1.0) + vViewPosition) ) );
  float irradiance = 1.0 + (dotNL * 2.0);
	vec3 outgoingLight = irradiance * diffuseColor.rgb; */
  vec3 outgoingLight = diffuseColor.rgb * lightColor;

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
    const {three, render, pose, elements, utils: {random: {chnkr}}} = zeo;
    const {THREE, scene} = three;

    const upVector = new THREE.Vector3(0, 1, 0);

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const worker = new Worker('archae/plugins/_plugins_grass/build/worker.js');
    const queue = [];
    worker.requestGenerate = (x, y) => new Promise((accept, reject) => {
      const buffer = new ArrayBuffer(NUM_POSITIONS_CHUNK * 3);
      worker.postMessage({
        type: 'chunk',
        x,
        y,
        buffer,
      }, [buffer]);
      queue.push(buffer => {
        accept(buffer);
      });
    });
    worker.requestTexture = () => new Promise((accept, reject) => {
      const buffer = new ArrayBuffer(TEXTURE_SIZE * TEXTURE_SIZE  * 4);
      worker.postMessage({
        type: 'texture',
        buffer,
      }, [buffer]);
      queue.push(buffer => {
        const canvas = document.createElement('canvas');
        canvas.width = TEXTURE_SIZE;
        canvas.height = TEXTURE_SIZE;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        imageData.data.set(new Uint8Array(buffer));
        ctx.putImageData(imageData, 0, 0);

        accept(canvas);
      });
    });
    worker.onmessage = e => {
      const {data: buffer} = e;
      const cb = queue.shift();
      cb(buffer);
    };

    worker.requestTexture()
      .then(mapTextureImg => {
        if (live) {
          const mapTexture = new THREE.Texture(
            mapTextureImg,
            THREE.UVMapping,
            THREE.ClampToEdgeWrapping,
            THREE.ClampToEdgeWrapping,
            // THREE.LinearMipMapLinearFilter,
            // THREE.LinearMipMapLinearFilter,
            THREE.NearestMipMapLinearFilter,
            THREE.NearestMipMapLinearFilter,
            // THREE.NearestMipMapNearestFilter,
            // THREE.NearestMipMapNearestFilter,
            // THREE.LinearFilter,
            // THREE.LinearFilter,
            // THREE.NearestFilter,
            // THREE.NearestFilter,
            THREE.RGBAFormat,
            THREE.UnsignedByteType,
            16
          );
          mapTexture.needsUpdate = true;

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
            for (let i = 0; i < grassChunkMeshes.length; i++) {
              const grassChunkMesh = grassChunkMeshes[i];
              _bindLightmap(grassChunkMesh);
            }
          };
          const _unbindLightmaps = () => {
            for (let i = 0; i < grassChunkMeshes.length; i++) {
              const grassChunkMesh = grassChunkMeshes[i];
              _unbindLightmap(grassChunkMesh);
            }
          };
          const _bindLightmap = grassChunkMesh => {
            const {offset} = grassChunkMesh;
            const {x, y} = offset;
            const lightmap = lightmapper.getLightmapAt(x * NUM_CELLS, y * NUM_CELLS);
            grassChunkMesh.material.uniforms.lightMap.value = lightmap.texture;
            grassChunkMesh.lightmap = lightmap;
          };
          const _unbindLightmap = grassChunkMesh => {
            const {lightmap} = grassChunkMesh;
            lightmapper.releaseLightmap(lightmap);
            grassChunkMesh.lightmap = null;
          };
          const elementListener = elements.makeListener(LIGHTMAP_PLUGIN);
          elementListener.on('add', entityElement => {
            _bindLightmapper(entityElement);
          });
          elementListener.on('remove', () => {
            _unbindLightmapper();
          });

          const _requestGrassGenerate = (x, y) => worker.requestGenerate(x, y)
            .then(grassChunkBuffer => protocolUtils.parseGrassGeometry(grassChunkBuffer));

          const _makeGrassChunkMesh = (grassChunkData, x, z) => {
            const {positions, uvs, indices, heightRange} = grassChunkData;

            const geometry = (() => {
              const geometry = new THREE.BufferGeometry();
              geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
              geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
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
            const uniforms = THREE.UniformsUtils.clone(GRASS_SHADER.uniforms);
            uniforms.map.value = mapTexture;
            const material = new THREE.ShaderMaterial({
              uniforms: uniforms,
              vertexShader: GRASS_SHADER.vertexShader,
              fragmentShader: GRASS_SHADER.fragmentShader,
              side: THREE.DoubleSide,
              transparent: true,
              /* extensions: {
                derivatives: true,
              }, */
            });

            const mesh = new THREE.Mesh(geometry, material);
            // mesh.frustumCulled = false;

            mesh.offset = new THREE.Vector2(x, z);
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
            range: 2,
          });
          const grassChunkMeshes = [];

          const _requestRefreshGrassChunks = () => {
            const {hmd} = pose.getStatus();
            const {worldPosition: hmdPosition} = hmd;
            const {added, removed} = chunker.update(hmdPosition.x, hmdPosition.z);

            const addedPromises = added.map(chunk => {
              const {x, z} = chunk;

              return _requestGrassGenerate(x, z)
                .then(grassChunkData => {
                  const grassChunkMesh = _makeGrassChunkMesh(grassChunkData, x, z);
                  scene.add(grassChunkMesh);

                  grassChunkMeshes.push(grassChunkMesh);

                  chunk.data = grassChunkMesh;
                });
            });
            return Promise.all(addedPromises)
              .then(() => {
                removed.forEach(chunk => {
                  const {data: grassChunkMesh} = chunk;
                  scene.remove(grassChunkMesh);

                  grassChunkMeshes.splice(grassChunkMeshes.indexOf(grassChunkMesh), 1);

                  grassChunkMesh.destroy();
                });
              })
          };

          let updating = false;
          let updateQueued = false;
          const tryGrassChunkUpdate = () => {
            if (!updating) {
              updating = true;

              const done = () => {
                updating = false;

                if (updateQueued) {
                  updateQueued = false;

                  tryGrassChunkUpdate();
                }
              };

              _requestRefreshGrassChunks()
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
            tryGrassChunkUpdate();
            tryLightmapUpdate();
          };
          render.on('update', _update);

          this._cleanup = () => {
            // XXX remove old grass meshes here

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

module.exports = Grass;
