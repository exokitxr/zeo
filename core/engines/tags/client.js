import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} from './lib/constants/tags';
import tagsRenderer from './lib/render/tags';

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

          return Promise.all([
            biolumi.requestUi({
              width: WIDTH,
              height: HEIGHT,
            }),
          ])
            .then(([
              ui,
            ]) => {
              const wireframeMaterial = new THREE.MeshBasicMaterial({
                color: 0x0000FF,
                wireframe: true,
                opacity: 0.5,
                transparent: true,
              });
              /* const pointsMaterial = new THREE.PointsMaterial({
                color: 0xFF0000,
                size: 0.01,
              }); */

              const _makeGrabState = () => ({
                grabber: null,
              });
              const grabStates = {
                left: _makeGrabState(),
                right: _makeGrabState(),
              };

              ui.pushPage([
                {
                  type: 'html',
                  src: tagsRenderer.getTagSrc(),
                },
                {
                  type: 'image',
                  img: creatureUtils.makeAnimatedCreature('zeo.sh'),
                  x: 0,
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

              const _makeTagMesh = () => {
                const object = new THREE.Object3D();
                object.position.y = 1.2;
                /* object.rotation.order = camera.rotation.order;
                object.rotation.y = Math.PI / 2 */
                object[tagFlagSymbol] = true;

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

                const item = {
                  tag: 'zeo-model',
                  attributes: {
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
                  },
                };
                object.item = item;

                return object;
              };
              const tagMeshes = (() => {
                const numTags = 3;

                const result = Array(numTags);
                for (let i = 0; i < numTags; i++) {
                  const tagMesh = _makeTagMesh();
                  tagMesh.position.x = -(0.1 * 1.5) + (i * (0.1 * 1.5));

                  result[i] = tagMesh;
                }
                return result;
              })();
              tagMeshes.forEach(tagMesh => {
                scene.add(tagMesh);
              });

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
                    const boxMesh = boxMeshes[side];

                    for (let i = 0; i < tagMeshes.length; i++) {
                      const tagMesh = tagMeshes[i];
                      boxMesh.visible = false;
                    }

                    const bestGrabbableTagMesh = hands.getBestGrabbable(side, tagMeshes, {radius: DEFAULT_GRAB_RADIUS});
                    if (bestGrabbableTagMesh) {
                      boxMesh.position.copy(bestGrabbableTagMesh.position);
                      boxMesh.quaternion.copy(bestGrabbableTagMesh.quaternion);
                      boxMesh.visible = true;
                    }
                  });
                };
                const _updateTextures = () => {
                  for (let i = 0; i < tagMeshes.length; i++) {
                    const tagMesh = tagMeshes[i];
                    const {planeMesh: {menuMaterial}} = tagMesh;
                    const worldTime = world.getWorldTime();

                    biolumi.updateMenuMaterial({
                      ui,
                      menuMaterial,
                      worldTime,
                    });
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
                isTag: _isTag,
                grabTag: _grabTag,
              };
            });
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Tags;
