import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} from './lib/constants/world';
import worldRenderer from './lib/render/world';
import menuUtils from './lib/utils/menu';

const SIDES = ['left', 'right'];

class World {
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
      '/core/engines/tags',
      '/core/plugins/geometry-utils',
    ]).then(([
      three,
      input,
      webvr,
      biolumi,
      rend,
      hands,
      tags,
      geometryUtils,
    ]) => {
      if (live) {
        const {THREE, scene} = three;

        const transparentMaterial = biolumi.getTransparentMaterial();
        const solidMaterial = biolumi.getSolidMaterial();
        const currentWorld = rend.getCurrentWorld();

        const oneVector = new THREE.Vector3(1, 1, 1);
        const zeroQuaternion = new THREE.Quaternion();

        const _decomposeObjectMatrixWorld = object => {
          const {matrixWorld} = object;
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrixWorld.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        const _makeHoverState = () => ({
          index: null,
        });
        const hoverStates = {
          left: _makeHoverState(),
          right: _makeHoverState(),
        };

        return biolumi.requestUi({
          width: WIDTH,
          height: HEIGHT,
        })
          .then(attributesUi => {
            if (live) {
              const attributesState = {
                element: null,
              };

              const _makeWorldHoverState = () => ({
                hovered: false,
              });
              const elementsHoverStates = {
                left: _makeWorldHoverState(),
                right: _makeWorldHoverState(),
              };
              const npmHoverStates = {
                left: _makeWorldHoverState(),
                right: _makeWorldHoverState(),
              };

              const attributesHoverStates = {
                left: biolumi.makeMenuHoverState(),
                right: biolumi.makeMenuHoverState(),
              };

              attributesUi.pushPage(({attributes: {element}}) => {
                return [
                  {
                    type: 'html',
                    src: worldRenderer.getAttributesPageSrc({element}),
                    x: 0,
                    y: 0,
                    w: WIDTH,
                    h: HEIGHT,
                    scroll: true,
                  },
                ];
              }, {
                type: 'world',
                state: {
                  attributes: attributesState,
                },
              });

              const mesh = (() => {
                const result = new THREE.Object3D();
                result.visible = false;

                const _makeElementsBoxMesh = () => {
                  const size = 0.4;
                  const width = size;
                  const height = size;
                  const depth = size / 2;

                  const geometry = new THREE.BoxBufferGeometry(width, height, depth);
                  const material = new THREE.MeshBasicMaterial({
                    color: 0x808080,
                    wireframe: true,
                  });

                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.x = -0.5;
                  mesh.position.y = -0.25;
                  // mesh.position.z = -0.5;
                  mesh.rotation.y = Math.PI / 8;
                  mesh.width = width;
                  mesh.height = height;
                  mesh.depth = depth;

                  return mesh;
                };
                const elementsMesh = (() => {
                  const mesh = _makeElementsBoxMesh();
                  mesh.position.x = -0.5;
                  mesh.position.y = -0.25;
                  mesh.rotation.y = Math.PI / 8;
                  return mesh;
                })();
                result.add(elementsMesh);
                result.elementsMesh = elementsMesh;

                const npmMesh = (() => {
                  const mesh = _makeElementsBoxMesh();
                  mesh.position.x = 0.5;
                  mesh.position.y = -0.25;
                  mesh.rotation.y = -Math.PI / 8;
                  return mesh;
                })();
                result.add(npmMesh);
                result.npmMesh = npmMesh;

                const attributesMesh = (() => {
                  const width = WORLD_WIDTH;
                  const height = WORLD_HEIGHT;
                  const depth = WORLD_DEPTH;

                  const menuMaterial = biolumi.makeMenuMaterial();

                  const geometry = new THREE.PlaneBufferGeometry(width, height);
                  const materials = [solidMaterial, menuMaterial];

                  const mesh = THREE.SceneUtils.createMultiMaterialObject(geometry, materials);
                  mesh.visible = false;
                  mesh.position.y = -0.25;
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
                result.add(attributesMesh);
                result.attributesMesh = attributesMesh;

                return result;
              })();
              rend.addMenuMesh('worldMesh', mesh);

              const attributesDotMeshes = {
                left: biolumi.makeMenuDotMesh(),
                right: biolumi.makeMenuDotMesh(),
              };
              scene.add(attributesDotMeshes.left);
              scene.add(attributesDotMeshes.right);

              const attributesBoxMeshes = {
                left: biolumi.makeMenuBoxMesh(),
                right: biolumi.makeMenuBoxMesh(),
              };
              scene.add(attributesBoxMeshes.left);
              scene.add(attributesBoxMeshes.right);

              const _updatePages = menuUtils.debounce(next => {
                const pages = attributesUi.getPages();

                const done = () => {
                  const {element} = attributesState;

                  const {attributesMesh} = mesh;
                  attributesMesh.visible = Boolean(element);

                  next();
                };

                if (pages.length > 0) {
                  let pending = pages.length;
                  const pend = () => {
                    if (--pending === 0) {
                      done();
                    }
                  };

                  for (let i = 0; i < pages.length; i++) {
                    const page = pages[i];
                    const {type} = page;

                    if (type === 'world') {
                      page.update({
                        attributes: attributesState,
                      }, pend);
                    } else {
                      pend();
                    }
                  }
                } else {
                  done();
                }
              });

              const _update = e => {
                const tab = rend.getTab();

                if (tab === 'world') {
                  const _updateTextures = () => {
                    const {
                      attributesMesh: {
                        menuMaterial: attributesMenuMaterial,
                      },
                    } = mesh;
                    const worldTime = currentWorld.getWorldTime();

                    biolumi.updateMenuMaterial({
                      ui: attributesUi,
                      menuMaterial: attributesMenuMaterial,
                      worldTime,
                    });
                  };
                  const _updateAnchors = () => {
                    const tab = rend.getTab();

                    if (tab === 'world') {
                      const {elementsMesh, npmMesh, attributesMesh} = mesh;

                      const elementsMatrixObject = _decomposeObjectMatrixWorld(elementsMesh);
                      const {position: elementsPosition, rotation: elementsRotation, scale: elementsScale} = elementsMatrixObject;
                      const elementsBoxTarget = geometryUtils.makeBoxTarget(
                        elementsPosition,
                        elementsRotation,
                        elementsScale,
                        new THREE.Vector3(elementsMesh.width, elementsMesh.height, elementsMesh.depth)
                      );

                      const npmMatrixObject = _decomposeObjectMatrixWorld(npmMesh);
                      const {position: npmPosition, rotation: npmRotation, scale: npmScale} = npmMatrixObject;
                      const npmBoxTarget = geometryUtils.makeBoxTarget(
                        npmPosition,
                        npmRotation,
                        npmScale,
                        new THREE.Vector3(npmMesh.width, npmMesh.height, npmMesh.depth)
                      );

                      const attributesMatrixObject = _decomposeObjectMatrixWorld(attributesMesh);

                      const {gamepads} = webvr.getStatus();

                      SIDES.forEach(side => {
                        const gamepad = gamepads[side];

                        if (gamepad) {
                          const {position: controllerPosition, rotation: controllerRotation} = gamepad;

                          const attributesHoverState = attributesHoverStates[side];
                          const attributesDotMesh = attributesDotMeshes[side];
                          const attributesBoxMesh = attributesBoxMeshes[side];

                          const elementsHoverState = elementsHoverStates[side];
                          const npmHoverState = npmHoverStates[side];

                          biolumi.updateAnchors({
                            matrixObject: attributesMatrixObject,
                            ui: attributesUi,
                            hoverState: attributesHoverState,
                            dotMesh: attributesDotMesh,
                            boxMesh: attributesBoxMesh,
                            width: WIDTH,
                            height: HEIGHT,
                            worldWidth: WORLD_WIDTH,
                            worldHeight: WORLD_HEIGHT,
                            worldDepth: WORLD_DEPTH,
                            controllerPosition,
                            controllerRotation,
                          });

                          
                          elementsHoverState.hovered = elementsBoxTarget.containsPoint(controllerPosition);
                          npmHoverState.hovered = npmBoxTarget.containsPoint(controllerPosition);
                        }
                      });
                    }
                  };
                  const _updateAnchorStyles = () => {
                    const {elementsMesh} = mesh;
                    const elementsHovered = SIDES.some(side => elementsHoverStates[side].hovered);
                    elementsMesh.material.color = new THREE.Color(elementsHovered ? 0x0000FF : 0x808080);

                    const {npmMesh} = mesh;
                    const npmHovered = SIDES.some(side => npmHoverStates[side].hovered);
                    npmMesh.material.color = new THREE.Color(npmHovered ? 0x0000FF : 0x808080);
                  };

                  _updateTextures();
                  _updateAnchors();
                  _updateAnchorStyles();
                }
              };
              rend.on('update', _update);

              const tagMeshes = [];
              const _addTagMesh = tagMesh => {
                const {elementsMesh} = mesh;

                elementsMesh.add(tagMesh);
                tagMeshes.push(tagMesh);
                _refreshTagMeshes();

                const {item: element} = tagMesh;
                attributesState.element = element; // XXX make this based on trigger selection
                _updatePages();
              };
              const _removeTagMesh = tagMesh => {
                const index = tagMeshes.indexOf(tagMesh);

                if (index !== -1) {
                  tagMeshes.splice(index, 1);
                  _refreshTagMeshes();

                  attributesState.element = null; // XXX make this based on trigger selection
                  _updatePages();
                }
              };
              const _refreshTagMeshes = () => {
                const aspectRatio = 400 / 150;
                const width = 0.1;
                const height = width / aspectRatio;
                const padding = width / 4;

                for (let i = 0; i < tagMeshes.length; i++) {
                  const tagMesh = tagMeshes[i];

                  const x = i % 3;
                  const y = Math.floor(i / 3);
                  tagMesh.position.set(
                    -(width + padding) + x * (width + padding),
                    ((0.4 / 2) - (height / 2) - padding) + (y * (height + padding)),
                    0
                  );
                  tagMesh.quaternion.copy(zeroQuaternion);
                  tagMesh.scale.copy(oneVector);
                }
              };

              const _gripdown1 = e => {
                const {side} = e;
                const hoverState = hoverStates[side];
                const {index} = hoverState;

                if (index !== null) {
                  const {itemBoxMeshes} = mesh;
                  const itemBoxMesh = itemBoxMeshes[index];
                  const tagMesh = itemBoxMesh.getItemMesh();

                  if (tagMesh) {
                    tags.grabTag(side, tagMesh);

                    e.stopImmediatePropagation(); // so tags engine doesn't pick it up
                  }
                }
              };
              input.on('gripdown', _gripdown1, {
                priority: 1,
              });
              const _gripdown2 = e => {
                const {side} = e;

                const handsGrabber = hands.peek(side);
                if (handsGrabber) {
                  const {object: handsGrabberObject} = handsGrabber;

                  if (tags.isTag(handsGrabberObject)) {
                    const tagMesh = handsGrabberObject;
                    _removeTagMesh(tagMesh);
                  }
                }
              };
              input.on('gripdown', _gripdown2, {
                priority: -1,
              });
              const _gripup = e => {
                const {side} = e;

                const handsGrabber = hands.peek(side);
                if (handsGrabber) {
                  const {object: handsGrabberObject} = handsGrabber;

                  if (tags.isTag(handsGrabberObject)) {
                    const elementsHovered = elementsHoverStates[side].hovered;

                    if (elementsHovered) {
                      const newTagMesh = handsGrabberObject;
                      handsGrabber.release();
                      _addTagMesh(newTagMesh);

                      e.stopImmediatePropagation(); // so tags engine doesn't pick it up
                    }
                  }
                }
              };
              input.on('gripup', _gripup, {
                priority: 1,
              });

              this._cleanup = () => {
                rend.removeMenuMesh(mesh);

                SIDES.forEach(side => {
                  scene.remove(attributesDotMeshes[side]);
                  scene.remove(attributesBoxMeshes[side]);
                });

                rend.removeListener('update', _update);
                input.removeListener('gripdown', _gripdown1);
                input.removeListener('gripdown', _gripdown2);
                input.removeListener('gripup', _gripup);
              };

              return {};
            }
          });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = World;
