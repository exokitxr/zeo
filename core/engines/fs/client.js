import menuUtils from './lib/utils/menu';

import {
  WIDTH,
  HEIGHT,

  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} from './lib/constants/fs';
import fsRenderer from './lib/render/fs';

const fileFlagSymbol = Symbol();

const SIDES = ['left', 'right'];

const DEFAULT_GRAB_RADIUS = 0.1;
const DEFAULT_FILE_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

class Fs {
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
      '/core/plugins/js-utils',
      '/core/plugins/creature-utils',
    ]).then(([
      three,
      input,
      biolumi,
      rend,
      hands,
      jsUtils,
      creatureUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera, renderer} = three;
        const {domElement} = renderer;
        const {events} = jsUtils;
        const {EventEmitter} = events;

        const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
        const _decomposeMatrix = matrix => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        const solidMaterial = biolumi.getSolidMaterial();
        const wireframeMaterial = new THREE.MeshBasicMaterial({
          color: 0x0000FF,
          wireframe: true,
          opacity: 0.5,
          transparent: true,
        });

        const _makeHoverState = () => ({
          fileMesh: null,
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

        const dragover = e => {
          e.preventDefault();
        };
        domElement.addEventListener('dragover', dragover);
        const drop = e => {
          e.preventDefault();

          const {dataTransfer: {files}} = e;
          if (files.length > 0) {
            const file = files[0];
            const id = _makeId();
            file.id = id;
            const {name} = file;

            fsInstance.emit('uploadStart', file);

            fsInstance.writeFile(id, file)
              .then(() => {
                fsInstance.emit('uploadEnd', file);
              })
              .catch(err => {
                console.warn(err);
              });
          }
        };
        domElement.addEventListener('drop', drop);

        const _updatePages = menuUtils.debounce(next => {
          const pageSpecs = (() => {
            const result = [];

            for (let i = 0; i < fileMeshes.length; i++) {
              const fileMesh = fileMeshes[i];
              const {ui, file} = fileMesh;

              if (ui) {
                const pages = ui.getPages();

                for (let j = 0; j < pages.length; j++) {
                  const page = pages[j];
                  const pageSpec = {
                    page,
                    file,
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

              if (type === 'file') {
                const {file} = pageSpec;

                page.update({
                  file,
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

          const bestGrabbableFileMesh = hands.getBestGrabbable(side, fileMeshes, {radius: DEFAULT_GRAB_RADIUS});
          if (bestGrabbableFileMesh) {
            fsInstance.grabFile(side, bestGrabbableFileMesh);
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

              const bestGrabbableFsMesh = hands.getBestGrabbable(side, fileMeshes, {radius: DEFAULT_GRAB_RADIUS});
              if (bestGrabbableFsMesh) {
                hoverState.fileMesh = bestGrabbableFsMesh;

                const {position: fileMehPosition, rotation: fileMeshRotation} = _decomposeObjectMatrixWorld(bestGrabbableFsMesh);
                boxMesh.position.copy(fileMehPosition);
                boxMesh.quaternion.copy(fileMeshRotation);

                if (!boxMesh.visible) {
                  boxMesh.visible = true;
                }
              } else {
                hoverState.fileMesh = null;

                if (boxMesh.visible) {
                  boxMesh.visible = false;
                }
              }
            });
          };
          const _updateTextures = () => {
            const uiTime = rend.getUiTime();

            for (let i = 0; i < fileMeshes.length; i++) {
              const fileMesh = fileMeshes[i];
              const {
                ui,
                planeMesh,
              } = fileMesh;

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
          scene.add(boxMeshes.left);
          scene.add(boxMeshes.right);

          domElement.removeEventListener('dragover', dragover);
          domElement.removeEventListener('drop', drop);

          input.removeListener('gripdown', _gripdown);
          input.removeListener('gripup', _gripup);

          rend.removeListener('update', _update);
        };

        class FsFile {
          constructor(id, name, directory, matrix) {
            this.id = id;
            this.name = name;
            this.directory = directory;
            this.matrix = matrix;

            this.instancing = false;
          }
        }

        const fileMeshes = [];
        class FsApi extends EventEmitter {
          makeFile(fileSpec) {
            const object = new THREE.Object3D();
            object[fileFlagSymbol] = true;

            const file = new FsFile(fileSpec.id, fileSpec.name, fileSpec.directory, fileSpec.matrix);
            object.file = file;

            object.position.set(file.matrix[0], file.matrix[1], file.matrix[2]);
            object.quaternion.set(file.matrix[3], file.matrix[4], file.matrix[5], file.matrix[6]);
            object.scale.set(file.matrix[7], file.matrix[8], file.matrix[9]);

            object.ui = null;
            object.planeMesh = null;

            this._requestDecorateFile(object);

            fileMeshes.push(object);

            return object;
          }

          _requestDecorateFile(object) {
            return biolumi.requestUi({
              width: WIDTH,
              height: HEIGHT,
            })
              .then(ui => {
                const {file} = object;

                ui.pushPage(({file}) => ([
                  {
                    type: 'html',
                    src: fsRenderer.getFileSrc(file),
                  },
                  {
                    type: 'image',
                    img: creatureUtils.makeAnimatedCreature('file:' + file.name),
                    x: 10,
                    y: 0,
                    w: 100,
                    h: 100,
                    frameTime: 300,
                    pixelated: true,
                  }
                ]), {
                  type: 'file',
                  state: {
                    file,
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

                  const mesh = THREE.SceneUtils.createMultiMaterialObject(geometry, materials);
                  // mesh.position.y = 1.5;
                  mesh.receiveShadow = true;
                  mesh.menuMaterial = menuMaterial;

                  return mesh;
                })();
                object.add(planeMesh);
                object.planeMesh = planeMesh;
              });
          }

          getFiles() {
            return fileMeshes;
          }

          getFile(id) {
            return fileMeshes.find(({file: {id: fileId}}) => fileId === id) || null;
          }

          readFile(id) {
            return fetch('/archae/fs/' + id)
              .then(res => res.blob()
            );
          }

          /* getDirectory(p) {
            return fetch('/archae/fs' + p, {
              headers: {
                'Accept': 'application/json',
              }
            }).then(res => res.json());
          } */

          writeFile(id, blob) {
            return fetch('/archae/fs/' + id, {
              method: 'PUT',
              body: blob,
            }).then(res => res.blob()
              .then(() => {})
            );
          }

          /* createDirectory(p) {
            return fetch('/archae/fs' + p, {
              method: 'POST',
            }).then(res => res.blob()
              .then(() => {})
            );
          }

          copy(src, dst) {
            return fetch('/archae/fs' + src, {
              method: 'COPY',
              headers: {
                'To': dst,
              }
            }).then(res => res.blob()
              .then(() => {})
            );
          }

          move(src, dst) {
            return fetch('/archae/fs' + src, {
              method: 'MOVE',
              headers: {
                'To': dst,
              }
            }).then(res => res.blob()
              .then(() => {})
            );
          }

          remove(p) {
            return fetch('/archae/fs' + p, {
              method: 'DELETE',
            }).then(res => res.blob()
              .then(() => {})
            );
          }

          getHoverFile(side) {
            return hoverStates[side].fileMesh;
          } */

          isFile(object) {
            return object[fileFlagSymbol] === true;
          }

          grabFile(side, fileMesh) {
            const menuMesh = rend.getMenuMesh();
            menuMesh.add(fileMesh);

            const {file} = fileMesh;
            file.matrix = DEFAULT_FILE_MATRIX;

            const grabber = hands.grab(side, fileMesh);
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

              fileMesh.position.copy(newPosition);
              fileMesh.quaternion.copy(newRotation);
            });
            grabber.on('release', () => {
              const {position, quaternion, file} = fileMesh;
              const newMatrixArray = position.toArray().concat(quaternion.toArray()).concat(new THREE.Vector3(1, 1, 1).toArray());
              file.matrix = newMatrixArray;

              grabState.grabber = null;
            });

            const grabState = grabStates[side];
            grabState.grabber = grabber;
          }

          dragover(e) {
            dragover(e);
          }

          drop(e) {
            drop(e);
          }

          updatePages() {
            _updatePages();
          }
        }

        const fsInstance = new FsApi();
        return fsInstance;
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
const _makeId = () => {
  const array = new Uint8Array(128 / 8);
  crypto.getRandomValues(array);
  return array.reduce((acc, i) => {
    return acc + _pad(i.toString(16), 2);
  }, '');
};

module.exports = Fs;
