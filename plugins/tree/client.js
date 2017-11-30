const {
  NUM_CELLS,

  NUM_CELLS_HEIGHT,
  HEIGHT_OFFSET,

  RANGE,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const TEXTURE_SIZE = 1024;
const NUM_POSITIONS_CHUNK = 500 * 1024;
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];
const LIGHTMAP_PLUGIN = 'lightmap';
const DAY_NIGHT_SKYBOX_PLUGIN = 'day-night-skybox';

const TREE_SHADER = {
  uniforms: {
    map: {
      type: 't',
      value: null,
    },
    lightMap: {
      type: 't',
      value: null,
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
#define ALPHATEST 0.7
#define DOUBLE_SIDED
// uniform mat4 viewMatrix;
uniform vec3 ambientLightColor;
uniform sampler2D map;
uniform sampler2D lightMap;
uniform vec2 d;
uniform float sunIntensity;

#define saturate(a) clamp( a, 0.0, 1.0 )

varying vec3 vPosition;
varying vec3 vViewPosition;
varying vec2 vUv;
varying vec3 vNormal;

void main() {
  vec4 diffuseColor = texture2D( map, vUv );

  float u = (
    floor(clamp(vPosition.x - d.x, 0.0, ${(NUM_CELLS).toFixed(8)})) +
    (floor(clamp(vPosition.z - d.y, 0.0, ${(NUM_CELLS).toFixed(8)})) * ${(NUM_CELLS + 1).toFixed(8)}) +
    0.5
  ) / (${(NUM_CELLS + 1).toFixed(8)} * ${(NUM_CELLS + 1).toFixed(8)});
  float v = (floor(vPosition.y - ${HEIGHT_OFFSET.toFixed(8)}) + 0.5) / ${NUM_CELLS_HEIGHT.toFixed(8)};
  vec3 lightColor = texture2D( lightMap, vec2(u, v) ).rgb;

#ifdef ALPHATEST
	if ( diffuseColor.a < ALPHATEST ) discard;
#endif

#ifdef DOUBLE_SIDED
	float flipNormal = ( float( gl_FrontFacing ) * 2.0 - 1.0 );
#else
	float flipNormal = 1.0;
#endif

  vec3 outgoingLight = (ambientLightColor * 0.2 + diffuseColor.rgb) * (0.1 + sunIntensity * 0.9) +
    diffuseColor.rgb * (
      min((lightColor.rgb - 0.5) * 2.0, 0.0) * sunIntensity +
      max((lightColor.rgb - 0.5) * 2.0, 0.0) * (1.0 - sunIntensity)
    );

	gl_FragColor = vec4( outgoingLight, diffuseColor.a );
}
`
};

class Tree {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    return;
    const {_archae: archae} = this;
    const {three, render, pose, input, elements, items, stage, sound, utils: {js: {bffr}, random: {chnkr}}} = zeo;
    const {THREE} = three;

    const upVector = new THREE.Vector3(0, 1, 0);
    const sideQuaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(1, 0, 0)
    );

    const buffers = bffr(NUM_POSITIONS_CHUNK * 3, (RANGE + 1) * (RANGE + 1) * 2);

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const worker = new Worker('archae/plugins/tree/build/worker.js');
    const queue = [];
    worker.requestGenerate = (x, y) => new Promise((accept, reject) => {
      const buffer = buffers.alloc();
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
        ctx.putImageData(imageData, 0, 0); // XXX can be made into imageBitmap

        accept(canvas);
      });
    });
    worker.onmessage = e => {
      const {data: buffer} = e;
      const cb = queue.shift();
      cb(buffer);
    };

    return Promise.all([
      worker.requestTexture(),
      sound.requestSfx('archae/tree/sfx/chop.ogg'),
    ])
      .then(([
        mapTextureImg,
        chopSfx,
      ]) => {
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

          let Lightmapper = null;
          let lightmapper = null;
          const _bindLightmapper = lightmapElement => {
            Lightmapper = lightmapElement.Lightmapper;
            lightmapper = lightmapElement.lightmapper;

            _bindLightmaps();
          };
          const _unbindLightmapper = () => {
            _unbindLightmaps();

            lightmapper = null;
          };
          const _bindLightmaps = () => {
            for (let i = 0; i < treeChunkMeshes.length; i++) {
              const treeChunkMesh = treeChunkMeshes[i];
              _bindLightmap(treeChunkMesh);
            }
          };
          const _unbindLightmaps = () => {
            for (let i = 0; i < treeChunkMeshes.length; i++) {
              const treeChunkMesh = treeChunkMeshes[i];
              _unbindLightmap(treeChunkMesh);
            }
          };
          const _bindLightmap = treeChunkMesh => {
            const {offset} = treeChunkMesh;
            const {x, y} = offset;
            const lightmap = lightmapper.getLightmapAt(x * NUM_CELLS, y * NUM_CELLS);
            treeChunkMesh.material.uniforms.lightMap.value = lightmap.texture;
            treeChunkMesh.lightmap = lightmap;

            const {trees: treesData} = treeChunkMesh;
            const numTrees = treesData.length / 5;
            const shapes = Array(numTrees);
            for (let i = 0; i < numTrees; i++) {
              const basePosition = new THREE.Vector3().fromArray(treesData, (i * 5) + 2);
              const shape = new Lightmapper.Cylinder(basePosition.x, basePosition.y, basePosition.z, 12, 8, 0.15, Lightmapper.SubBlend);
              lightmapper.add(shape);
              shapes[i] = shape;
            }
            treeChunkMesh.shapes = shapes;
          };
          const _unbindLightmap = treeChunkMesh => {
            const {lightmap} = treeChunkMesh;
            lightmapper.releaseLightmap(lightmap);
            treeChunkMesh.lightmap = null;

            const {shapes} = treeChunkMesh;
            for (let i = 0; i < shapes.length; i++) {
              const shape = shapes[i];

              if (shape) {
                lightmapper.remove(shape);
              }
            }
            treeChunkMesh.shapes = null;
          };
          const elementListener = elements.makeListener(LIGHTMAP_PLUGIN);
          elementListener.on('add', entityElement => {
            _bindLightmapper(entityElement);
          });
          elementListener.on('remove', () => {
            _unbindLightmapper();
          });

          const _requestTreeGenerate = (x, y) => worker.requestGenerate(x, y)
            .then(treeChunkBuffer => protocolUtils.parseTreeGeometry(treeChunkBuffer));

          const _makeTreeChunkMesh = (treeChunkData, x, z) => {
            const mesh = (() => {
              const {positions, uvs, indices, heightRange, trees} = treeChunkData;

              const geometry = (() => {
                let geometry = new THREE.BufferGeometry();
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

              const uniforms = Object.assign(
                THREE.UniformsUtils.clone(THREE.UniformsLib.lights),
                THREE.UniformsUtils.clone(TREE_SHADER.uniforms)
              );
              uniforms.map.value = mapTexture;
              uniforms.d.value = new THREE.Vector2(x * NUM_CELLS, z * NUM_CELLS);
              const material = new THREE.ShaderMaterial({
                uniforms: uniforms,
                vertexShader: TREE_SHADER.vertexShader,
                fragmentShader: TREE_SHADER.fragmentShader,
                lights: true,
                side: THREE.DoubleSide,
                transparent: true,
              });

              const mesh = new THREE.Mesh(geometry, material);
              // mesh.frustumCulled = false;

              mesh.offset = new THREE.Vector2(x, z);
              mesh.trees = trees;
              mesh.lightmap = null;
              mesh.shapes = null;
              if (lightmapper) {
                _bindLightmap(mesh);
              }

              return mesh;
            })();

            mesh.destroy = () => {
              mesh.geometry.dispose();

              const {buffer} = treeChunkData;
              buffers.free(buffer);

              if (mesh.lightmap) {
                _unbindLightmap(mesh);
              }
            };

            return mesh;
          };

          class TrackedTree {
            constructor(mesh, box, treeIndex, startIndex, endIndex) {
              this.mesh = mesh;
              this.box = box;
              this.treeIndex = treeIndex;
              this.startIndex = startIndex;
              this.endIndex = endIndex;
            }

            erase() {
              const {mesh, treeIndex, startIndex, endIndex} = this;
              const {geometry} = mesh;
              const indexAttribute = geometry.index;
              const indices = indexAttribute.array;
              for (let i = startIndex; i < endIndex; i++) {
                indices[i] = 0;
              }
              indexAttribute.needsUpdate = true;

              const {shapes} = mesh;
              if (shapes) {
                const shape = shapes[treeIndex];
                lightmapper.remove(shape);
                shapes[treeIndex] = null;
              }
            }
          }

          const trackedTrees = [];
          const _addTrackedTrees = (mesh, data) => {
            const {trees: treesData} = data;
            const numTrees = treesData.length / 5;
            const treeBaseWidth = 1.5; // XXX compute this accurately
            const treeBaseHeight = 2;
            let startTree = null;
            for (let i = 0; i < numTrees; i++) {
              const baseIndex = i * 5;
              const basePosition = new THREE.Vector3().fromArray(treesData, baseIndex + 2);
              const box = new THREE.Box3(
                basePosition.clone().add(new THREE.Vector3(-treeBaseWidth/2, 0, -treeBaseWidth/2)),
                basePosition.clone().add(new THREE.Vector3(treeBaseWidth/2, treeBaseHeight, treeBaseWidth/2))
              );
              const treeIndex = i;
              const startIndex = treesData[baseIndex + 0];
              const endIndex = treesData[baseIndex + 1];
              const trackedTree = new TrackedTree(mesh, box, treeIndex, startIndex, endIndex);
              trackedTrees.push(trackedTree);

              if (startTree === null) {
                startTree = trackedTree;
              }
            }

            return [startTree, numTrees];
          };
          const _removeTrackedTrees = itemRange => {
            const [startTree, numTrees] = itemRange;
            trackedTrees.splice(trackedTrees.indexOf(startTree), numTrees);
          };
          const _getHoveredTrackedTree = side => {
            const {gamepads} = pose.getStatus();
            const gamepad = gamepads[side];
            const {worldPosition: controllerPosition} = gamepad;

            for (let i = 0; i < trackedTrees.length; i++) {
              const trackedTree = trackedTrees[i];
              if (trackedTree.box.containsPoint(controllerPosition)) {
                return trackedTree;
              }
            }
            return null;
          };

          const _gripdown = e => {
            const {side} = e;
            const trackedTree = _getHoveredTrackedTree(side);

            if (trackedTree) {
              trackedTree.erase();
              trackedTrees.splice(trackedTrees.indexOf(trackedTree), 1);

              const id = _makeId();
              const asset = 'ITEM.WOOD';
              const assetInstance = items.makeItem({
                type: 'asset',
                id: id,
                name: asset,
                displayName: asset,
                attributes: {
                  type: {value: 'asset'},
                  value: {value: asset},
                  position: {value: DEFAULT_MATRIX},
                  quantity: {value: 1},
                  owner: {value: null},
                  bindOwner: {value: null},
                  physics: {value: false},
                },
              });
              assetInstance.grab(side);

              chopSfx.trigger();
            }
          };
          input.on('gripdown', _gripdown);

          const chunker = chnkr.makeChunker({
            resolution: NUM_CELLS,
            range: RANGE,
          });
          const treeChunkMeshes = [];

          const _requestRefreshTreeChunks = () => {
            const {hmd} = pose.getStatus();
            const {worldPosition: hmdPosition} = hmd;
            const {added, removed} = chunker.update(hmdPosition.x, hmdPosition.z);

            const addedPromises = added.map(chunk => {
              const {x, z} = chunk;

              return _requestTreeGenerate(x, z)
                .then(treeChunkData => {
                  const treeChunkMesh = _makeTreeChunkMesh(treeChunkData, x, z);
                  stage.add('main', treeChunkMesh);
                  treeChunkMeshes.push(treeChunkMesh);

                  const itemRange = _addTrackedTrees(treeChunkMesh, treeChunkData);

                  chunk.data = {
                    treeChunkMesh,
                    itemRange,
                  };
                });
            });
            return Promise.all(addedPromises)
              .then(() => {
                for (let i = 0; i < removed.length; i++) {
                  const chunk = removed[i];
                  const {data} = chunk;
                  const {treeChunkMesh} = data;
                  stage.remove('main', treeChunkMesh);
                  treeChunkMeshes.splice(treeChunkMeshes.indexOf(treeChunkMesh), 1);

                  treeChunkMesh.destroy();

                  const {itemRange} = data;
                  _removeTrackedTrees(itemRange);
                }
              });
          };

          let live = true;
          const _recurse = () => {
            _requestRefreshTreeChunks()
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

            for (let i = 0; i < treeChunkMeshes.length; i++) {
              const treeChunkMesh = treeChunkMeshes[i];
              treeChunkMesh.material.uniforms.sunIntensity.value = sunIntensity;
            }
          };
          render.on('update', _update);

          this._cleanup = () => {
            live = false;

            // XXX remove old tree meshes here

            elements.destroyListener(elementListener);

            input.removeListener('gripdown', _gripdown);
            render.removeListener('update', _update);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = Tree;
