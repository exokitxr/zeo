import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} from './lib/constants/notification';
import notificationRenderer from './lib/render/notification';

const NUM_POSITIONS = 100 * 1024;

const SIDES = ['left', 'right'];

class Notification {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {site: {url: siteUrl}, server: {enabled: serverEnabled}}} = archae;

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
      '/core/engines/input',
      '/core/engines/webvr',
      '/core/engines/biolumi',
      '/core/engines/keyboard',
      '/core/engines/rend',
      '/core/engines/tags',
      '/core/utils/geometry-utils',
      '/core/utils/creature-utils',
    ]).then(([
      three,
      input,
      webvr,
      biolumi,
      keyboard,
      rend,
      tags,
      geometryUtils,
      creatureUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;

        const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
        const _decomposeMatrix = matrix => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

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

          const {position: cameraPosition, rotation: cameraRotation, scale: cameraScale} = _decomposeObjectMatrixWorld(camera);
          mesh.align(cameraPosition, cameraRotation, cameraScale, 1);

          return mesh;
        })();
        scene.add(hudMesh);

        let lastUpdateTime = Date.now();
        const _update = () => {
          const now = Date.now();

          const _updateHudMesh = () => {
            if (hudMesh.visible) {
              hudMesh.update();
            }
          };
          const _alignHudMesh = () => {
            if (hudMesh.visible) {
              const {position: cameraPosition, rotation: cameraRotation, scale: cameraScale} = _decomposeObjectMatrixWorld(camera);
              const timeDiff = now - lastUpdateTime;
              const lerpFactor = timeDiff * 0.02;
              hudMesh.align(cameraPosition, cameraRotation, cameraScale, lerpFactor);
            }
          };

          _updateHudMesh();
          _alignHudMesh();

          lastUpdateTime = now;
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
        }

        const _addNotification = text => {
          const notification = new Notification(text);
          notifications.push(notification);

          if (notifications.length === 1) {
            const {position: cameraPosition, rotation: cameraRotation, scale: cameraScale} = _decomposeObjectMatrixWorld(camera);
            hudMesh.align(cameraPosition, cameraRotation, cameraScale, 1);
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
