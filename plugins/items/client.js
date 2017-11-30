const {
  NUM_CELLS,

  NUM_CELLS_HEIGHT,
  HEIGHT_OFFSET,

  RANGE,

  ITEMS,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS_CHUNK = 4 * 1024 * 1024;
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];
const LIGHTMAP_PLUGIN = 'lightmap';
const DAY_NIGHT_SKYBOX_PLUGIN = 'day-night-skybox';

const ITEMS_SHADER = {
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
/*uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv; */
attribute vec3 color;

varying vec3 vPosition;
varying vec3 vViewPosition;

varying vec3 vColor;

void main() {
	vColor.xyz = color.xyz;

  vec4 mvPosition = modelViewMatrix * vec4( position.xyz, 1.0 );
  gl_Position = projectionMatrix * mvPosition;

	vPosition = position.xyz;
	vViewPosition = - mvPosition.xyz;
}
`,
  fragmentShader: `\
precision highp float;
precision highp int;
// uniform mat4 viewMatrix;
uniform vec3 ambientLightColor;
uniform sampler2D lightMap;
uniform vec2 d;
uniform float sunIntensity;

varying vec3 vColor;
varying vec3 vPosition;
varying vec3 vViewPosition;

void main() {
  vec4 diffuseColor = vec4(vColor, 1.0);

  float u = (
    floor(clamp(vPosition.x - d.x, 0.0, ${(NUM_CELLS).toFixed(8)})) +
    (floor(clamp(vPosition.z - d.y, 0.0, ${(NUM_CELLS).toFixed(8)})) * ${(NUM_CELLS + 1).toFixed(8)}) +
    0.5
  ) / (${(NUM_CELLS + 1).toFixed(8)} * ${(NUM_CELLS + 1).toFixed(8)});
  float v = (floor(vPosition.y - ${HEIGHT_OFFSET.toFixed(8)}) + 0.5) / ${NUM_CELLS_HEIGHT.toFixed(8)};
  vec3 lightColor = texture2D( lightMap, vec2(u, v) ).rgb;

  vec3 outgoingLight = (ambientLightColor * 0.2 + diffuseColor.rgb) * (0.1 + sunIntensity * 0.9) +
    diffuseColor.rgb * (
      min((lightColor.rgb - 0.5) * 2.0, 0.0) * sunIntensity +
      max((lightColor.rgb - 0.5) * 2.0, 0.0) * (1.0 - sunIntensity)
    );

	gl_FragColor = vec4( outgoingLight, diffuseColor.a );
}
`
};

class Items {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    return;
    const {_archae: archae} = this;
    const {three, render, pose, input, items, elements, stage, utils: {js: {bffr}, random: {chnkr}}} = zeo;
    const {THREE} = three;

    const buffers = bffr(NUM_POSITIONS_CHUNK, (RANGE + 1) * (RANGE + 1) * 2);

    const worker = new Worker('archae/plugins/items/build/worker.js');
    const queue = [];
    worker.requestGenerate = (x, y) => new Promise((accept, reject) => {
      const buffer = buffers.alloc();
      worker.postMessage({
        x,
        y,
        buffer,
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
      lightmapper = lightmapElement.lightmapper;

      _bindLightmaps();
    };
    const _unbindLightmapper = () => {
      _unbindLightmaps();

      lightmapper = null;
    };
    const _bindLightmaps = () => {
      for (let i = 0; i < itemsChunkMeshes.length; i++) {
        const itemsChunkMesh = itemsChunkMeshes[i];
        _bindLightmap(itemsChunkMesh);
      }
    };
    const _unbindLightmaps = () => {
      for (let i = 0; i < itemsChunkMeshes.length; i++) {
        const itemsChunkMesh = itemsChunkMeshes[i];
        _unbindLightmap(itemsChunkMesh);
      }
    };
    const _bindLightmap = itemsChunkMesh => {
      const {offset} = itemsChunkMesh;
      const {x, y} = offset;
      const lightmap = lightmapper.getLightmapAt(x * NUM_CELLS, y * NUM_CELLS);
      itemsChunkMesh.material.uniforms.lightMap.value = lightmap.texture;
      itemsChunkMesh.lightmap = lightmap;
    };
    const _unbindLightmap = itemsChunkMesh => {
      const {lightmap} = itemsChunkMesh;
      lightmapper.releaseLightmap(lightmap);
      itemsChunkMesh.lightmap = null;
    };
    const elementListener = elements.makeListener(LIGHTMAP_PLUGIN);
    elementListener.on('add', entityElement => {
      _bindLightmapper(entityElement);
    });
    elementListener.on('remove', () => {
      _unbindLightmapper();
    });

    const _requestItemsGenerate = (x, y) => worker.requestGenerate(x, y)
      .then(itemsChunkBuffer => protocolUtils.parseItemsChunk(itemsChunkBuffer));

    const _makeItemsChunkMesh = (itemsChunkData, x, z) => {
      const mesh = (() => {
        const geometry = (() => {
          const {positions, normals, colors, indices, heightRange} = itemsChunkData;
          const geometry = new THREE.BufferGeometry();
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
          THREE.UniformsUtils.clone(ITEMS_SHADER.uniforms)
        );
        uniforms.d.value = new THREE.Vector2(x * NUM_CELLS, z * NUM_CELLS);
        const material = new THREE.ShaderMaterial({
          uniforms: uniforms,
          vertexShader: ITEMS_SHADER.vertexShader,
          fragmentShader: ITEMS_SHADER.fragmentShader,
          lights: true,
          // side: THREE.DoubleSide,
          // transparent: true,
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

        return mesh;
      })();

      mesh.destroy = () => {
        mesh.geometry.dispose();

        const {buffer} = itemsChunkData;
        buffers.free(buffer);

        if (mesh.lightmap) {
          _unbindLightmap(mesh);
        }
      };

      return mesh;
    };

    class TrackedItem {
      constructor(mesh, type, startIndex, endIndex, position) {
        this.mesh = mesh;
        this.type = type;
        this.startIndex = startIndex;
        this.endIndex = endIndex;
        this.position = position;
      }

      erase() {
        const {mesh, startIndex, endIndex} = this;
        const {geometry} = mesh;
        const indexAttribute = geometry.index;
        const indices = indexAttribute.array;
        for (let i = startIndex; i < endIndex; i++) {
          indices[i] = 0;
        }
        indexAttribute.needsUpdate = true;
      }
    }

    const trackedItems = [];
    const _addTrackedItems = (mesh, data) => {
      const {items: itemsData} = data;
      const numItems = itemsData.length / 4;
      let startItem = null;
      for (let i = 0; i < numItems; i++) {
        const baseIndex = i * 6;
        const type = itemsData[baseIndex + 0];
        const startIndex = itemsData[baseIndex + 1];
        const endIndex = itemsData[baseIndex + 2];
        const position = new THREE.Vector3().fromArray(itemsData, baseIndex + 3);
        const trackedItem = new TrackedItem(mesh, type, startIndex, endIndex, position);
        trackedItems.push(trackedItem);

        if (startItem === null) {
          startItem = trackedItem;
        }
      }

      return [startItem, numItems];
    };
    const _removeTrackedItems = itemRange => {
      const [startItem, numItems] = itemRange;
      trackedItems.splice(trackedItems.indexOf(startItem), numItems);
    };
    const _getHoveredTrackedItem = side => {
      const {gamepads} = pose.getStatus();
      const gamepad = gamepads[side];
      const {worldPosition: controllerPosition} = gamepad;

      for (let i = 0; i < trackedItems.length; i++) {
        const trackedItem = trackedItems[i];
        if (controllerPosition.distanceTo(trackedItem.position) < 0.2) {
          return trackedItem;
        }
      }
      return null;
    };

    const _gripdown = e => {
      const {side} = e;
      const trackedItem = _getHoveredTrackedItem(side);

      if (trackedItem) {
        trackedItem.erase();
        trackedItems.splice(trackedItems.indexOf(trackedItem), 1);

        const id = _makeId();
        const {type} = trackedItem;
        const asset = ITEMS[type];
        const {gamepads} = pose.getStatus();
        const gamepad = gamepads[side];
        const assetInstance = items.makeItem({ // XXX clean up this API
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
      }
    };
    input.on('gripdown', _gripdown);

    const chunker = chnkr.makeChunker({
      resolution: NUM_CELLS,
      range: RANGE,
    });
    const itemsChunkMeshes = [];

    const _requestRefreshItemsChunks = () => {
      const {hmd} = pose.getStatus();
      const {worldPosition: hmdPosition} = hmd;
      const {added, removed} = chunker.update(hmdPosition.x, hmdPosition.z);

      const addedPromises = added.map(chunk => {
        const {x, z} = chunk;

        return _requestItemsGenerate(x, z)
          .then(itemsChunkData => {
            const itemsChunkMesh = _makeItemsChunkMesh(itemsChunkData, x, z);
            stage.add('main', itemsChunkMesh);

            itemsChunkMeshes.push(itemsChunkMesh);

            const itemRange = _addTrackedItems(itemsChunkMesh, itemsChunkData);

            chunk.data = {
              itemsChunkMesh,
              itemRange,
            };
          });
      });
      return Promise.all(addedPromises)
        .then(() => {
          for (let i = 0; i < removed.length; i++) {
            const chunk = removed[i];
            const {data} = chunk;
            const {itemsChunkMesh} = data;
            stage.remove('main', itemsChunkMesh);

            itemsChunkMeshes.splice(itemsChunkMeshes.indexOf(itemsChunkMesh), 1);

            itemsChunkMesh.destroy();

            const {itemRange} = data;
            _removeTrackedItems(itemRange);
          }
        })
    };

    let live = true;
    const _recurse = () => {
      _requestRefreshItemsChunks()
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

      for (let i = 0; i < itemsChunkMeshes.length; i++) {
        const itemsChunkMesh = itemsChunkMeshes[i];
        itemsChunkMesh.material.uniforms.sunIntensity.value = sunIntensity;
      }
    };
    render.on('update', _update);

    this._cleanup = () => {
      live = false;

      // XXX remove old items meshes here

      elements.destroyListener(elementListener);

      render.removeListener('update', _update);
    };
  }

  unmount() {
    this._cleanup();
  }
}
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = Items;
