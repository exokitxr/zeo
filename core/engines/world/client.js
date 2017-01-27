import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} from './lib/constants/world';
import worldRenderer from './lib/render/world';

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
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/engines/hands',
      '/core/engines/tags',
    ]).then(([
      three,
      input,
      biolumi,
      rend,
      hands,
      tags,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;

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

        const transparentMaterial = biolumi.getTransparentMaterial();
        const solidMaterial = biolumi.getSolidMaterial();

        return biolumi.requestUi({
          width: WIDTH,
          height: HEIGHT,
        })
          .then(attributesUi => {
            if (live) {
              const attributesState = {
                element: null,
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
                result.ui = attributesUi;

                const elementsMesh = (() => {
                  const size = 0.3;

                  const geometry = new THREE.BoxBufferGeometry(size, size, size);
                  const material = new THREE.MeshBasicMaterial({
                    color: 0x808080,
                    wireframe: true,
                  });

                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.x = -0.5;
                  mesh.position.y = -0.25;
                  // mesh.position.z = -0.5;
                  mesh.rotation.y = Math.PI / 8;
                  mesh.size = size;

                  return mesh;
                })();
                result.add(elementsMesh);
                result.elementsMesh = elementsMesh;

                const npmMesh = (() => {
                  const size = 0.3;

                  const geometry = new THREE.BoxBufferGeometry(size, size, size);
                  const material = new THREE.MeshBasicMaterial({
                    color: 0x808080,
                    wireframe: true,
                  });

                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.x = 0.5;
                  mesh.position.y = -0.25;
                  // mesh.position.z = -0.5;
                  mesh.rotation.y = Math.PI / 8;
                  mesh.size = size;

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
                  mesh.position.x = -0.25;
                  // mesh.position.z = -0.5;
                  // mesh.rotation.y = Math.PI / 8;
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

              const _update = e => {
                // XXX
              };
              rend.on('update', _update);

              const _gripdown = e => {
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
              input.on('gripdown', _gripdown, {
                priority: 1,
              });
              const _gripup = e => {
                const {side} = e;

                const handsGrabber = hands.peek(side);
                if (handsGrabber) {
                  const {object: handsGrabberObject} = handsGrabber;

                  if (tags.isTag(handsGrabberObject)) {
                    const hoverState = hoverStates[side];
                    const {index} = hoverState;

                    if (index !== null) {
                      const {itemBoxMeshes} = mesh;
                      const itemBoxMesh = itemBoxMeshes[index];
                      const oldTagMesh = itemBoxMesh.getItemMesh();

                      if (!oldTagMesh) {
                        const newTagMesh = handsGrabberObject;

                        handsGrabber.release()

                        itemBoxMesh.setItemMesh(newTagMesh);
                        newTagMesh.position.copy(new THREE.Vector3());
                        newTagMesh.quaternion.copy(new THREE.Quaternion());
                        newTagMesh.scale.set(1, 1, 1);

                        // const {item} = newTagMesh; // XXX item is the element
                      }

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

                rend.removeListener('update', _update);
                input.removeListener('gripdown', _gripdown);
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
