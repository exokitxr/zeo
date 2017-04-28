const {
  WORLD_WIDTH,
  WORLD_HEIGHT,
} = require('./lib/constants/constants');

const SIDES = ['left', 'right'];

class Rarepepe {
  mount() {
    const {three: {THREE, scene, camera}, elements, render, pose, input, world, ui, sound, utils: {geometry: geometryUtils}} = zeo;

    const transparentImg = ui.getTransparentImg();

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
    const _decomposeMatrix = matrix => {
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(position, rotation, scale);
      return {position, rotation, scale};
    };

    const _requestPepes = () => fetch('archae/rarepepe/assets/rarepepes.json')
      .then(res => res.json());
    const _requestImg = src => new Promise((accept, reject) => {
      const img = new Image();
      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(err);
      };
      img.src = src;
    });

    return Promise.all([
      _requestPepes(),
      _requestImg('archae/rarepepe/img/cardback.png'),
    ])
      .then(([
        pepes,
        cardbackImg,
      ]) => {
        if (live) {
          const _requestPepeImg = index => _requestImg('archae/rarepepe/assets/' + pepes[index]);

          const cardfrontGeometry = new THREE.PlaneBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT);
          const cardbackGeometry = new THREE.PlaneBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT)
            .applyMatrix(new THREE.Matrix4().makeRotationY(Math.PI));
          const cardbackMaterial = (() => {
            const texture = new THREE.Texture(
              cardbackImg,
              THREE.UVMapping,
              THREE.ClampToEdgeWrapping,
              THREE.ClampToEdgeWrapping,
              THREE.NearestFilter,
              THREE.NearestFilter,
              THREE.RGBAFormat,
              THREE.UnsignedByteType,
              16
            );
            texture.needsUpdate = true;
            const material = new THREE.MeshBasicMaterial({
              map: texture,
              transparent: true,
            });
            return material;
          })();

          const commentComponent = {
            selector: 'rarepepe[position][index]',
            attributes: {
              position: {
                type: 'matrix',
                value: [
                  0, 1.5, 0,
                  0, 0, 0, 1,
                  1, 1, 1,
                ],
              },
              index: {
                type: 'number',
                value: 0,
                min: 0,
                max: pepes.length - 1,
                step: 1,
              },
            },
            entityAddedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();
              const entityObject = entityElement.getObject();

              const rarepepeMesh = new THREE.Object3D();
              entityObject.add(rarepepeMesh);
              entityApi.rarepepeMesh = rarepepeMesh;

              entityApi.index = null;

              const cardMeshes = [];
              const _makeCardMesh = index => {
                const object = new THREE.Object3D();

                const frontMesh = (() => {
                  const geometry = cardfrontGeometry;
                  const texture = new THREE.Texture(
                    transparentImg,
                    THREE.UVMapping,
                    THREE.ClampToEdgeWrapping,
                    THREE.ClampToEdgeWrapping,
                    THREE.NearestFilter,
                    THREE.NearestFilter,
                    THREE.RGBAFormat,
                    THREE.UnsignedByteType,
                    16
                  );
                  // texture.needsUpdate = true;
                  const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                  });

                  _requestPepeImg(index)
                    .then(img => {
                      texture.image = img;
                      texture.needsUpdate = true;
                    })
                    .catch(err => {
                      console.warn(err);
                    });

                  const mesh = new THREE.Mesh(geometry, material);
                  return mesh;
                })();
                object.add(frontMesh);

                const backMesh = (() => {
                  const geometry = cardbackGeometry;
                  const material = cardbackMaterial;

                  const mesh = new THREE.Mesh(geometry, material);
                  return mesh;
                })();
                object.add(backMesh);

                object.destroy = () => {
                  frontMesh.material.map.dispose();
                  frontMesh.material.dispose();
                };
                return object;
              };
              const _removeCardMeshes = () => {
                for (let i = 0; i < cardMeshes.length; i++) {
                  const cardMesh = cardMeshes[i];
                  cardMesh.destroy();
                  cardMesh.parent.remove(cardMesh);
                }
                cardMeshes.length = 0;
              };

              const _render = () => {
                _removeCardMeshes();

                const {index} = entityApi;
                const cardMesh = _makeCardMesh(index);
                rarepepeMesh.add(cardMesh);
                cardMeshes.push(cardMesh);
              };
              entityApi.render = _render;

              const _trigger = e => {
                // XXX
                /* const {side} = e;

                const _doPlaneClick = () => {
                  const hoverState = ui.getHoverState(side);
                  const {page} = hoverState;

                  if (page) {
                    const {type} = page;

                    if (type === 'comment') {
                      const {anchor} = hoverState;
                      const onclick = (anchor && anchor.onclick) || '';

                      console.log('comment click', {onclick}); // XXX

                      return true;
                    } else {
                      return false;
                    }
                  } else {
                    return false;
                  }
                };

                if (_doPlaneClick()) {
                  e.stopImmediatePropagation();
                } */
              };
              input.on('trigger', _trigger);

              /* const _update = () => {
                // const {gamepads} = pose.getStatus();
                // XXX
              };
              render.on('update', _update); */

              entityApi._cleanup = () => {
                entityObject.remove(rarepepeMesh);

                _removeCardMeshes();

                // render.removeListener('update', _update);
              };
            },
            entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
              const entityApi = entityElement.getComponentApi();
              const entityObject = entityElement.getObject();

              switch (name) {
                case 'position': {
                  const position = newValue;

                  if (position) {
                    entityObject.position.set(position[0], position[1], position[2]);
                    entityObject.quaternion.set(position[3], position[4], position[5], position[6]);
                    entityObject.scale.set(position[7], position[8], position[9]);
                  }

                  break;
                }
                case 'index': {
                  const index = newValue;
                  entityApi.index = index;

                  if (index !== null) {
                    entityApi.render();
                  }

                  break;
                }
              }
            },
            entityRemovedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();

              entityApi._cleanup();
            },
          };
          elements.registerComponent(this, commentComponent);

          this._cleanup = () => {
            cardfrontGeometry.dispose();
            cardbackGeometry.dispose();
            cardbackMaterial.dispose();

            elements.unregisterComponent(this, commentComponent);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Rarepepe;
