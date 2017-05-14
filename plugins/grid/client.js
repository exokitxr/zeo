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
      rng: new alea('z16'),
    });

    const _renderMapChunk = mapChunk => {
      const {position, points} = mapChunk;

      const mapCanvas = document.createElement('canvas');
      mapCanvas.width = NUM_CELLS;
      mapCanvas.height = NUM_CELLS;
      mapCanvas.position = position;
      const mapCanvasCtx = mapCanvas.getContext('2d');
      const mapCanvasImageData = mapCanvasCtx.getImageData(0, 0, mapCanvas.width, mapCanvas.height);
      const {data: mapCanvasImageDataData} = mapCanvasImageData;

      const displacementMapCanvas = document.createElement('canvas');
      displacementMapCanvas.width = NUM_CELLS;
      displacementMapCanvas.height = NUM_CELLS;
      displacementMapCanvas.position = position;
      const displacementMapCanvasCtx = displacementMapCanvas.getContext('2d');
      const displacementMapCanvasImageData = displacementMapCanvasCtx.getImageData(0, 0, mapCanvas.width, mapCanvas.height);
      const {data: displacementMapCanvasImageDataData} = displacementMapCanvasImageData;

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

          const {elevation} = point;
          const elevationFactor = elevation / 10 * 255;
          displacementMapCanvasImageDataData[baseImageDataIndex + 0] = elevationFactor;
          displacementMapCanvasImageDataData[baseImageDataIndex + 1] = elevationFactor;
          displacementMapCanvasImageDataData[baseImageDataIndex + 2] = elevationFactor;
          displacementMapCanvasImageDataData[baseImageDataIndex + 3] = elevationFactor;
        }
      }
      mapCanvasCtx.putImageData(mapCanvasImageData, 0, 0);
      displacementMapCanvasCtx.putImageData(displacementMapCanvasImageData, 0, 0);

      return {
        map: mapCanvas,
        displacementMap: displacementMapCanvas,
      };
    };

    const mapChunks = [
      new THREE.Vector2(0, 0),
    ].map(position => _renderMapChunk(mapUtils.makeMapChunk({
      position,
    })));

    const gridComponent = {
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

          const meshes = mapChunks.map(({map: mapCanvas, displacementMap: displacementMapCanvas}) => {
            const {position} = mapCanvas;

            const geometry = new THREE.PlaneBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT, WIDTH, HEIGHT)
              .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
              .applyMatrix(new THREE.Matrix4().makeRotationY(-Math.PI / 2));

            const mapTexture = new THREE.Texture(
              mapCanvas,
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

            const displacementMapTexture = new THREE.Texture(
              displacementMapCanvas,
              THREE.UVMapping,
              THREE.ClampToEdgeWrapping,
              THREE.ClampToEdgeWrapping,
              THREE.NearestFilter,
              THREE.NearestFilter,
              THREE.RGBAFormat,
              THREE.UnsignedByteType,
              1
            );
            displacementMapTexture.needsUpdate = true;

            /* const normalMapTexture = new THREE.Texture(
              displacementMapCanvas,
              THREE.UVMapping,
              THREE.ClampToEdgeWrapping,
              THREE.ClampToEdgeWrapping,
              THREE.LinearFilter,
              THREE.LinearFilter,
              THREE.RGBAFormat,
              THREE.UnsignedByteType,
              1
            );
            normalMapTexture.needsUpdate = true; */

            const material = new THREE.MeshPhongMaterial({
              // color: 0xFFFFFF,
              map: mapTexture,
              displacementMap: displacementMapTexture,
              displacementScale: 100,
              // normalMap: normalMapTexture,
              // normalMap: normalMapTexture,
              // lightMap: normalMapTexture,
              // lightMapIntensity: 10,
              shininess: 10,
              /// shading: THREE.FlatShading,
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
