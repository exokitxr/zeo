import {
  WIDTH,
  HEIGHT,

  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} from './lib/constants/notification';

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
      '/core/engines/rend',
    ]).then(([
      three,
      webvr,
      rend,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;

        const localVector = new THREE.Vector3();
        const localVector2 = new THREE.Vector3();
        const localQuaternion = new THREE.Quaternion();

        const notifications = [];

        const hudMesh = (() => {
          const canvas = document.createElement('canvas');
          canvas.width = WIDTH;
          canvas.height = HEIGHT;
          const ctx = canvas.getContext('2d');
          const fontSize = 34;
          const lineHeight = 1.4;
          ctx.font = `600 ${fontSize}px/${lineHeight} Consolas, "Liberation Mono", Menlo, Courier, monospace`;
          ctx.textBaseline = 'top';
          const texture = new THREE.Texture(
            canvas,
            THREE.UVMapping,
            THREE.ClampToEdgeWrapping,
            THREE.ClampToEdgeWrapping,
            THREE.LinearFilter,
            THREE.LinearFilter,
            THREE.RGBAFormat,
            THREE.UnsignedByteType,
            16
          );

          const geometry = new THREE.PlaneBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT);
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            transparent: true,
            // renderOrder: -1,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.visible = false;
          mesh.needsUpdate = false;
          mesh.update = () => {
            if (mesh.needsUpdate) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);

              const text = _escape(notifications.map(({text}) => text).join('\n'));
              const width = Math.min(10 * 2 + ctx.measureText(text).width, WIDTH);
              const height = Math.min(notifications.length * fontSize * lineHeight, HEIGHT);
              const left = (WIDTH - width) / 2;

              ctx.fillStyle = '#111';
              ctx.fillRect(left, 0, width, height);

              ctx.fillStyle = '#FFF';
              ctx.fillText(text, left + 10, 0);

              texture.needsUpdate = true;
              mesh.needsUpdate = false;
            }
          };
          mesh.align = (position, rotation, scale, lerpFactor) => {
            const targetPosition = position.clone().add(
              new THREE.Vector3(
                0,
                -WORLD_HEIGHT,
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

            // sort last in render list
            scene.remove(hudMesh);
            scene.add(hudMesh);
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
