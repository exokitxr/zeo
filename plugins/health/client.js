const {
  WIDTH,
  HEIGHT,

  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} = require('./lib/constants/constants');
const menuRenderer = require('./lib/render/menu');

class Health {
  mount() {
    const {three: {THREE, scene, camera}, pose, render, input, ui, utils: {geometry: geometryUtils}} = zeo;

    let live = true;
    this.cleanup = () => {
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

    const _isInBody = p => {
      const vrMode = pose.getVrMode();

      if (vrMode === 'hmd') {
        const {hmd} = pose.getStatus();
        const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmd;
        const hmdEuler = new THREE.Euler().setFromQuaternion(hmdRotation, camera.rotation.order);
        hmdEuler.z = 0;
        const hmdQuaternion = new THREE.Quaternion().setFromEuler(hmdEuler);
        const bodyPosition = hmdPosition.clone()
          .add(
            new THREE.Vector3(0, -0.5, 0)
              .applyQuaternion(hmdQuaternion)
          );
        return p.distanceTo(bodyPosition) < 0.35;
      } else if (vrMode === 'keyboard') {
        const {hmd: {worldPosition, worldRotation}} = pose.getStatus();
        const hmdEuler = new THREE.Euler().setFromQuaternion(worldRotation, camera.rotation.order);
        hmdEuler.x = 0;
        hmdEuler.z = 0;
        const hmdQuaternion = new THREE.Quaternion().setFromEuler(hmdEuler);
        const bodyPosition = worldPosition.clone()
          .add(
            new THREE.Vector3(0, -0.4, 0.2)
              .applyQuaternion(hmdQuaternion)
          );
        return p.distanceTo(bodyPosition) < 0.35;
      }
    };

    const _requestAudio = src => new Promise((accept, reject) => {
      const audio = document.createElement('audio');

      const _cleanup = () => {
        audio.oncanplay = null;
        audio.onerror = null;

        document.body.removeChild(audio);
      };

      audio.oncanplay = () => {
        _cleanup();

        accept(audio);
      };
      audio.onerror = () => {
        _cleanup();

        reject(audio);
      };
      audio.src = src;

      audio.style.cssText = 'position: absolute; visibility: hidden';
      document.body.appendChild(audio);
    });

    return _requestAudio('archae/health/sfx/hit.ogg')
      .then(hitSfx => {
        if (live) {
          const healthState = {
            hp: 80,
            totalHp: 112,
          };

          const hudMesh = (() => {
            const menuUi = ui.makeUi({
              width: WIDTH,
              height: HEIGHT,
              color: [1, 1, 1, 0],
            });
            const mesh = menuUi.makePage(({
              health: {
                hp,
                totalHp,
              },
            }) => ({
              type: 'html',
              src: menuRenderer.getHudSrc({hp, totalHp}),
              x: 0,
              y: 0,
              w: WIDTH,
              h: HEIGHT,
            }), {
              type: 'health',
              state: {
                health: healthState,
              },
              worldWidth: WORLD_WIDTH,
              worldHeight: WORLD_HEIGHT,
            });
            mesh.visible = false;

            const _align = (position, rotation, scale, lerpFactor) => {
              const targetPosition = position.clone().add(
                new THREE.Vector3(
                  0,
                  (((WIDTH - HEIGHT) / 2) / HEIGHT * WORLD_HEIGHT) + WORLD_HEIGHT,
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
            mesh.align = _align;

            const {position: cameraPosition, rotation: cameraRotation, scale: cameraScale} = _decomposeObjectMatrixWorld(camera);
            mesh.align(cameraPosition, cameraRotation, cameraScale, 1);

            const {page} = mesh;
            ui.addPage(page);
            page.update();

            return mesh;
          })();
          scene.add(hudMesh);
          hudMesh.updateMatrixWorld();

          /* const _renderHudMesh = () => {
            liveState.live = true;
            liveState.health = 100;
            hudMesh.page.update();
          }; */

          let lastOpenTime = 0;
          const _triggerdown = e => {
            const {side} = e;
            const {gamepads} = pose.getStatus();
            const gamepad = gamepads[side];
            const {worldPosition: controllerPosition} = gamepad;

            if (_isInBody(controllerPosition)) {
              lastOpenTime = Date.now();

              e.stopImmediatePropagation();
            }
          };
          input.on('triggerdown', _triggerdown);

          let lastUpdateTime = 0;
          const _update = () => {
            const now = Date.now();

            const _updateHudMeshVisibility = () => {
              const timeDiff = now - lastOpenTime;
              hudMesh.visible = timeDiff < 3000;
            };
            const _updateHudMeshAlignment = () => {
              const {position: cameraPosition, rotation: cameraRotation, scale: cameraScale} = _decomposeObjectMatrixWorld(camera);
              const timeDiff = now - lastUpdateTime;
              const lerpFactor = timeDiff * 0.02;
              hudMesh.align(cameraPosition, cameraRotation, cameraScale, lerpFactor);
            };

            _updateHudMeshVisibility();
            _updateHudMeshAlignment();

            lastUpdateTime = now;
          };
          render.on('update', _update);

          this._cleanup = () => {
            scene.remove(hudMesh);
            hudMesh.destroy();
            ui.removePage(hudMesh.page);

            input.removeListener('triggerdown', _triggerdown);
            render.removeListener('update', _update);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Health;
