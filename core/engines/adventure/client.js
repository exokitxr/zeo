import {
  WIDTH,
  HEIGHT,

  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} from './lib/constants/adventure';
import adventureRender from './lib/render/adventure';
import menuUtils from './lib/utils/menu';

const SIDES = ['left', 'right'];

const DEFAULT_GRAB_RADIUS = 0.4;
const DEFAULT_CONTRACT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const adventureFlagSymbol = Symbol();

class Adventure {
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
      '/core/engines/input',
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/engines/hands',
      '/core/plugins/creature-utils',
    ])
      .then(([
        three,
        input,
        biolumi,
        rend,
        hands,
        creatureUtils,
      ]) => {
        if (live) {
          const {THREE, scene, camera} = three;

          const transparentMaterial = biolumi.getTransparentMaterial();
          const solidMaterial = biolumi.getSolidMaterial();

          const adventureRenderer = adventureRender.makeRenderer({creatureUtils});

          const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
          const _decomposeMatrix = matrix => {
            const position = new THREE.Vector3();
            const rotation = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            matrix.decompose(position, rotation, scale);
            return {position, rotation, scale};
          };

          const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x0000FF,
            wireframe: true,
            opacity: 0.5,
            transparent: true,
          });

          const _makeHoverState = () => ({
            adventureMesh: null,
          });
          const hoverStates = {
            left: _makeHoverState(),
            right: _makeHoverState(),
          };

          const _makeGrabState = () => ({
            grabber: null,
          });
          const grabStates = {
            left: _makeGrabState(),
            right: _makeGrabState(),
          };

          const _makeBoxMesh = () => {
            const width = WORLD_WIDTH;
            const height = WORLD_HEIGHT;
            const depth = WORLD_DEPTH;

            const geometry = new THREE.BoxBufferGeometry(width, height, depth);
            const material = wireframeMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.y = 1.2;
            mesh.rotation.order = camera.rotation.order;
            mesh.rotation.y = Math.PI / 2;
            mesh.depthWrite = false;
            mesh.visible = false;
            return mesh;
          };
          const boxMeshes = {
            left: _makeBoxMesh(),
            right: _makeBoxMesh(),
          };
          scene.add(boxMeshes.left);
          scene.add(boxMeshes.right);

          const _updatePages = menuUtils.debounce(next => {
            const pageSpecs = (() => {
              const result = [];

              for (let i = 0; i < adventureMeshes.length; i++) {
                const adventureMesh = adventureMeshes[i];
                const {ui, adventure} = adventureMeshes;

                if (ui) {
                  const pages = ui.getPages();

                  for (let j = 0; j < pages.length; j++) {
                    const page = pages[j];
                    const pageSpec = {
                      page,
                      adventure,
                    };
                    result.push(pageSpec);
                  }
                }
              }

              return result;
            })();

            if (pageSpecs.length > 0) {
              let pending = pageSpecs.length;
              const pend = () => {
                if (--pending === 0) {
                  next();
                }
              };

              for (let i = 0; i < pageSpecs.length; i++) {
                const pageSpec = pageSpecs[i];
                const {page} = pageSpec;
                const {type} = page;

                if (type === 'adventure') {
                  const {adventure} = pageSpec;

                  page.update({
                    adventure,
                  }, pend);
                } else {
                  pend();
                }
              }
            } else {
              next();
            }
          });

          const _gripdown = e => {
            const {side} = e;

            const bestGrabbableAdventureMesh = hands.getBestGrabbable(side, adventureMeshes, {radius: DEFAULT_GRAB_RADIUS});
            if (bestGrabbableAdventureMesh) {
              adventureInstance.grabAdventure(side, bestGrabbableAdventureMesh);
            }
          };
          input.on('gripdown', _gripdown);
          const _gripup = e => {
            const {side} = e;
            const grabState = grabStates[side];
            const {grabber} = grabState;

            if (grabber) {
              grabber.release();
            }
          };
          input.on('gripup', _gripup);
          const _update = () => {
            const _updateControllers = () => {
              SIDES.forEach(side => {
                const hoverState = hoverStates[side];
                const boxMesh = boxMeshes[side];

                const bestGrabbableAdventureMesh = hands.getBestGrabbable(side, adventureMeshes, {radius: DEFAULT_GRAB_RADIUS});
                if (bestGrabbableAdventureMesh) {
                  hoverState.adventureMesh = bestGrabbableAdventureMesh;

                  const {position: adventureMeshPosition, rotation: adventureMeshRotation} = _decomposeObjectMatrixWorld(bestGrabbableAdventureMesh);
                  boxMesh.position.copy(adventureMeshPosition);
                  boxMesh.quaternion.copy(adventureMeshRotation);

                  if (!boxMesh.visible) {
                    boxMesh.visible = true;
                  }
                } else {
                  hoverState.adventureMesh = null;

                  if (boxMesh.visible) {
                    boxMesh.visible = false;
                  }
                }
              });
            };
            const _updateTextures = () => {
              const uiTime = rend.getUiTime();

              for (let i = 0; i < adventureMeshes.length; i++) {
                const adventureMesh = adventureMeshes[i];
                const {
                  ui,
                  planeMesh,
                } = adventureMesh;

                if (ui && planeMesh) {
                  const {menuMaterial} = planeMesh;

                  biolumi.updateMenuMaterial({
                    ui,
                    menuMaterial,
                    uiTime,
                  });
                }
              }
            };

            _updateControllers();
            _updateTextures();
          };
          rend.on('update', _update);

          this._cleanup = () => {
            for (let i = 0; i < adventureMeshes.length; i++) {
              const adventureMesh = adventureMeshes[i];
              adventureMesh.parent.remove(adventureMesh);
            }
            SIDES.forEach(side => {
              scene.remove(boxMeshes[side]);
            });

            input.removeListener('gripdown', _gripdown);
            input.removeListener('gripup', _gripup);
            rend.removeListener('update', _update);
          };

          class Adventure {
            constructor(id, name, author, created, matrix) {
              this.id = id;
              this.name = name;
              this.author = author;
              this.created = created;
              this.matrix = matrix;
            }
          }

          const adventureMeshes = [];
          class AdventureApi {
            makeAdventure(adventureSpec) {
              const object = new THREE.Object3D();
              object[adventureFlagSymbol] = true;

              const adventure = new Adventure(adventureSpec.id, adventureSpec.name, adventureSpec.author, adventureSpec.created, adventureSpec.matrix);
              object.adventure = adventure;

              object.position.set(adventure.matrix[0], adventure.matrix[1], adventure.matrix[2]);
              object.quaternion.set(adventure.matrix[3], adventure.matrix[4], adventure.matrix[5], adventure.matrix[6]);
              object.scale.set(adventure.matrix[7], adventure.matrix[8], adventure.matrix[9]);

              object.ui = null;
              object.planeMesh = null;

              this._requestDecorateAdventure(object);

              adventureMeshes.push(object);

              return object;
            }

            _requestDecorateAdventure(object) {
              return biolumi.requestUi({
                width: WIDTH,
                height: HEIGHT,
              })
                .then(ui => {
                  const {adventure} = object;

                  ui.pushPage(({adventure}) => ([
                    {
                      type: 'html',
                      src: adventureRenderer.getAdventureSrc(adventure),
                    },
                    /* {
                      type: 'image',
                      img: creatureUtils.makeAnimatedCreature('adventure:' + adventure.name),
                      x: 10,
                      y: 0,
                      w: 100,
                      h: 100,
                      frameTime: 300,
                      pixelated: true,
                    } */
                  ]), {
                    type: 'adventurce',
                    state: {
                      adventure,
                    },
                    immediate: true,
                  });
                  object.ui = ui;

                  _updatePages();

                  const planeMesh = (() => {
                    const width = WORLD_WIDTH;
                    const height = WORLD_HEIGHT;
                    const depth = WORLD_DEPTH;

                    const menuMaterial = biolumi.makeMenuMaterial();

                    const geometry = new THREE.PlaneBufferGeometry(width, height);
                    const materials = [solidMaterial, menuMaterial];

                    const mesh = THREE.SceneUtils.createMultiMaterialObject(geometry, materials)
                    // mesh.position.y = 1.5;
                    mesh.receiveShadow = true;
                    mesh.menuMaterial = menuMaterial;

                    return mesh;
                  })();
                  object.add(planeMesh);
                  object.planeMesh = planeMesh;

                  /* const lineMesh = (() => {
                    const geometry = new THREE.BufferGeometry();
                    const positions = Float32Array.from([
                      -WORLD_WIDTH / 2, -WORLD_HEIGHT / 2, 0,
                      -WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 0,
                      WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 0,
                      WORLD_WIDTH / 2, -WORLD_HEIGHT / 2, 0,
                      -WORLD_WIDTH / 2, -WORLD_HEIGHT / 2, 0,
                    ]);
                    geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));

                    const material = new THREE.LineBasicMaterial({
                      color: 0x808080,
                    });

                    const mesh = new THREE.Line(geometry, material);
                    mesh.frustumCulled = false;
                    return mesh;
                  })();
                  object.add(lineMesh); */

                  const shadowMesh = (() => {
                    const geometry = new THREE.BoxBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT, 0.01);
                    const material = transparentMaterial.clone();
                    material.depthWrite = false;

                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.castShadow = true;
                    return mesh;
                  })();
                  object.add(shadowMesh);
                });
            };

            destroyAdventure(adventureMesh) {
              const index = adventureMeshes.indexOf(adventureMesh);

              if (index !== -1) {
                adventureMeshes.splice(index, 1);
              }
            }

            getHoverAdventure(side) {
              return hoverStates[side].adventureMesh;
            }

            isAdventure(object) {
              return object[adventureFlagSymbol] === true;
            }

            grabAdventure(side, adventureMesh) {
              const menuMesh = rend.getMenuMesh();
              menuMesh.add(adventureMesh);

              const {adventure} = adventureMesh;
              adventure.matrix = DEFAULT_CONTRACT_MATRIX;

              const grabber = hands.grab(side, adventureMesh);
              grabber.on('update', ({position, rotation}) => {
                const menuMeshMatrixInverse = new THREE.Matrix4().getInverse(menuMesh.matrix);
                const menuMeshQuaternionInverse = menuMesh.quaternion.clone().inverse();

                const newRotation = menuMeshQuaternionInverse.clone()
                  .multiply(rotation)
                  .multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1)));
                const newPosition = position.clone().applyMatrix4(menuMeshMatrixInverse)
                  .add(
                    new THREE.Vector3(0, 0.02, 0).applyQuaternion(newRotation)
                  );

                adventureMesh.position.copy(newPosition);
                adventureMesh.quaternion.copy(newRotation);
              });
              grabber.on('release', () => {
                const {position, quaternion, adventure} = adventureMesh;
                const newMatrixArray = position.toArray().concat(quaternion.toArray()).concat(new THREE.Vector3(1, 1, 1).toArray());
                adventure.matrix = newMatrixArray;

                grabState.grabber = null;
              });

              const grabState = grabStates[side];
              grabState.grabber = grabber;
            }

            updatePages() {
              _updatePages();
            }
          };

          const adventureInstance = new AdventureApi();
          return adventureInstance;
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

const _clone = o => JSON.parse(JSON.stringify(o));

module.exports = Adventure;
