const ARROW_SPEED = 0.05;
const ARROW_TTL = 5 * 1000;

const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];
const SIDES = ['left', 'right'];

class ZBow {
  mount() {
    const {three: {THREE, scene}, input, elements, render, pose, utils: {geometry: geometryUtils}} = zeo;

    /* const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
    const _decomposeMatrix = matrix => {
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(position, rotation, scale);
      return {position, rotation, scale};
    }; */

    const bowGeometry = new THREE.TorusBufferGeometry(1, 0.02, 3, 3, Math.PI / 2)
      .applyMatrix(new THREE.Matrix4().makeRotationZ(-Math.PI / 4))
      .applyMatrix(new THREE.Matrix4().makeRotationY(Math.PI / 2))
      .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, 1));
    const weaponMaterial = new THREE.MeshPhongMaterial({
      color: 0x808080,
      shading: THREE.FlatShading,
    });
    const stringMaterial = new THREE.LineBasicMaterial({
      color: 0x000000,
      // transparent: true,
    });
    const arrowMaterial = new THREE.MeshPhongMaterial({
      color: 0xCCCCCC,
      shading: THREE.FlatShading,
    });

    const bowComponent = {
      selector: 'bow[position]',
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0.5, 1.2, 0,
            0, 0, 0, 1,
            1, 1, 1,
          ],
        },
        grabbable: {
          type: 'checkbox',
          value: true,
        },
        holdable: {
          type: 'checkbox',
          value: true,
        },
        size: {
          type: 'vector',
          value: [0.1, 1, 0.3],
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();
        const entityObject = entityElement.getObject();

        const mesh = (() => {
          const mesh = new THREE.Object3D();

          const coreMesh = (() => {
            const geometry = bowGeometry;
            const material = weaponMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
          })();
          mesh.add(coreMesh);

          const stringMesh = (() => {
            const geometry = new THREE.Geometry();
            geometry.vertices.push(
              new THREE.Vector3(0, 0.7, 0.3),
              new THREE.Vector3(0, 0, 0.3),
              new THREE.Vector3(0, 0, 0.3),
              new THREE.Vector3(0, -0.7, 0.3),
            );
            const material = stringMaterial;

            const mesh = new THREE.LineSegments(geometry, material);
            mesh.frustumCulled = false;
            return mesh;
          })();
          mesh.add(stringMesh);

          return mesh;
        })();
        entityObject.add(mesh);

        const arrows = [];

        const arrowGeometry = (() => {
          const coreGeometry = new THREE.BoxBufferGeometry(0.01, 0.01, 0.3);
          const tipGeometry = new THREE.CylinderBufferGeometry(0, sq(0.005), 0.02, 4, 1)
            .applyMatrix(new THREE.Matrix4().makeRotationY(-Math.PI * (3 / 12)))
            .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(0.02 / 2) - (0.02 / 2)));

          return geometryUtils.concatBufferGeometry([coreGeometry, tipGeometry]);
        })();
        const _makeArrowMesh = () => {
          const geometry = arrowGeometry;
          const material = arrowMaterial;

          const mesh = new THREE.Mesh(geometry, material);
          mesh.startTime = Date.now();
          mesh.lastTime = mesh.lastTime;
          return mesh;
        };

        entityApi.position = DEFAULT_MATRIX;
        entityApi.align = () => {
          const {position} = entityApi;

          entityObject.position.set(position[0], position[1], position[2]);
          entityObject.quaternion.set(position[3], position[4], position[5], position[6]);
          entityObject.scale.set(position[7], position[8], position[9]);
        };

        const _makeArrowState = () => ({
          grabbed: false,
        });
        const bowStates = {
          left: _makeArrowState(),
          right: _makeArrowState(),
        };

        const _grab = e => {
          const {detail: {side}} = e;
          const bowState = bowStates[side];

          bowState.grabbed = true;
        };
        entityElement.addEventListener('grab', _grab);
        const _release = e => {
          const {detail: {side}} = e;
          const bowState = bowStates[side];

          bowState.grabbed = false;
        };
        entityElement.addEventListener('release', _release);
        const _triggerdown = e => {
          const {side} = e;
          const bowState = bowStates[side];
          const {grabbed} = bowState;

          if (grabbed) {
            const {gamepads} = pose.getStatus();
            const gamepad = gamepads[side];

            if (gamepad) {
              const {position, rotation, scale} = _decomposeObjectMatrixWorld(mesh);

              const arrow = _makeArrowMesh();
              arrow.position.copy(position);
              arrow.quaternion.copy(rotation);
              arrow.scale.copy(scale);
              scene.add(arrow);
              arrows.push(arrow);

              // input.vibrate(side, 1, 20);

              e.stopImmediatePropagation();
            }
          }
        };
        input.on('triggerdown', _triggerdown, {
          priority: 1,
        });

        const _update = () => {
          const now = Date.now();

          const oldArrows = arrows.slice();
          for (let i = 0; i < oldArrows.length; i++) {
            const arrow = oldArrows[i];
            const {startTime} = bullet;
            const timeSinceStart = now - startTime;

            if (timeSinceStart < ARROW_TTL) {
              const {lastTime} = arrow;
              const timeDiff = now - lastTime;

              arrow.position.add(
                new THREE.Vector3(0, 0, -ARROW_SPEED * timeDiff)
                  .applyQuaternion(arrow.quaternion)
              );

              arrow.lastTime = now;
            } else {
              scene.remove(arrow);
              arrows.splice(arrows.indexOf(bullet), 1);
            }
          }
        };
        render.on('update', _update);

        entityApi._cleanup = () => {
          entityObject.remove(mesh);

          entityElement.removeEventListener('grab', _grab);
          entityElement.removeEventListener('release', _release);
          input.removeListener('triggerdown', _triggerdown);

          render.removeListener('update', _update);
        };
      },
      entityRemovedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();
        entityApi._cleanup();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getComponentApi();

        switch (name) {
          case 'position': {
            entityApi.position = newValue;

            entityApi.align();

            break;
          }
        }
      },
    };
    elements.registerComponent(this, bowComponent);

    this._cleanup = () => {
      elements.unregisterComponent(this, bowComponent);
    };
  }

  unmount() {
    this._cleanup();
  }
}

const sq = n => Math.sqrt((n * n) + (n * n));

module.exports = ZBow;
