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

const SIDES = ['left', 'right'];

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
      '/core/plugins/geometry-utils',
    ]).then(([
      zeo,
      biolumi,
      geometryUtils,
    ]) => {
      if (live) {
        const {THREE, scene} = zeo;

        // const transparentMaterial = biolumi.getTransparentMaterial();
        const solidMaterial = biolumi.getSolidMaterial();

        const lineMaterial = new THREE.LineBasicMaterial({
          color: 0x808080,
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
                  const mediaState = {};

                  mediaUi.pushPage(({media}) => {
                    return [
                      {
                        type: 'html',
                        src: viewerRenderer.getMediaSrc(media),
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

                  /* const _updatePages = menuUtils.debounce(next => {
                    const menuPages = menuUi.getPages();
                    const navbarPages = navbarUi.getPages();
                    const pages = menuPages.concat(navbarPages);

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
                        if (type === 'elementAttributeFiles') {
                          page.update({
                            elementAttributeFiles: elementAttributeFilesState,
                            focus: focusState,
                          }, pend);
                        } else if (type === 'navbar') {
                          page.update({
                            navbar: navbarState,
                          }, pend);
                        } else {
                          pend();
                        }
                      }
                    } else {
                      next();
                    }
                  }); */

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
                    hovering: false,
                  });
                  const hoverState = {
                    left: _makeHoverState(),
                    right: _makeHoverState(),
                  };

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

                          // XXX
                        }
                      });
                    };

                    _updateTextures();
                    _updateControllers();
                  };
                  zeo.on('update', _update);

                  this._cleanup = () => {
                    scene.remove(mesh);

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

module.exports = Viewer;
