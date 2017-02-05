import {
  WIDTH,
  HEIGHT,

  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} from './lib/constants/contract';
import contractRenderer from './lib/render/contract';
import menuUtils from './lib/utils/menu';

const SIDES = ['left', 'right'];

const DEFAULT_GRAB_RADIUS = 0.1;
const DEFAULT_CONTRACT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const contractFlagSymbol = Symbol();

class Contract {
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
            contractMesh: null,
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

              for (let i = 0; i < contractMeshes.length; i++) {
                const contractMeshes = contractMeshes[i];
                const {ui, contract} = contractMeshes;

                if (ui) {
                  const pages = ui.getPages();

                  for (let j = 0; j < pages.length; j++) {
                    const page = pages[j];
                    const pageSpec = {
                      page,
                      contract,
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

                if (type === 'contract') {
                  const {contract} = pageSpec;

                  page.update({
                    contract,
                  }, pend);
                }
              }
            } else {
              next();
            }
          });

          const _gripdown = e => {
            const {side} = e;

            const bestGrabbableContractMesh = hands.getBestGrabbable(side, contractMeshes, {radius: DEFAULT_GRAB_RADIUS});
            if (bestGrabbableContractMesh) {
              contractInstance.grabContract(side, bestGrabbableContractMesh);
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

                const bestGrabbableContractMesh = hands.getBestGrabbable(side, contractMeshes, {radius: DEFAULT_GRAB_RADIUS});
                if (bestGrabbableContractMesh) {
                  hoverState.contractMesh = bestGrabbableContractMesh;

                  const {position: contractMeshPosition, rotation: contractMeshRotation} = _decomposeObjectMatrixWorld(bestGrabbableContractMesh);
                  boxMesh.position.copy(contractMeshPosition);
                  boxMesh.quaternion.copy(contractMeshRotation);

                  if (!boxMesh.visible) {
                    boxMesh.visible = true;
                  }
                } else {
                  hoverState.contractMesh = null;

                  if (boxMesh.visible) {
                    boxMesh.visible = false;
                  }
                }
              });
            };
            const _updateTextures = () => {
              const uiTime = rend.getUiTime();

              for (let i = 0; i < contractMeshes.length; i++) {
                const contractMesh = contractMeshes[i];
                const {
                  ui,
                  planeMesh,
                } = contractMesh;

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
            for (let i = 0; i < contractMeshes.length; i++) {
              const contractMesh = contractMeshes[i];
              contractMesh.parent.remove(contractMesh);
            }
            SIDES.forEach(side => {
              scene.remove(boxMeshes[side]);
            });

            input.removeListener('gripdown', _gripdown);
            input.removeListener('gripup', _gripup);
            rend.removeListener('update', _update);
          };

          class Contract {
            constructor(name, author, matrix) {
              this.name = name;
              this.author = author;
              this.matrix = matrix;
            }
          }

          const contractMeshes = [];
          class ContractApi {
            makeContract(contractSpec) {
              const object = new THREE.Object3D();
              object[contractFlagSymbol] = true;

              const contract = new Contract(contractSpec.name, contractSpec.author, contractSpec.matrix);
              object.contract = contract;

              object.position.set(contract.matrix[0], contract.matrix[1], contract.matrix[2]);
              object.quaternion.set(contract.matrix[3], contract.matrix[4], contract.matrix[5], contract.matrix[6]);
              object.scale.set(contract.matrix[7], contract.matrix[8], contract.matrix[9]);

              object.ui = null;
              object.planeMesh = null;

              this._requestDecorateContract(object);

              contractMeshes.push(object);

              return object;
            }

            _requestDecorateContract(object) {
              return biolumi.requestUi({
                width: WIDTH,
                height: HEIGHT,
              })
                .then(ui => {
                  const {contract} = object;

                  ui.pushPage(({contract}) => ([
                    {
                      type: 'html',
                      src: contractRenderer.getContractSrc(contract),
                    },
                    {
                      type: 'image',
                      img: creatureUtils.makeAnimatedCreature('contract:' + contract.name),
                      x: 10,
                      y: 0,
                      w: 100,
                      h: 100,
                      frameTime: 300,
                      pixelated: true,
                    }
                  ]), {
                    type: 'contract',
                    state: {
                      contract,
                    },
                    immediate: true,
                  });
                  object.ui = ui;

                  const planeMesh = (() => {
                    const width = WORLD_WIDTH;
                    const height = WORLD_HEIGHT;
                    const depth = WORLD_DEPTH;

                    const menuMaterial = biolumi.makeMenuMaterial();

                    const geometry = new THREE.PlaneBufferGeometry(width, height);
                    const materials = [solidMaterial, menuMaterial];

                    const mesh = THREE.SceneUtils.createMultiMaterialObject(geometry, materials);
                    // mesh.position.y = 1.5;
                    mesh.receiveShadow = true;
                    mesh.menuMaterial = menuMaterial;

                    return mesh;
                  })();
                  object.add(planeMesh);
                  object.planeMesh = planeMesh;
                });
            };

            destroyContract(contractMesh) {
              const index = contractMeshes.indexOf(contractMesh);

              if (index !== -1) {
                contractMeshes.splice(index, 1);
              }
            }

            getHoverContract(side) {
              return hoverStates[side].contractMesh;
            }

            isContract(object) {
              return object[contractFlagSymbol] === true;
            }

            grabContract(side, contractMesh) {
              const menuMesh = rend.getMenuMesh();
              menuMesh.add(contractMesh);

              const {contract} = contractMesh;
              contract.matrix = DEFAULT_CONTRACT_MATRIX;

              const grabber = hands.grab(side, contractMesh);
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

                contractMesh.position.copy(newPosition);
                contractMesh.quaternion.copy(newRotation);
              });
              grabber.on('release', () => {
                const {position, quaternion, contract} = contractMesh;
                const newMatrixArray = position.toArray().concat(quaternion.toArray()).concat(new THREE.Vector3(1, 1, 1).toArray());
                contract.matrix = newMatrixArray;

                grabState.grabber = null;
              });

              const grabState = grabStates[side];
              grabState.grabber = grabber;
            }

            updatePages() {
              _updatePages();
            }
          };

          const contractInstance = new ContractApi();
          return contractInstance;
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

const _clone = o => JSON.parse(JSON.stringify(o));

module.exports = Contract;
