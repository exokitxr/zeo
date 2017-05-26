const minecraftSkin = require('./lib/minecraft-skin');

const SIDES = ['left', 'right'];

class Skin {
  mount() {
    const {three: {THREE, camera}, elements, pose, render} = zeo;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const forwardVector = new THREE.Vector3(0, 0, -10 * 1024);
    const scaleVector = (() => {
      const scale = 1 / 18;
      return new THREE.Vector3(scale, scale, scale);
    })();

    const _requestImage = url => new Promise((accept, reject) => {
      const img = new Image();

      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(img);
      };

      img.crossOrigin = 'Anonymous';
      img.src = url;
    });
    const meshes = [];

    return _requestImage('/archae/skin/img/groot.png')
    // return _requestImage('/archae/skin/img/natsuwithfire.png')
      .then(skinImg => {
        if (live) {
          const _makeMesh = () => minecraftSkin(THREE, skinImg, {
            scale: scaleVector,
          }).mesh;

          const skinComponent = {
            selector: 'skin',
            attributes: {
              /* position: {
                type: 'matrix',
                value: [
                  0, 0, -2,
                  0, 0, 0, 1,
                  1, 1, 1,
                ],
              }, */
            },
            entityAddedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();
              const entityObject = entityElement.getObject();

              const localMesh = _makeMesh();
              entityObject.add(localMesh);
              meshes.push(localMesh);

              const _update = () => {
                const {head, body, arms} = localMesh;
                const {eyes} = head;
                const {hmd: hmdStatus, gamepads: gamepadsStatus} = pose.getStatus();
                const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmdStatus;

                localMesh.position.copy(hmdPosition.clone().sub(
                  eyes.getWorldPosition().sub(localMesh.getWorldPosition())
                ));
                head.quaternion.copy(hmdRotation.clone().multiply(localMesh.getWorldQuaternion()));

                SIDES.forEach((side, index) => {
                  const gamepadStatus = gamepadsStatus[side];
                  const {worldPosition: controllerPosition} = gamepadStatus;
                  const arm = arms[side];
                  const rotationMatrix = new THREE.Matrix4().lookAt(controllerPosition, arm.getWorldPosition(), new THREE.Vector3(0, index === 0 ? -1 : 1, 0))
                  arm.quaternion
                    .setFromRotationMatrix(rotationMatrix)
                    .multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1)))
                    .premultiply(body.getWorldQuaternion().inverse());
                });
              };
              render.on('update', _update);
              const _renderStart = () => {
                 const {head} = localMesh;
                 head.visible = false;
              };
              render.on('renderStart', _renderStart);
              const _renderEnd = () => {
                 const {head} = localMesh;
                 head.visible = true;
              };
              render.on('renderEnd', _renderEnd);

              entityApi._cleanup = () => {
                for (let i = 0; i < meshes.length; i++) {
                  const mesh = meshes[i];
                  entityObject.remove(mesh);
                }
                meshes.length = 0;

                render.removeListener('update', _update);
                render.removeListener('renderStart', _renderStart);
                render.removeListener('renderEnd', _renderEnd);
              };
            },
            entityRemovedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();

              entityApi._cleanup();
            },
            entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
              const entityObject = entityElement.getObject();

              switch (name) {
                /* case 'position': {
                  const position = newValue;

                  if (position) {
                    entityObject.position.set(position[0], position[1], position[2]);
                    entityObject.quaternion.set(position[3], position[4], position[5], position[6]);
                    entityObject.scale.set(position[7], position[8], position[9]);
                  }

                  break;
                } */
              }
            },
          };
          elements.registerComponent(this, skinComponent);

          this._cleanup = () => {
            elements.unregisterComponent(this, skinComponent);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Skin;
