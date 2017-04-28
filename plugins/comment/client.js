const {
  WIDTH,
  HEIGHT,

  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} = require('./lib/constants/constants');
const menuRenderer = require('./lib/render/menu');

const ConvexGeometry = require('./lib/three-extra/ConvexGeometry');

const SIDES = ['left', 'right'];

class Comment {
  mount() {
    const {three: {THREE, scene, camera}, elements, render, pose, input, world, ui, sound, utils: {geometry: geometryUtils}} = zeo;

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

    const THREEConvexGeometry = ConvexGeometry(THREE);

    const tailMaterial = new THREE.MeshPhongMaterial({
      color: 0xAAAAAA,
      shading: THREE.FlatShading,
    });

    const commentComponent = {
      selector: 'comment[position][lookat][text]',
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0, 1.5, 0,
            0, 0, 0, 1,
            1, 1, 1,
          ],
        },
        lookat: {
          type: 'matrix',
          value: [
            0.5, 1, 0,
            0, 0, 0, 1,
            1, 1, 1,
          ],
        },
        text: {
          type: 'text',
          value: 'Enter a comment',
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();
        const entityObject = entityElement.getObject();

        const commentState = {
          text: '',
        };

        const commentMesh = (() => {
          const object = new THREE.Object3D();

          const planeMesh = (() => {
            const menuUi = ui.makeUi({
              width: WIDTH,
              height: HEIGHT,
              // color: [1, 1, 1, 0],
            });
            const mesh = menuUi.makePage(({
              comment: commentState,
            }) => ({
              type: 'html',
              src: menuRenderer.getCommentSrc(commentState),
              x: 0,
              y: 0,
              w: WIDTH,
              h: HEIGHT,
            }), {
              type: 'comment',
              state: {
                comment: commentState,
              },
              worldWidth: WORLD_WIDTH,
              worldHeight: WORLD_HEIGHT,
            });
            mesh.rotation.order = camera.rotation.order;

            const {page} = mesh;
            ui.addPage(page);
            page.update();

            return mesh;
          })();
          object.add(planeMesh);
          object.planeMesh = planeMesh;

          const borderMesh = (() => {
            const geometry = (() => {
              const border = 0.02;
              const width = WORLD_WIDTH;
              const height = WORLD_HEIGHT;

              const leftGeometry = new THREE.BoxBufferGeometry(border, height, border);
              leftGeometry.applyMatrix(new THREE.Matrix4().makeTranslation(-(width / 2) - (border / 2), 0, -(border / 2)));

              const rightGeometry = new THREE.BoxBufferGeometry(border, height, border);
              rightGeometry.applyMatrix(new THREE.Matrix4().makeTranslation((width / 2) + (border / 2), 0, -(border / 2)));

              const topGeometry = new THREE.BoxBufferGeometry(width + (border * 2), border, border);
              topGeometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, (height / 2) + (border / 2), -(border / 2)));

              const bottomGeometry = new THREE.BoxBufferGeometry(width + (border * 2), border, border);
              bottomGeometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, -(height / 2) - (border / 2), -(border / 2)));

              const backGeometry = new THREE.BoxBufferGeometry(width, height, border / 2);
              backGeometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -border * 3 / 4));

              const bufferGeometry = geometryUtils.concatBufferGeometry([
                leftGeometry,
                rightGeometry,
                topGeometry,
                bottomGeometry,
                backGeometry,
              ]);
              return bufferGeometry;
            })();
            const material = tailMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            mesh.destroy = () => {
              geometry.dispose();
            };
            return mesh;
          })();
          object.add(borderMesh);

          object.destroy = () => {
            const {page} = planeMesh;
            ui.removePage(page);
            planeMesh.destroy();

            borderMesh.destroy();
          };

          return object;
        })();
        scene.add(commentMesh);
        entityApi.commentMesh = commentMesh;

        entityApi.position = null;
        entityApi.lookAt = null;
        entityApi.text = null;

        let tailMesh = null;
        const _makeTailMesh = () => {
          const {position, lookAt} = entityApi;

          if (position && lookAt) {
            const geometry = new THREEConvexGeometry([
              position.clone().add(new THREE.Vector3(-0.02, -(WORLD_HEIGHT / 2) - 0.02, -0.02)),
              position.clone().add(new THREE.Vector3(0.02, -(WORLD_HEIGHT / 2) - 0.02, -0.02)),
              position.clone().add(new THREE.Vector3(-0.02, -(WORLD_HEIGHT / 2) - 0.02, 0)),
              position.clone().add(new THREE.Vector3(0.02, -(WORLD_HEIGHT / 2) - 0.02, 0)),
              lookAt,
            ]);
            const material = tailMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            mesh.destroy = () => {
              geometry.dispose();
            };
            return mesh;
          } else {
            return null;
          }
        };
        const _updateLookAt = () => {
          if (tailMesh) {
            tailMesh.destroy();
            scene.remove(tailMesh);
            tailMesh = null;
          }

          tailMesh = _makeTailMesh();
          if (tailMesh) {
            scene.add(tailMesh);
          }
        };
        entityApi.updateLookAt = _updateLookAt;

        const _render = () => {
          const {text} = entityApi;
          commentState.text = text;

          const {planeMesh} = commentMesh;
          const {page} = planeMesh;
          page.update();
        };
        entityApi.render = _render;

        const _trigger = e => {
          const {side} = e;

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
          }
        };
        input.on('trigger', _trigger);

        /* const _update = () => {
          // const {gamepads} = pose.getStatus();
          // XXX
        };
        render.on('update', _update); */

        entityApi._cleanup = () => {
          commentMesh.destroy();
          scene.remove(commentMesh);

          if (tailMesh) {
            tailMesh.destroy();
            scene.remove(tailMesh);
          }

          tailMaterial.dispose();

          // render.removeListener('update', _update);
        };
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getComponentApi();

        switch (name) {
          case 'position': {
            const position = newValue;

            if (position) {
              const {commentMesh} = entityApi;

              commentMesh.position.set(position[0], position[1], position[2]);
              commentMesh.quaternion.set(position[3], position[4], position[5], position[6]);
              commentMesh.scale.set(position[7], position[8], position[9]);
            }

            entityApi.position = position ? new THREE.Vector3().fromArray(position.slice(0, 3)) : null;

            entityApi.updateLookAt();

            break;
          }
          case 'lookat': {
            const lookAt = newValue ? new THREE.Vector3(newValue[0], newValue[1], newValue[2]) : null;
            entityApi.lookAt = lookAt;

            entityApi.updateLookAt();

            break;
          }
          case 'text': {
            const text = newValue;
            entityApi.text = text;

            entityApi.render();

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
      elements.unregisterComponent(this, commentComponent);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Comment;
