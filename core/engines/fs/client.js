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
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/plugins/js-utils',
      '/core/plugins/creature-utils',
    ]).then(([
      three,
      biolumi,
      rend,
      jsUtils,
      creatureUtils,
    ]) => {
      if (live) {
        const {THREE, renderer} = three;
        const {domElement} = renderer;
        const {events} = jsUtils;
        const {EventEmitter} = events;

        const solidMaterial = biolumi.getSolidMaterial();

        const dragover = e => {
          e.preventDefault();
        };
        domElement.addEventListener('dragover', dragover);
        const drop = e => {
          e.preventDefault();

          const {dataTransfer: {files}} = e;
          if (files.length > 0) {
            const file = files[0];
            const {name} = file;

            fsApiInstance.emit('uploadStart', file);

            fsApiInstance.writeFile('/' + name, file)
              .then(() => {
                fsApiInstance.emit('uploadEnd', file);
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
              }
            }
          } else {
            next();
          }
        });

        const _update = () => {
          const _updateControllers = () => {
            // XXX
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
          domElement.removeEventListener('dragover', dragover);
          domElement.removeEventListener('drop', drop);

          rend.removeListener('update', _update);
        };

        class FsFile {
          constructor(name, matrix) {
            this.name = name;
            this.matrix = matrix;

            this.instancing = false;
          }
        }

        const fileMeshes = [];
        class FsApi extends EventEmitter {
          makeFile(fileSpec) {
            const object = new THREE.Object3D();
            object[fileFlagSymbol] = true;

            const file = new FsFile(fileSpec.name, fileSpec.matrix);
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

          getFile(name) {
            return fileMeshes.find(({file: {name: fileName}}) => fileName === name) || null;
          }

          readFile(p) {
            return fetch('/archae/fs' + p)
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

          writeFile(p, blob) {
            return fetch('/archae/fs' + p, {
              method: 'PUT',
              body: blob,
            }).then(res => res.blob()
              .then(() => {})
            );
          }

          createDirectory(p) {
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

        const fsApiInstance = new FsApi();
        return fsApiInstance;
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Fs;
