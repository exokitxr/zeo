import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
  NUM_CELLS,

  FOREGROUND_WIDTH,
  FOREGROUND_HEIGHT,
  FOREGROUND_WORLD_WIDTH,
  FOREGROUND_WORLD_HEIGHT,
  FOREGROUND_WORLD_DEPTH,
} from './lib/constants/universe';
import menuUtils from './lib/utils/menu';
import mapUtilsMaker from './lib/utils/map-utils';
import universeRenderer from './lib/render/universe';

import indev from 'indev';
// import Kruskal from 'kruskal';

const SIDES = ['left', 'right'];

class Universe {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata} = archae;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/three',
      '/core/engines/webvr',
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/plugins/random-utils',
    ]).then(([
      three,
      webvr,
      biolumi,
      rend,
      randomUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        const {alea} = randomUtils;

        const transparentMaterial = biolumi.getTransparentMaterial();
        const solidMaterial = biolumi.getSolidMaterial();

        const _decomposeObjectMatrixWorld = object => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          object.matrixWorld.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        class World {
          constructor(worldName, point) {
            this.worldName = worldName;
            this.point = point;
          }
        }

        const _requestUis = () => Promise.all([
          biolumi.requestUi({
            width: WIDTH,
            height: HEIGHT,
          }),
          /* biolumi.requestUi({
            width: FOREGROUND_WIDTH,
            height: FOREGROUND_HEIGHT,
          }), */
        ])
          .then(([
            backgroundUi,
            // foregroundUi,
          ]) => ({
            backgroundUi,
            // foregroundUi,
          }));

        return _requestUis()
          .then(({
            backgroundUi,
            // foregroundUi,
          }) => {
            if (live) {
              const rng = new alea('');
              const mapUtils = mapUtilsMaker.makeUtils({rng});

              const _makeMapChunk = spec => _decorateMapChunk(mapUtils.makeMapChunk(spec));
              const _decorateMapChunk = mapChunk => {
                const generator = indev({
                  random: rng,
                });
                const mapNoise = generator.simplex({
                  frequency: 0.05,
                  octaves: 4,
                });
                const worldNoise = generator.simplex({
                  frequency: 0.05,
                  octaves: 4,
                });

                const worlds = (() => {
                  const numPoints = 10;
                  const heightScale = 0.2;
                  const heightOffset = (0.005 * 12) / 2;

                  const result = Array(numPoints);
                  for (let i = 0; i < numPoints; i++) {
                    const x = rng() * NUM_CELLS;
                    const y = rng() * NUM_CELLS;
                    const point = new THREE.Vector2(x, y);
                    const world = new World('world' + _pad(i, 2), point);
                    result[i] = world;
                  }
                  return result;
                })();
                mapChunk.worlds = worlds;

                return mapChunk;
              };
              const _renderMapChunk = mapChunk => {
                const {points} = mapChunk;

                const canvas = document.createElement('canvas');
                canvas.width = NUM_CELLS;
                canvas.height = NUM_CELLS;
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

                return canvas.toDataURL('image/png');
              };

              const mapState = {
                mapChunks: [
                  _makeMapChunk({
                    position: new THREE.Vector2(0, 0),
                  }),
                ],
              };

              const backgroundImageState = {
                mapChunks: mapState.mapChunks.map(_renderMapChunk),
              };

              backgroundUi.pushPage(({backgroundImage}) => ([
                {
                  type: 'html',
                  src: universeRenderer.getBackgroundImageSrc(backgroundImage),
                  x: 0,
                  y: 0,
                  w: WIDTH,
                  h: HEIGHT,
                  scroll: true,
                  pixelated: true,
                },
              ]), {
                type: 'background',
                state: {
                  backgroundImage: backgroundImageState,
                },
                immediate: true,
              });

              const menuMesh = (() => {
                const object = new THREE.Object3D();
                object.position.z = -1;
                object.visible = false;

                const backgroundMesh = (() => {
                  const width = WORLD_WIDTH;
                  const height = WORLD_HEIGHT;
                  const depth = WORLD_DEPTH;

                  const menuMaterial = biolumi.makeMenuMaterial();

                  const geometry = new THREE.PlaneBufferGeometry(width, height);
                  const materials = [solidMaterial, menuMaterial];

                  const mesh = THREE.SceneUtils.createMultiMaterialObject(geometry, materials);
                  mesh.receiveShadow = true;
                  mesh.menuMaterial = menuMaterial;

                  const shadowMesh = (() => {
                    const geometry = new THREE.BoxBufferGeometry(width, height, 0.01);
                    const material = transparentMaterial;
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.castShadow = true;
                    return mesh;
                  })();
                  mesh.add(shadowMesh);

                  return mesh;
                })();
                object.add(backgroundMesh);
                object.backgroundMesh = backgroundMesh;

                const foregroundMesh = (() => {
                  const geometry = new THREE.BufferGeometry();
                  const positions = (() => {
                    const array = [];

                    const {mapChunks} = mapState;
                    for (let i = 0; i < mapChunks.length; i++) {
                      const mapChunk = mapChunks[i];
                      const {position, worlds} = mapChunk;

                      for (let j = 0; j < worlds.length; j++) {
                        const world = worlds[j];
                        const {point} = world;

                        array.push(
                          -(WORLD_WIDTH / 2) + ((WORLD_WIDTH - WORLD_HEIGHT) / 2) + (point.x / NUM_CELLS * WORLD_HEIGHT),
                          (WORLD_HEIGHT / 2) - (point.y / NUM_CELLS * WORLD_HEIGHT),
                          0.05
                        );
                      }
                    }

                    return Float32Array.from(array);
                  })();
                  geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
                  const material = new THREE.PointsMaterial({
                    color: 0xFF0000,
                    size: 0.02,
                  });

                  const mesh = new THREE.Points(geometry, material);
                  mesh.receiveShadow = true;

                  return mesh;
                })();
                object.add(foregroundMesh);
                object.foregroundMesh = foregroundMesh;

                return object;
              })();
              rend.addMenuMesh('universeMesh', menuMesh);

              const backgroundDotMeshes = {
                left: biolumi.makeMenuDotMesh(),
                right: biolumi.makeMenuDotMesh(),
              };
              scene.add(backgroundDotMeshes.left);
              scene.add(backgroundDotMeshes.right);
              const backgroundBoxMeshes = {
                left: biolumi.makeMenuBoxMesh(),
                right: biolumi.makeMenuBoxMesh(),
              };
              scene.add(backgroundBoxMeshes.left);
              scene.add(backgroundBoxMeshes.right);

              const backgroundHoverStates = {
                left: biolumi.makeMenuHoverState(),
                right: biolumi.makeMenuHoverState(),
              };

              const _updatePages = menuUtils.debounce(next => {
                const backgroundPages = backgroundUi.getPages();
                const foregroundPages = foregroundUi.getPages()
                const pages = backgroundPages.concat(foregroundPages);

                if (pages.length > 0) {
                  let pending = pages.length;
                  const pend = () => {
                    if (--pending === 0) {
                      next();
                    }
                  };

                  for (let i = 0; i < pages.length; i++) {
                    const page = pages[i];
                    const {type} = page;

                    if (type === 'background') {
                      page.update({
                        backgroundImage: backgroundImageState,
                      }, pend);
                    } else if (type === 'foreground') {
                      page.update({
                        foregroundImage: foregroundImageState,
                      }, pend);
                    } else {
                      pend();
                    }
                  }
                } else {
                  next();
                }
              });

              const _update = () => {
                const _updateTextures = () => {
                  const tab = rend.getTab();

                  if (tab === 'worlds') {
                    const {
                      backgroundMesh: {
                        menuMaterial: backgroundMenuMaterial,
                      },
                    } = menuMesh;
                    const uiTime = rend.getUiTime();

                    biolumi.updateMenuMaterial({
                      ui: backgroundUi,
                      menuMaterial: backgroundMenuMaterial,
                      uiTime,
                    });
                  }
                };
                const _updateAnchors = () => {
                  const {backgroundMesh} = menuMesh;
                  const backgroundMatrixObject = _decomposeObjectMatrixWorld(backgroundMesh);
                  const {gamepads} = webvr.getStatus();

                  SIDES.forEach(side => {
                    const gamepad = gamepads[side];

                    if (gamepad) {
                      const {position: controllerPosition, rotation: controllerRotation} = gamepad;

                      const backgroundHoverState = backgroundHoverStates[side];
                      const backgroundDotMesh = backgroundDotMeshes[side];
                      const backgroundBoxMesh = backgroundBoxMeshes[side];

                      biolumi.updateAnchors({
                        objects: [{
                          matrixObject: backgroundMatrixObject,
                          ui: backgroundUi,
                          width: WIDTH,
                          height: HEIGHT,
                          worldWidth: WORLD_WIDTH,
                          worldHeight: WORLD_HEIGHT,
                          worldDepth: WORLD_DEPTH,
                        }],
                        hoverState: backgroundHoverState,
                        dotMesh: backgroundDotMesh,
                        boxMesh: backgroundBoxMesh,
                        controllerPosition,
                        controllerRotation,
                      })
                    }
                  });
                };

                _updateTextures();
                _updateAnchors();
              };
              rend.on('update', _update);

              this._cleanup = () => {
                rend.removeMenuMesh('universeMesh');

                SIDES.forEach(side => {
                  scene.remove(backgroundDotMeshes[side]);
                  scene.remove(backgroundBoxMeshes[side]);
                });

                rend.removeListener('update', _update);
              };
            }
          });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _pad = (n, width) => {
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
};

module.exports = Universe;
