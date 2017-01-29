import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} from './lib/constants/tags';
import tagsRender from './lib/render/tags';

const SIDES = ['left', 'right'];

const DEFAULT_GRAB_RADIUS = 0.1;
const DEFAULT_TAG_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const tagFlagSymbol = Symbol();

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
          const world = rend.getCurrentWorld();

           const tagsRenderer = tagsRender.makeRenderer({
            creatureUtils,
          });

          const _decomposeObjectMatrixWorld = object => {
            const {matrixWorld} = object;
            const position = new THREE.Vector3();
            const rotation = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            matrixWorld.decompose(position, rotation, scale);
            return {position, rotation, scale};
          };

          const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x0000FF,
            wireframe: true,
            opacity: 0.5,
            transparent: true,
          });

          const _makeHoverState = () => ({
            tagMesh: null,
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
            mesh.visible = false;
            return mesh;
          };
          const boxMeshes = {
            left: _makeBoxMesh(),
            right: _makeBoxMesh(),
          };
          scene.add(boxMeshes.left);
          scene.add(boxMeshes.right);

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
              SIDES.forEach(side => {
                const hoverState = hoverStates[side];
                const boxMesh = boxMeshes[side];

                const bestGrabbableTagMesh = hands.getBestGrabbable(side, tagMeshes, {radius: DEFAULT_GRAB_RADIUS});
                if (bestGrabbableTagMesh) {
                  hoverState.tagMesh = bestGrabbableTagMesh;

                  const {position: tagMehPosition, rotation: tagMeshRotation} = _decomposeObjectMatrixWorld(bestGrabbableTagMesh);
                  boxMesh.position.copy(tagMehPosition);
                  boxMesh.quaternion.copy(tagMeshRotation);

                  if (!boxMesh.visible) {
                    boxMesh.visible = true;
                  }
                } else {
                  hoverState.tagMesh = null;

                  if (boxMesh.visible) {
                    boxMesh.visible = false;
                  }
                }
              });
            };
            const _updateTextures = () => {
              const worldTime = world.getWorldTime();

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
                    worldTime,
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
              scene.remove(boxMeshes[side]);
            });

            input.removeListener('gripdown', _gripdown);
            input.removeListener('gripup', _gripup);
            rend.removeListener('update', _update);
          };

          const itemInstanceSymbol = Symbol();
          class Item {
            constructor(name, displayName, description, version, matrix) {
              this.name = name;
              this.displayName = displayName;
              this.description = description;
              this.version = version;
              this.matrix = matrix;

              this.attributes = null;
              this[itemInstanceSymbol] = null;
              this.instancing = false;
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

              const item = new Item(itemSpec.name, itemSpec.displayName, itemSpec.description, itemSpec.version, itemSpec.matrix);
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

                  ui.pushPage([
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
                  ], {
                    type: 'main',
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
                  object.add(planeMesh);
                  object.planeMesh = planeMesh;
                });
            }

            cloneTag(tagMesh) {
              const {item} = tagMesh;

              return this.makeTag(item);
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

            getHoverTag(side) {
              return hoverStates[side].tagMesh;
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
              scene.add(tagMesh);

              const {item} = tagMesh;
              item.matrix = DEFAULT_TAG_MATRIX;

              const grabber = hands.grab(side, tagMesh);
              grabber.on('update', ({position, rotation}) => {
                tagMesh.position.copy(position);
                tagMesh.quaternion.copy(rotation);
              });
              grabber.on('release', () => {q
                const {position, quaternion, item} = tagMesh;
                const newMatrix = position.toArray().concat(quaternion.toArray()).concat(new THREE.Vector3(1, 1, 1).toArray());
                item.matrix = newMatrix;

                grabState.grabber = null;
              });

              const grabState = grabStates[side];
              grabState.grabber = grabber;
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

module.exports = Tags;
