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

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/three',
      '/core/engines/webvr',
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/plugins/geometry-utils',
      '/core/plugins/random-utils',
    ]).then(([
      three,
      webvr,
      biolumi,
      rend,
      geometryUtils,
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

        const zeroQuaternion = new THREE.Quaternion();
        const oneVector = new THREE.Vector3(1, 1, 1);

        class World {
          constructor(worldName, point) {
            this.worldName = worldName;
            this.point = point;
          }

          get3dPoint() {
            const {point} = this;

            return new THREE.Vector3(
              -(WORLD_WIDTH / 2) + ((WORLD_WIDTH - WORLD_HEIGHT) / 2) + (point.x / NUM_CELLS * WORLD_HEIGHT),
              (WORLD_HEIGHT / 2) - (point.y / NUM_CELLS * WORLD_HEIGHT),
              0.05
            );
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

              const menuMesh = (() => {
                const object = new THREE.Object3D();
                object.position.z = -1.5;
                object.visible = false;

                const backgroundMesh = (() => {
                  const object = new THREE.Object3D();

                  const planeMesh = (() => {
                    const mesh = backgroundUi.addPage(({backgroundImage}) => ([
                      {
                        type: 'html',
                        src: universeRenderer.getBackgroundImageSrc(backgroundImage),
                        x: 0,
                        y: 0,
                        w: WIDTH,
                        h: HEIGHT,
                        pixelated: true,
                      },
                    ]), {
                      type: 'background',
                      state: {
                        backgroundImage: backgroundImageState,
                      },
                      worldWidth: WORLD_WIDTH,
                      worldHeight: WORLD_HEIGHT,
                    });
                    mesh.receiveShadow = true;

                    return mesh;
                  })();
                  object.add(planeMesh);
                  object.planeMesh = planeMesh;

                  const shadowMesh = (() => {
                    const geometry = new THREE.BoxBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT, 0.01);
                    const material = transparentMaterial;
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.castShadow = true;
                    return mesh;
                  })();
                  object.add(shadowMesh);

                  return object;
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
                        const point = world.get3dPoint();

                        array.push(point.x, point.y, point.z);
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
              rend.registerMenuMesh('universeMesh', menuMesh);

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

              const _makeForegroundDotMesh = () => biolumi.makeMenuDotMesh({size: 0.05});
              const foregroundDotMeshes = {
                left: _makeForegroundDotMesh(),
                right: _makeForegroundDotMesh(),
              };
              scene.add(foregroundDotMeshes.left);
              scene.add(foregroundDotMeshes.right);

              const _updatePages = () => {
                backgroundUi.update();
                foregroundUi.update();
              };
              _updatePages();

              const _update = () => {
                const tab = rend.getTab();

                if (tab === 'worlds') {
                  const _updateAnchors = () => {
                    const _updateBackgroundAnchors = () => {
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
                    const _updateForegroundAnchors = () => {
                      const pointSpecs = (() => {
                        const result = [];

                        const size = 0.1;
                        const sizeVector = new THREE.Vector3(size, size, size);

                        const {mapChunks} = mapState;
                        for (let i = 0; i < mapChunks.length; i++) {
                          const mapChunk = mapChunks[i];
                          const {position, worlds} = mapChunk;

                          for (let j = 0; j < worlds.length; j++) {
                            const world = worlds[j];
                            const point = world.get3dPoint().applyMatrix4(menuMesh.matrixWorld);
                            const boxTarget = geometryUtils.makeBoxTarget(
                              point,
                              zeroQuaternion,
                              oneVector,
                              sizeVector
                            );
                            result.push({
                              world,
                              point,
                              boxTarget,
                            });
                          }
                        }

                        return result;
                      })();

                      const {gamepads} = webvr.getStatus();
                      SIDES.forEach(side => {
                        const gamepad = gamepads[side];

                        if (gamepad) {
                          const {position: controllerPosition, rotation: controllerRotation} = gamepad;
                          const controllerLine = new THREE.Line3(
                            controllerPosition.clone(),
                            controllerPosition.clone().add(new THREE.Vector3(0, 0, -1).applyQuaternion(controllerRotation).multiplyScalar(15))
                          );
                          const pointIntersectionSpecs = pointSpecs
                            .map(pointSpec => {
                              const {boxTarget} = pointSpec;
                              const intersectionPoint = boxTarget.intersectLine(controllerLine);

                              if (intersectionPoint) {
                                const {world, point} = pointSpec;
                                const distance = controllerPosition.distanceTo(intersectionPoint);

                                return {
                                  world,
                                  point,
                                  intersectionPoint,
                                  distance,
                                };
                              } else {
                                return null;
                              }
                            })
                            .filter(pointIntersectionSpec => pointIntersectionSpec !== null);
                          const foregroundDotMesh = foregroundDotMeshes[side];

                          if (pointIntersectionSpecs.length > 0) {
                            const {point} = pointIntersectionSpecs.sort((a, b) => a.distance - b.distance)[0];

                            foregroundDotMesh.position.copy(point);

                            if (!foregroundDotMesh.visible) {
                              foregroundDotMesh.visible = true;
                            }
                          } else {
                            if (foregroundDotMesh.visible) {
                              foregroundDotMesh.visible = false;
                            }
                          }
                        }
                      });
                    };

                    _updateBackgroundAnchors();
                    _updateForegroundAnchors();
                  };
                  _updateAnchors();
                }
              };
              rend.on('update', _update);

              this._cleanup = () => {
                SIDES.forEach(side => {
                  scene.remove(backgroundDotMeshes[side]);
                  scene.remove(backgroundBoxMeshes[side]);
                  scene.remove(foregroundDotMeshes[side]);
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
