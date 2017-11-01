import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} from './lib/constants/inventory';

const SIDES = ['left', 'right'];

class Inventory {
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
      '/core/engines/input',
      '/core/engines/webvr',
      '/core/engines/resource',
      '/core/engines/rend',
    ]).then(([
      three,
      input,
      webvr,
      resource,
      rend,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        const {cursorImg} = resource;

        const localVector = new THREE.Vector3();
        const localVector2 = new THREE.Vector3();
        const localQuaternion = new THREE.Quaternion();

        const canvas = document.createElement('canvas');
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        canvas.style.width = (WIDTH / 1.5) + 'px';
        canvas.style.height = (HEIGHT / 1.5) + 'px';

        const texture = new THREE.Texture(
          canvas,
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

        const ctx = canvas.getContext('2d');
        const fontSize = 20;
        ctx.font = `400 ${fontSize}px Open Sans`;
        let usersMetrics = ctx.measureText('Users');
        const _render = (x, y) => {
          x = Math.min(Math.max((x + 1) / 2, -1), 1);
          y = 1 - Math.min(Math.max((y + 1) / 2, -1), 1);

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#FFF';
          ctx.fillText('Users', fontSize, fontSize * 1.5);
          ctx.fillText('Inventory', fontSize + usersMetrics.width * 1.2, fontSize * 1.5);
          ctx.fillRect(0, fontSize * 2, WIDTH, fontSize * 0.1);
          ctx.drawImage(cursorImg, x * WIDTH, y * HEIGHT);

          texture.needsUpdate = true;
        };
        _render(0, 0);

        const hudMesh = (() => {
          const geometry = new THREE.PlaneBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT);
          const mesh = new THREE.Mesh(geometry, material);
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
        const _update = () => {
          const now = Date.now();
          const {gamepads} = webvr.getStatus();

          let visible = false;
          let x = 0;
          let numX = 0;
          let y = 0;
          let numY = 0;
          for (let i = 0; i < SIDES.length; i++) {
            const side = SIDES[i];
            const padState = padStates[side];
            if (padState.paddown) {
              visible = true;

              const gamepad = gamepads[side];
              x += gamepad.axes[0];
              numX++;
              y += gamepad.axes[1];
              numY++;
            }
          }
          const oldVisible = hudMesh.visible;
          hudMesh.visible = visible;
          if (visible) {
            _render(x / numX, y / numY);

            camera.matrixWorld.decompose(localVector, localQuaternion, localVector2);
            hudMesh.align(localVector, localQuaternion, localVector2, !oldVisible ? 1 : ((now - lastUpdateTime) * 0.02));
          }

          lastUpdateTime = now;
        };
        rend.on('update', _update);

        cleanups.push(() => {
          scene.remove(hudMesh);

          rend.removeListener('update', _update);
        });

        const _makePadState = () => ({
          paddown: false,
        });
        const padStates = {
          left: _makePadState(),
          right: _makePadState(),
        };
        const _padtouchdown = e => {
          const {side} = e;

          const {gamepads} = webvr.getStatus();
          const gamepad = gamepads[side];
          const padState = padStates[side];
          padState.paddown = true;
        };
        input.on('padtouchdown', _padtouchdown);

        const _padtouchup = e => {
          const {side} = e;

          const {gamepads} = webvr.getStatus();
          const gamepad = gamepads[side];
          const padState = padStates[side];
          padState.paddown = false;
        };
        input.on('padtouchup', _padtouchup);

        this._cleanup = () => {
          input.removeListener('padtouchdown', _padtouchdown);
          input.removeListener('padtouchup', _padtouchup);
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Inventory;
