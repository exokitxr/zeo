import MultiMutex from 'multimutex';

import {
  WIDTH,
  HEIGHT,

  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} from './lib/constants/tags';
import tagsRenderer from './lib/render/tags';
import menuUtils from './lib/utils/menu';

const SIDES = ['left', 'right'];

const DEFAULT_GRAB_RADIUS = 0.1;
const DEFAULT_TAG_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const tagFlagSymbol = Symbol();
const itemInstanceSymbol = Symbol();
const itemMutexSymbol = Symbol();
const ITEM_LOCK_KEY = 'key';

class Tags {
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
      '/core/engines/webvr',
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/engines/hands',
      '/core/plugins/creature-utils',
    ])
      .then(([
        three,
        input,
        webvr,
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

          const _makeGrabbableState = () => ({
            tagMesh: null,
          });
          const grabbableStates = {
            left: _makeGrabbableState(),
            right: _makeGrabbableState(),
          };

          const hoverStates = {
            left: biolumi.makeMenuHoverState(),
            right: biolumi.makeMenuHoverState(),
          };

          const _makeGrabState = () => ({
            grabber: null,
          });
          const grabStates = {
            left: _makeGrabState(),
            right: _makeGrabState(),
          };

          const dotMeshes = {
            left: biolumi.makeMenuDotMesh(),
            right: biolumi.makeMenuDotMesh(),
          };
          scene.add(dotMeshes.left);
          scene.add(dotMeshes.right);
          const boxMeshes = {
            left: biolumi.makeMenuBoxMesh(),
            right: biolumi.makeMenuBoxMesh(),
          };
          scene.add(boxMeshes.left);
          scene.add(boxMeshes.right);

          const _makeGrabBoxMesh = () => {
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
          const grabBoxMeshes = {
            left: _makeGrabBoxMesh(),
            right: _makeGrabBoxMesh(),
          };
          scene.add(grabBoxMeshes.left);
          scene.add(grabBoxMeshes.right);

          const _updatePages = menuUtils.debounce(next => {
            const pageSpecs = (() => {
              const result = [];

              for (let i = 0; i < tagMeshes.length; i++) {
                const tagMesh = tagMeshes[i];
                const {ui, item} = tagMesh;

                if (ui) {
                  const pages = ui.getPages();

                  for (let j = 0; j < pages.length; j++) {
                    const page = pages[j];
                    const pageSpec = {
                      page,
                      item,
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

                if (type === 'tag') {
                  const {item} = pageSpec;

                  page.update({
                    item,
                  }, pend);
                } else {
                  pend();
                }
              }
            } else {
              next();
            }
          });

          const _trigger = e => {
            const {side} = e;
            const hoverState = hoverStates[side];
            const {intersectionPoint} = hoverState;

            if (intersectionPoint) {
              const {anchor} = hoverState;
              const onclick = (anchor && anchor.onclick) || '';

              let match;
              if (match = onclick.match(/^tag:open:(.+)$/)) {
                const id = match[1];
                const tagMesh = tagMeshes.find(tagMesh => tagMesh.item.id === id);
                const {item} = tagMesh;
                item.open = true;

                _updatePages();

                e.stopImmediatePropagation();
              }
            }
          };
          input.on('trigger', _trigger);
          const _gripdown = e => {
            const {side} = e;

            const bestGrabbableTagMesh = hands.getBestGrabbable(side, tagMeshes, {radius: DEFAULT_GRAB_RADIUS});
            if (bestGrabbableTagMesh) {
              tagsInstance.grabTag(side, bestGrabbableTagMesh);
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
              const _updateGrabbers = () => {
                SIDES.forEach(side => {
                  const grabbableState = grabbableStates[side];
                  const grabBoxMesh = grabBoxMeshes[side];

                  const bestGrabbableTagMesh = hands.getBestGrabbable(side, tagMeshes, {radius: DEFAULT_GRAB_RADIUS});
                  if (bestGrabbableTagMesh) {
                    grabbableState.tagMesh = bestGrabbableTagMesh;

                    const {position: tagMeshPosition, rotation: tagMeshRotation} = _decomposeObjectMatrixWorld(bestGrabbableTagMesh);
                    grabBoxMesh.position.copy(tagMeshPosition);
                    grabBoxMesh.quaternion.copy(tagMeshRotation);

                    if (!grabBoxMesh.visible) {
                      grabBoxMesh.visible = true;
                    }
                  } else {
                    grabbableState.tagMesh = null;

                    if (grabBoxMesh.visible) {
                      grabBoxMesh.visible = false;
                    }
                  }
                });
              };
              const _updateMenuAnchors = () => {
                const {gamepads} = webvr.getStatus();

                SIDES.forEach(side => {
                  const gamepad = gamepads[side];

                  if (gamepad) {
                    const {position: controllerPosition, rotation: controllerRotation} = gamepad;
                    const hoverState = hoverStates[side];
                    const dotMesh = dotMeshes[side];
                    const boxMesh = boxMeshes[side];

                    biolumi.updateAnchors({
                      objects: tagMeshes.map(tagMesh => {
                        const menuMatrixObject = _decomposeObjectMatrixWorld(tagMesh);
                        const {ui: menuUi} = tagMesh;

                        return {
                          matrixObject: menuMatrixObject,
                          ui: menuUi,
                        };
                      }),
                      hoverState: hoverState,
                      dotMesh: dotMesh,
                      boxMesh: boxMesh,
                      width: WIDTH,
                      height: HEIGHT,
                      worldWidth: WORLD_WIDTH,
                      worldHeight: WORLD_HEIGHT,
                      worldDepth: WORLD_DEPTH,
                      controllerPosition,
                      controllerRotation,
                    });
                  }
                });
              };

              _updateGrabbers();
              _updateMenuAnchors();
            };
            const _updateTextures = () => {
              const uiTime = rend.getUiTime();

              for (let i = 0; i < tagMeshes.length; i++) {
                const tagMesh = tagMeshes[i];
                const {
                  ui,
                  planeMesh,
                } = tagMesh;

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
            for (let i = 0; i < tagMeshes.length; i++) {
              const tagMesh = tagMeshes[i];
              tagMesh.parent.remove(tagMesh);
            }
            SIDES.forEach(side => {
              scene.remove(dotMeshes[side]);
              scene.remove(boxMeshes[side]);
              scene.remove(grabBoxMeshes[side]);
            });

            input.removeListener('trigger', _trigger);
            input.removeListener('gripdown', _gripdown);
            input.removeListener('gripup', _gripup);
            rend.removeListener('update', _update);
          };

          class Item {
            constructor(id, name, displayName, description, version, matrix) {
              this.id = id;
              this.name = name;
              this.displayName = displayName;
              this.description = description;
              this.version = version;
              this.matrix = matrix;

              this.attributes = null;
              this[itemInstanceSymbol] = null;
              this.instancing = false;

              this.open = false;

              this[itemMutexSymbol] = new MultiMutex();
            }

            get instance() {
              return this[itemInstanceSymbol];
            }

            set instance(instance) {
              this[itemInstanceSymbol] = instance;
            }

            setAttribute(name, value) {
              const {attributes} = this;
              const attribute = attributes[name];
              attribute.value = value;

              const instance = this.instance;
              if (instance) {
                instance.setAttribute(name, JSON.stringify(value));
              }
            }

            lock() {
              return this[itemMutexSymbol].lock(ITEM_LOCK_KEY);
            }
          }

          const tagMeshes = [];
          const tagClassMeshes = {
            elements: [],
            npm: [],
          };
          class TagsApi {
            makeTag(itemSpec) {
              const object = new THREE.Object3D();
              object[tagFlagSymbol] = true;

              const item = new Item(itemSpec.id, itemSpec.name, itemSpec.displayName, itemSpec.description, itemSpec.version, itemSpec.matrix);
              object.item = item;

              object.position.set(item.matrix[0], item.matrix[1], item.matrix[2]);
              object.quaternion.set(item.matrix[3], item.matrix[4], item.matrix[5], item.matrix[6]);
              object.scale.set(item.matrix[7], item.matrix[8], item.matrix[9]);

              object.ui = null;
              object.planeMesh = null;

              this._requestDecorateTag(object);

              tagMeshes.push(object);

              return object;
            }

            _requestDecorateTag(object) {
              return biolumi.requestUi({
                width: WIDTH,
                height: HEIGHT,
              })
                .then(ui => {
                  const {item} = object;

                  ui.pushPage(({item}) => ([
                    {
                      type: 'html',
                      src: tagsRenderer.getTagSrc(item),
                    },
                    {
                      type: 'image',
                      img: creatureUtils.makeAnimatedCreature('tag:' + item.displayName),
                      x: 10,
                      y: 0,
                      w: 100,
                      h: 100,
                      frameTime: 300,
                      pixelated: true,
                    }
                  ]), {
                    type: 'tag',
                    state: {
                      item,
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

            cloneTag(tagMesh) {
              const {item: oldItem} = tagMesh;
              const newItem = this.makeTag(oldItem);
              newItem.id = _makeId();
              return newItem;
            }

            destroyTag(tagMesh) {
              const index = tagMeshes.indexOf(tagMesh);

              if (index !== -1) {
                tagMeshes.splice(index, 1);
              }
            }

            getFreeTags() {
              const index = new Map();
              const {elements: elementTags, npm: npmTags} = tagClassMeshes;
              for (let i = 0; i < elementTags.length; i++) {
                const elementTag = elementTags[i];
                index.set(elementTag, true);
              }
              for (let i = 0; i < npmTags.length; i++) {
                const npmTag = npmTags[i];
                index.set(npmTag, true);
              }

              return tagMeshes.filter(tagMesh => !index.has(tagMesh));
            }

            getGrabbableTag(side) {
              return grabbableStates[side].tagMesh;
            }

            mountTag(tagClass, tagMesh) {
              tagClassMeshes[tagClass].push(tagMesh);
            }

            unmountTag(tagClass, tagMesh) {
              const entries = tagClassMeshes[tagClass];
              const index = entries.indexOf(tagMesh);

              if (index !== -1) {
                entries.splice(index, 1);
              }
            }

            getTagsClass(tagClass) {
              return tagClassMeshes[tagClass];
            }

            isTag(object) {
              return object[tagFlagSymbol] === true;
            }

            grabTag(side, tagMesh) {
              const menuMesh = rend.getMenuMesh();
              menuMesh.add(tagMesh);

              const {item} = tagMesh;
              item.matrix = DEFAULT_TAG_MATRIX;

              const grabber = hands.grab(side, tagMesh);
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

                tagMesh.position.copy(newPosition);
                tagMesh.quaternion.copy(newRotation);
              });
              grabber.on('release', () => {
                const {position, quaternion, item} = tagMesh;
                const newMatrixArray = position.toArray().concat(quaternion.toArray()).concat(new THREE.Vector3(1, 1, 1).toArray());
                item.matrix = newMatrixArray;

                grabState.grabber = null;
              });

              const grabState = grabStates[side];
              grabState.grabber = grabber;
            }

            updatePages() {
              _updatePages();
            }
          };

          const tagsInstance = new TagsApi();
          return tagsInstance;
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

const _clone = o => JSON.parse(JSON.stringify(o));
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = Tags;
