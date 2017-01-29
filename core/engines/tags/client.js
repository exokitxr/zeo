import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} from './lib/constants/tags';
import tagsRender from './lib/render/tags';

const DEFAULT_GRAB_RADIUS = 0.1;

const SIDES = ['left', 'right'];

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
              _grabTag(side, bestGrabbableTagMesh);
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

          const tagMeshes = [];
          const _makeTag = itemSpec => {
            const object = new THREE.Object3D();
            object.position.y = 1.2;
            object[tagFlagSymbol] = true;

            const item = {
              name: itemSpec.name,
              displayName: itemSpec.displayName,
              description: itemSpec.description,
              version: itemSpec.version,
              attributes: null,
              /* attributes: {
                matrix: {
                  type: 'matrix',
                  value: [
                    1, 1.5, 0,
                    0, -0.7071067811865475, 0, 0.7071067811865475,
                    1, 1, 1,
                  ],
                },
                text: {
                  type: 'text',
                  value: 'lollercopter',
                },
                number: {
                  type: 'number',
                  value: 2,
                  min: 1,
                  max: 10,
                },
                select: {
                  type: 'select',
                  value: 'rain',
                  options: [
                    'rain',
                    'snow',
                    'firefly',
                  ],
                },
                color: {
                  type: 'color',
                  value: '#F44336',
                },
                checkbox: {
                  type: 'checkbox',
                  value: false,
                },
                file: {
                  type: 'file',
                  value: 'https://cdn.rawgit.com/modulesio/zeo-data/29412380b29e98b18c746a373bdb73aeff59e27a/models/cloud/cloud.json',
                },
              }, */
              instance: null,
              instancing: false,
            };
            object.item = item;

            object.ui = null;
            object.planeMesh = null;

            _requestDecorateTag(object);

            tagMeshes.push(object);

            return object;
          };
          const _requestDecorateTag = object => biolumi.requestUi({
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

              return object;
            });
          const _getHoverTag = side => hoverStates[side].tagMesh;
          const _cloneTag = tagMesh => {
            const {item} = tagMesh;

            return _makeTag(item);
          };
          const _destroyTag = tagMesh => {
            const index = tagMeshes.indexOf(tagMesh);

            if (index !== -1) {
              tagMeshes.splice(index, 1);
            }
          };
          const _isTag = object => object[tagFlagSymbol] === true;
          const _grabTag = (side, tagMesh) => {
            scene.add(tagMesh);

            const grabber = hands.grab(side, tagMesh);
            grabber.on('update', ({position, rotation}) => {
              tagMesh.position.copy(position);
              tagMesh.quaternion.copy(rotation);
            });
            grabber.on('release', ({linearVelocity, angularVelocity}) => {
              grabState.grabber = null;
            });

            const grabState = grabStates[side];
            grabState.grabber = grabber;
          };

          return {
            makeTag: _makeTag,
            getHoverTag: _getHoverTag,
            cloneTag: _cloneTag,
            destroyTag: _destroyTag,
            isTag: _isTag,
            grabTag: _grabTag,
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

const _clone = o => JSON.parse(JSON.stringify(o));

module.exports = Tags;
