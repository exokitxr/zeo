const modelPath = '/archae/models/controller/controller.json';

const controllers = archae => ({
  mount() {
    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestEngines([
      '/core/engines/zeo',
    ]).then(([
      zeo,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = zeo;

        class Controller {
          constructor(index) {
            this._index = index;

            const mesh = (() => {
              const result = new THREE.Object3D();

              const inner = (() => {
                const object = new THREE.Object3D();

                const loader = new THREE.ObjectLoader();
                loader.load(modelPath, mesh => {
                  // const loader = new THREE.TextureLoader();
                  // const model = mesh.children[0];
                  // model.material.color.setHex(0xFFFFFF);
                  // model.material.map = loader.load(texturePath);
                  // model.material.specularMap = loader.load(specularMapPath);

                  object.add(mesh);
                });

                const tip = (() => {
                  const result = new THREE.Object3D();
                  result.position.z = -1;
                  return result;
                })();
                object.add(tip);
                object.tip = tip;

                return object;
              })();
              result.add(inner);
              result.inner = inner;

              return result;
            })();
            scene.add(mesh);
            this.mesh = mesh;

            const positionOffset = new THREE.Vector3();
            this.positionOffset = positionOffset;

            const rotationOffset = new THREE.Euler();
            rotationOffset.order = camera.rotation.order;
            this.rotationOffset = rotationOffset;
          }

          update() {
            const {_index: index, mesh, positionOffset, rotationOffset} = this;

            const cameraPosition = new THREE.Vector3();
            const cameraRotation = new THREE.Quaternion();
            const cameraScale = new THREE.Vector3();

            camera.updateMatrixWorld();
            camera.matrixWorld.decompose(cameraPosition, cameraRotation, cameraScale);

            mesh.position.copy(
              cameraPosition.clone()
                .add(
                  new THREE.Vector3(
                    0.2 * (index === 0 ? -1 : 1),
                    -0.1,
                    -0.2
                  )
                  .applyQuaternion(cameraRotation)
                )
            );
            mesh.quaternion.copy(cameraRotation);

            const {inner} = mesh;
            inner.position.copy(positionOffset);
            inner.rotation.copy(rotationOffset);
          }

          move(x, y) {
            const {positionOffset} = this;

            const moveFactor = 0.001;
            positionOffset.x += -x * moveFactor;
            positionOffset.y += y * moveFactor;
          }

          rotate(x, y) {
            const {rotationOffset} = this;

            const moveFactor = 0.001 * (Math.PI * 2);
            rotationOffset.y = Math.max(Math.min(rotationOffset.y + (x * moveFactor), Math.PI / 2), -Math.PI / 2);
            rotationOffset.x = Math.max(Math.min(rotationOffset.x + (y * moveFactor), Math.PI / 2), -Math.PI / 2);
          }
        }

        const controllers = (() => {
          const result = [];

          for (let index = 0; index < 2; index++) {
            const controller = new Controller(index)
            result.push(controller);
          }

          return result;
        })();
        this.controllers = controllers;
        this.left = controllers[0];
        this.right = controllers[1];

        let mode = 'move';
        const keydown = e => {
          if (window.document.pointerLockElement) {
            switch (e.keyCode) {
              case 90: // Z
                mode = 'left';
                break;
              case 88: // X
                mode = 'move';
                break;
              case 67: // C
                mode = 'right';
                break;
            }
          }
        };
        const mousewheel = e => {
          if (window.document.pointerLockElement) {
            e.preventDefault();

            const {controllers} = this;

            if (mode === 'left') {
              const controller = controllers[0];

              if (!e.shiftKey) {
                controller.move(e.deltaX, e.deltaY);
              } else {
                controller.rotate(e.deltaX, e.deltaY);
              }
            } else if (mode === 'right') {
              const controller = controllers[1];

              if (!e.shiftKey) {
                controller.move(e.deltaX, e.deltaY);
              } else {
                controller.rotate(e.deltaX, e.deltaY);
              }
            }
          }
        };
        window.addEventListener('keydown', keydown);
        window.addEventListener('mousewheel', mousewheel);

        this._cleanup = () => {
          window.removeEventListener('keydown', keydown);
          window.removeEventListener('mousewheel', mousewheel);
        };

        return {
          update() {
            for (let i = 0; i < controllers.length; i++) {
              const controller = controllers[i];
              controller.update();
            }
          },
        };
      }
    });
  },
  unount() {
    this._cleanup();
  },
});

module.exports = controllers;
