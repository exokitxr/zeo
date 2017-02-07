import {
  WIDTH,
  HEIGHT,
  ASPECT_RATIO,
  WORLD_WIDTH,
  WORLD_HEIGHT,

  SLOT_WIDTH,
  SLOT_HEIGHT,
  SLOT_ASPECT_RATIO,
  SLOT_WORLD_WIDTH,
  SLOT_WORLD_HEIGHT,
  SLOT_WORLD_DEPTH,
} from './lib/constants/viewer';
import viewerRenderer from './lib/render/viewer';
import menuUtils from './lib/utils/menu';

const SIDES = ['left', 'right'];

const SLOT_GRAB_DISTANCE = 0.2;

const dataKeySymbol = Symbol();

class Viewer {
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
      '/core/engines/zeo',
      '/core/engines/biolumi',
      '/core/engines/fs',
      '/core/plugins/geometry-utils',
    ]).then(([
      zeo,
      biolumi,
      fs,
      geometryUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = zeo;

        // const transparentMaterial = biolumi.getTransparentMaterial();
        const solidMaterial = biolumi.getSolidMaterial();

        const lineMaterial = new THREE.LineBasicMaterial({
          color: 0x808080,
        });
        const wireframeMaterial = new THREE.MeshBasicMaterial({
          color: 0x0000FF,
          wireframe: true,
          opacity: 0.5,
          transparent: true,
        });

        const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
        const _decomposeMatrix = matrix => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        /* const _requestImage = src => new Promise((accept, reject) => {
          const img = new Image();
          img.src = src;
          img.onload = () => {
            accept(img);
          };
          img.onerror = err => {
            reject(err);
          };
        }); */

        const _requestUis = () => Promise.all([
          biolumi.requestUi({
            width: WIDTH,
            height: HEIGHT,
          }),
          biolumi.requestUi({
            width: SLOT_WIDTH,
            height: SLOT_HEIGHT,
          }),
        ]).then(([
          mediaUi,
          slotPlaceholderUi,
        ]) => ({
          mediaUi,
          slotPlaceholderUi,
        }));

        class ViewerElement extends HTMLElement {
          createdCallback() {
            let live = true;
            this._cleanup = () => {
              live = false;
            };

            _requestUis()
              .then(({
                mediaUi,
                slotPlaceholderUi,
              }) => {
                if (live) {
                  class Data {
                    constructor(data) {
                      this[dataKeySymbol] = data;

                      this._id = _makeId();
                    }

                    get() {
                      return this[dataKeySymbol];
                    }
                  }
                  const _requestFileData = file => {
                    const {type} = file;

                    if (/^image\/(?:png|jpeg|gif|file)$/.test(type)) {
                      const {id} = file;

                      return fetch('/archae/fs/' + id)
                        .then(res => res.arrayBuffer()
                          .then(arrayBuffer => ({
                            mode: 'image',
                            type,
                            data: new Data(arrayBuffer),
                          }))
                        );
                    } else {
                      return new Promise((accept, reject) => {
                        const err = new Error('unsupported file type');
                        reject(err);
                      });
                    }
                  };

                  const mediaState = {
                    type: null,
                    data: null,
                    loading: false,
                    cancelRequest: null,
                  };

                  const _makeBoxMesh = () => {
                    const width = SLOT_WORLD_WIDTH;
                    const height = SLOT_WORLD_HEIGHT;
                    const depth = SLOT_WORLD_DEPTH;

                    const geometry = new THREE.BoxBufferGeometry(width, height, depth);
                    const material = wireframeMaterial;

                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.rotation.order = camera.rotation.order;
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

                  mediaUi.pushPage(({media: {mode, type, data, loading}}) => {
                    return [
                      {
                        type: 'html',
                        src: viewerRenderer.getMediaSrc({mode, type, data, loading}),
                        x: 0,
                        y: 0,
                        w: WIDTH,
                        h: HEIGHT,
                      },
                    ];
                  }, {
                    type: 'media',
                    state: {
                      media: mediaState,
                    },
                    immediate: true,
                  });
                  slotPlaceholderUi.pushPage([
                    {
                      type: 'html',
                      src: viewerRenderer.getSlotPlaceholderSrc(),
                      x: 0,
                      y: 0,
                      w: SLOT_WIDTH,
                      h: SLOT_HEIGHT,
                    },
                  ], {
                    type: 'slotPlaceholder',
                    state: {},
                    immediate: true,
                  });

                  const _updatePages = menuUtils.debounce(next => {
                    const mediaPages = mediaUi.getPages();
                    const slotPlaceholderPages = slotPlaceholderUi.getPages();
                    const pages = mediaPages.concat(slotPlaceholderPages);

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

                        let match;
                        if (type === 'media') {
                          page.update({
                            media: mediaState,
                          }, pend);
                        } else if (type === 'slotPlaceholder') {
                          page.update({}, pend);
                        } else {
                          pend();
                        }
                      }
                    } else {
                      next();
                    }
                  });

                  const mesh = (() => {
                    const object = new THREE.Object3D();
                    object.position.y = 1.2;
                    object.position.z = 1;

                    const planeMesh = (() => {
                      const width = WORLD_WIDTH;
                      const height = WORLD_HEIGHT;

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

                    const slotMesh = (() => {
                      const object = new THREE.Object3D();
                      object.position.x = (WORLD_WIDTH / 2) + (SLOT_WORLD_HEIGHT / 2);
                      object.rotation.z = Math.PI / 2;

                      /* const notchMesh = (() => {
                        const geometry = new THREE.BoxBufferGeometry(SLOT_WORLD_WIDTH + (SLOT_WORLD_HEIGHT / 4), SLOT_WORLD_HEIGHT / 4, (SLOT_WORLD_HEIGHT / 4) / 2);
                        geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, (SLOT_WORLD_HEIGHT / 2) - ((SLOT_WORLD_HEIGHT / 4) / 2), 0));
                        const material = new THREE.MeshPhongMaterial({
                          color: 0x808080,
                          shininess: 10,
                        });

                        const mesh = new THREE.Mesh(geometry, material);
                        return mesh;
                      })();
                      object.add(notchMesh); */

                      const placeholderMesh = (() => {
                        const width = SLOT_WORLD_WIDTH;
                        const height = SLOT_WORLD_HEIGHT;

                        const menuMaterial = biolumi.makeMenuMaterial({
                          color: [1, 1, 1, 0],
                        });

                        const geometry = new THREE.PlaneBufferGeometry(width, height);
                        const material = menuMaterial;

                        const mesh = new THREE.Mesh(geometry, material);
                        mesh.receiveShadow = true;
                        mesh.menuMaterial = menuMaterial;

                        return mesh;
                      })();
                      object.add(placeholderMesh);
                      object.placeholderMesh = placeholderMesh;

                      const lineMesh = (() => {
                        const geometry = new THREE.BufferGeometry();
                        const positions = Float32Array.from([
                          -SLOT_WORLD_WIDTH / 2, -SLOT_WORLD_HEIGHT / 2, 0,
                          -SLOT_WORLD_WIDTH / 2, SLOT_WORLD_HEIGHT / 2, 0,
                          SLOT_WORLD_WIDTH / 2, SLOT_WORLD_HEIGHT / 2, 0,
                          SLOT_WORLD_WIDTH / 2, -SLOT_WORLD_HEIGHT / 2, 0,
                          -SLOT_WORLD_WIDTH / 2, -SLOT_WORLD_HEIGHT / 2, 0,
                        ]);
                        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));

                        const material = lineMaterial;

                        const mesh = new THREE.Line(geometry, material);
                        mesh.frustumCulled = false;
                        return mesh;
                      })();
                      object.add(lineMesh);

                      return object;
                    })();
                    object.add(slotMesh);
                    object.slotMesh = slotMesh;

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

                      const material = lineMaterial;

                      const mesh = new THREE.Line(geometry, material);
                      mesh.frustumCulled = false;
                      return mesh;
                    })();
                    object.add(lineMesh); */

                    return object;
                  })();
                  this.mesh = mesh;
                  scene.add(mesh);

                  const _makeHoverState = () => ({
                    hovered: false,
                  });
                  const hoverStates = {
                    left: _makeHoverState(),
                    right: _makeHoverState(),
                  };

                  const _gripup = e => {
                    const {side} = e;

                    const handsGrabber = zeo.peek(side);
                    if (handsGrabber) {
                      const {object: handsGrabberObject} = handsGrabber;

                      if (fs.isFile(handsGrabberObject)) {
                        const slotHovered = hoverStates[side].hovered;

                        if (slotHovered) {
                          handsGrabber.release();

                          const fileMesh = handsGrabberObject;
                          const {slotMesh} = mesh;
                          slotMesh.add(fileMesh);
                          fileMesh.position.copy(new THREE.Vector3());
                          fileMesh.quaternion.copy(new THREE.Quaternion());
                          fileMesh.scale.copy(new THREE.Vector3(1, 1, 1));

                         const {placeholderMesh} = slotMesh;
                          placeholderMesh.visible = false;

                          if (mediaState.cancelRequest) {
                            mediaState.cancelRequest();
                            mediaState.cancelRequest = null;
                          }

                          const {file} = fileMesh;
                          let live = true;
                          _requestFileData(file)
                            .then(({mode, type, data}) => {
                              mediaState.mode = mode;
                              mediaState.type = type;
                              mediaState.data = data.get();
                              mediaState.loading = false;

                              _updatePages();

                              live = false;
                            })
                            .catch(err => {
                              console.warn(err);

                              mediaState.loading = false;

                              _updatePages();

                              live = false;
                            });
                          mediaState.cancelRequest = () => {
                            live = false;
                          };
                          mediaState.loading = true;

                          _updatePages();

                          e.stopImmediatePropagation(); // so tags engine doesn't pick it up
                        }
                      }
                    }
                  };
                  zeo.on('gripup', _gripup, {
                    priority: 1,
                  });

                  const _update = () => {
                    const _updateTextures = () => {
                      const uiTime = zeo.getUiTime();

                      const {
                        planeMesh: {
                          menuMaterial: planeMenuMaterial,
                        },
                        slotMesh: {
                          placeholderMesh: {
                            menuMaterial: slotPlaceholderMenuMaterial,
                          },
                        },
                      } = mesh;

                      biolumi.updateMenuMaterial({
                        ui: mediaUi,
                        menuMaterial: planeMenuMaterial,
                        uiTime,
                      });
                      biolumi.updateMenuMaterial({
                        ui: slotPlaceholderUi,
                        menuMaterial: slotPlaceholderMenuMaterial,
                        uiTime,
                      });
                    };
                    const _updateControllers = () => {
                      const {gamepads} = zeo.getStatus();

                      SIDES.forEach(side => {
                        const gamepad = gamepads[side];

                        if (gamepad) {
                          const {position: controllerPosition} = gamepad;
                          const {slotMesh} = mesh;
                          const {position: slotMeshPosition, rotation: slotMeshRotation} = _decomposeObjectMatrixWorld(slotMesh);

                          const hoverState = hoverStates[side];
                          const boxMesh = boxMeshes[side];
                          if (controllerPosition.distanceTo(slotMeshPosition) <= SLOT_GRAB_DISTANCE) {
                            hoverState.hovered = true;

                            boxMesh.position.copy(slotMeshPosition);
                            boxMesh.quaternion.copy(slotMeshRotation);
                            boxMesh.visible = true;
                          } else {
                            hoverState.hovered = false;
                            boxMesh.visible = false;
                          }
                        }
                      });
                    };

                    _updateTextures();
                    _updateControllers();
                  };
                  zeo.on('update', _update);

                  this._cleanup = () => {
                    scene.remove(mesh);

                    scene.remove(boxMeshes.left);
                    scene.remove(boxMeshes.right);

                    zeo.removeListener('gripup', _gripup);
                    zeo.removeListener('update', _update);
                  };
                }
              });
          }

          destructor() {
            this._cleanup();
          }
        }
        zeo.registerElement(this, ViewerElement);

        this._cleanup = () => {
          zeo.unregisterElement(this);
        };

        return {};
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _makeId = () => Math.random().toString(36).substring(7);

module.exports = Viewer;
