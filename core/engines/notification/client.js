import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} from './lib/constants/notification';
import notificationRenderer from './lib/render/notification';

class Notification {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    const cleanups = [];
    this._cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };

    let live = true;
    cleanups.push(() => {
      live = false;
    });

    return archae.requestPlugins([
      '/core/engines/three',
      '/core/engines/webvr',
      '/core/engines/biolumi',
      '/core/engines/rend',
    ]).then(([
      three,
      webvr,
      biolumi,
      rend,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;

        const localVector = new THREE.Vector3();
        const localVector2 = new THREE.Vector3();
        const localQuaternion = new THREE.Quaternion();

        const notifications = [];

        const hudMesh = (() => {
          const menuUi = biolumi.makeUi({
            width: WIDTH,
            height: HEIGHT,
            color: [1, 1, 1, 0],
          });
          const mesh = menuUi.makePage(({
            notifications,
          }) => {
            const text = _escape(notifications.map(({text}) => text).join(' '));

            return {
              type: 'html',
              src: notificationRenderer.getHudSrc(text),
              x: 0,
              y: 0,
              w: WIDTH,
              h: HEIGHT,
            };
          }, {
            type: 'notification',
            state: {
              notifications,
            },
            worldWidth: WORLD_WIDTH,
            worldHeight: WORLD_HEIGHT,
          });
          mesh.visible = false;

          mesh.needsUpdate = false;
          mesh.update = () => {
            if (mesh.needsUpdate) {
              const {page} = mesh;
              page.update();

              mesh.needsUpdate = false;
            }
          };
          mesh.align = (position, rotation, scale, lerpFactor) => {
            const targetPosition = position.clone().add(
              new THREE.Vector3(
                0,
                -WORLD_HEIGHT * 0.25,
                -0.5
              ).applyQuaternion(rotation)
            );
            const targetRotation = rotation;
            const distance = position.distanceTo(targetPosition);

            if (lerpFactor < 1) {
              mesh.position.add(
                targetPosition.clone().sub(mesh.position).multiplyScalar(distance * lerpFactor)
              );
              mesh.quaternion.slerp(targetRotation, lerpFactor);
              mesh.scale.copy(scale);
            } else {
              mesh.position.copy(targetPosition);
              mesh.quaternion.copy(targetRotation);
              mesh.scale.copy(scale);
            }

            mesh.updateMatrixWorld();
          };

          return mesh;
        })();
        scene.add(hudMesh);

        let lastUpdateTime = Date.now();
        let oldVisible = false;
        const _update = () => {
          const now = Date.now();

          if (hudMesh.visible) {
            hudMesh.update();

            camera.matrixWorld.decompose(localVector, localQuaternion, localVector2);
            hudMesh.align(localVector, localQuaternion, localVector2, !oldVisible ? 1 : ((now - lastUpdateTime) * 0.02));
          }

          lastUpdateTime = now;
          oldVisible = hudMesh.visible;
        };
        rend.on('update', _update);

        cleanups.push(() => {
          scene.remove(hudMesh);

          rend.removeListener('update', _update);
        });

        class Notification {
          constructor(text) {
            this.text = text;
          }

          set(text) {
            this.text = text;

            hudMesh.needsUpdate = true;
          }
        }

        const _addNotification = text => {
          const notification = new Notification(text);
          notifications.push(notification);

          if (notifications.length === 1) {
            camera.matrixWorld.decompose(localVector, localQuaternion, localVector2);
            hudMesh.align(localVector, localQuaternion, localVector2, 1);
            hudMesh.visible = true;
          }

          hudMesh.needsUpdate = true;

          return notification;
        };
        const _removeNotification = notification => {
          notifications.splice(notifications.indexOf(notification), 1);

          if (notifications.length === 0) {
            hudMesh.visible = false;
          }

          hudMesh.needsUpdate = true;
        };

        return {
          addNotification: _addNotification,
          removeNotification: _removeNotification,
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}
const _escape = s => s
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/&/g, '&amp;');

module.exports = Notification;
