import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  RESOLUTION,
  NUM_CELLS,
} from './lib/constants/grid';
import mapUtilsMaker from './lib/utils/map-utils';

class Grid {
  mount() {
    const {three: {THREE, scene, camera}, elements, teleport, utils: {geometry: geometryUtils, random: randomUtils}} = zeo;
    const {alea} = randomUtils;

    const _decomposeObjectMatrixWorld = object => {
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      object.matrixWorld.decompose(position, rotation, scale);
      return {position, rotation, scale};
    };

    const mapUtils = mapUtilsMaker.makeUtils({
      rng: new alea('z16'),
    });

    const _renderMapChunk = mapChunk => {
      const {position, points} = mapChunk;

      const mapCanvas = document.createElement('canvas');
      mapCanvas.width = NUM_CELLS;
      mapCanvas.height = NUM_CELLS;
      const mapCanvasCtx = mapCanvas.getContext('2d');
      const mapCanvasImageData = mapCanvasCtx.getImageData(0, 0, mapCanvas.width, mapCanvas.height);
      const {data: mapCanvasImageDataData} = mapCanvasImageData;

      for (let y = 0; y < NUM_CELLS; y++) {
        for (let x = 0; x < NUM_CELLS; x++) {
          const baseIndex = mapUtils.getCoordIndex(x, y);
          const baseImageDataIndex = baseIndex * 4;

          const point = points[baseIndex];
          const {biome} = point;
          const colorHex = mapUtils.getBiomeColor(biome);
          const color = new THREE.Color(colorHex);
          mapCanvasImageDataData[baseImageDataIndex + 0] = color.r * 255;
          mapCanvasImageDataData[baseImageDataIndex + 1] = color.g * 255;
          mapCanvasImageDataData[baseImageDataIndex + 2] = color.b * 255;
          mapCanvasImageDataData[baseImageDataIndex + 3] = 255;
        }
      }
      mapCanvasCtx.putImageData(mapCanvasImageData, 0, 0);

      return {
        position: position,
        points: points,
        mapImage: mapCanvas,
      };
    };

    const mapChunks = [
      new THREE.Vector2(0, 0),
    ].map(position => _renderMapChunk(mapUtils.makeMapChunk({
      position,
    })));

    const gridComponent = {
      selector: 'grid[position]',
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0, 1.2, 0,
            0, 0, 0, 1,
            1, 1, 1,
          ],
        },
        raycastable: {
          type: 'checkbox',
          value: true,
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();
        const entityObject = entityElement.getObject();

        const mesh = (() => {
          const object = new THREE.Object3D();

          const meshes = mapChunks.map(({position, points, mapImage}) => {
            const geometry = geometryUtils.unindexBufferGeometry(new THREE.PlaneBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT, WIDTH, HEIGHT));
            const positionAttribute = geometry.getAttribute('position');
            const {array: positions} = positionAttribute;
            const numPositions = positions.length / 3;
            for (let i = 0; i < numPositions; i++) {
              const positionIndex = i * 3;
              const x = Math.round((positions[positionIndex + 0] + WORLD_WIDTH / 2) / WORLD_WIDTH * NUM_CELLS);
              const y = Math.round(-(positions[positionIndex + 1] - WORLD_HEIGHT / 2) / WORLD_HEIGHT * NUM_CELLS);

              if (x < NUM_CELLS && y < NUM_CELLS) {
                const pointIndex = mapUtils.getCoordIndex(x, y);
                const point = points[pointIndex];
                const {elevation} = point;

                const elevationFactor = Math.max(elevation, 0) * 10;
                positions[positionIndex + 2] = elevationFactor;
              }
            }
            geometry
              .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
              .applyMatrix(new THREE.Matrix4().makeRotationY(-Math.PI / 2));
            geometry.computeBoundingBox();

            const mapTexture = new THREE.Texture(
              mapImage,
              THREE.UVMapping,
              THREE.ClampToEdgeWrapping,
              THREE.ClampToEdgeWrapping,
              THREE.NearestFilter,
              THREE.NearestFilter,
              THREE.RGBAFormat,
              THREE.UnsignedByteType,
              1
            );
            mapTexture.needsUpdate = true;

            const material = new THREE.MeshPhongMaterial({
              map: mapTexture,
              shininess: 10,
              wireframe: true,
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
        teleport.addTarget(mesh);

        entityApi.align = () => {
          // XXX implement this
        };

        entityApi._cleanup = () => {
          entityObject.remove(mesh);
          teleport.removeTarget(mesh);
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
    elements.registerComponent(this, gridComponent);

    this._cleanup = () => {
      elements.unregisterComponent(this, gridComponent);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Grid;
