import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  NUM_CELLS,
} from './lib/constants/map';
import mapUtilsMaker from './lib/utils/map-utils';

const SIDES = ['left', 'right'];

class Map {
  mount() {
    const {three: {THREE, scene, camera}, elements, ui, utils: {random: randomUtils}} = zeo;

    const {alea} = randomUtils;

    const _decomposeObjectMatrixWorld = object => {
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      object.matrixWorld.decompose(position, rotation, scale);
      return {position, rotation, scale};
    };

    const mapUtils = mapUtilsMaker.makeUtils({
      rng: new alea(''),
    });

    const _renderMapChunk = mapChunk => {
      const {position, points} = mapChunk;

      const canvas = document.createElement('canvas');
      canvas.width = NUM_CELLS;
      canvas.height = NUM_CELLS;
      canvas.position = position;

      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const {data: imageDataData} = imageData;
      for (let y = 0; y < NUM_CELLS; y++) {
        for (let x = 0; x < NUM_CELLS; x++) {
          const baseIndex = mapUtils.getCoordIndex(x, y);
          const baseImageDataIndex = baseIndex * 4;

          const point = points[baseIndex];
          const {biome} = point;
          const colorHex = mapUtils.getBiomeColor(biome);
          const color = new THREE.Color(colorHex);
          imageDataData[baseImageDataIndex + 0] = color.r * 255;
          imageDataData[baseImageDataIndex + 1] = color.g * 255;
          imageDataData[baseImageDataIndex + 2] = color.b * 255;
          imageDataData[baseImageDataIndex + 3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);

      return canvas;
    };

    const mapChunks = [
      new THREE.Vector2(0, 0),
    ].map(position => _renderMapChunk(mapUtils.makeMapChunk({
      position,
    })));

    const mapComponent = {
      selector: 'map[position]',
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0, 1.2, 0,
            0, 0, 0, 1,
            1, 1, 1,
          ],
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();
        const entityObject = entityElement.getObject();

        const mesh = (() => {
          const object = new THREE.Object3D();

          const meshes = mapChunks.map(canvas => {
            const {position} = canvas;

            const geometry = new THREE.PlaneBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT)
              .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));

            const texture = new THREE.Texture(
              canvas,
              THREE.UVMapping,
              THREE.ClampToEdgeWrapping,
              THREE.ClampToEdgeWrapping,
              THREE.NearestFilter,
              THREE.NearestFilter,
              THREE.RGBAFormat,
              THREE.UnsignedByteType,
              1
            );
            texture.needsUpdate = true;
            const material = new THREE.MeshPhongMaterial({
              // color: 0xFFFFFF,
              map: texture,
              shininess: 10,
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(position.x * WORLD_WIDTH, 0, position.y * WORLD_HEIGHT);
            return mesh;
          });
          meshes.forEach(mesh => {
            object.add(mesh);
          });

          return object;
        })();
        entityObject.add(mesh);

        entityApi.align = () => {
          // XXX implement this
        };

        entityApi._cleanup = () => {
          entityObject.remove(mesh);
        };
      },
      entityRemovedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();

        entityApi._cleanup();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getComponentApi();

        switch (name) {
          case 'position': {
            entityApi.position = newValue;

            entityApi.align();

            break;
          }
        }
      },
    };
    elements.registerComponent(this, mapComponent);

    this._cleanup = () => {
      elements.unregisterComponent(this, mapComponent);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Map;
