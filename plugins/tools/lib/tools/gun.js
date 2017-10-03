const BULLET_SPEED = 0.03;
const BULLET_TTL = 5 * 1000;

const dataSymbol = Symbol();

const gun = ({recipes, data}) => {
  const {three, pose, input, render, elements, items, player, teleport, utils: {geometry: geometryUtils, sprite: spriteUtils}} = zeo;
  const {THREE, scene, camera} = three;

  const zeroVector = new THREE.Vector3();
  const oneVector = new THREE.Vector3(1, 1, 1);
  const forwardVector = new THREE.Vector3(0, 0, -1);
  const upVector = new THREE.Vector3(0, 1, 0);
  const zeroQuaternion = new THREE.Quaternion();
  // const forwardQuaternion = new THREE.Quaternion().setFromUnitVectors(upVector, forwardVector);
  const localTransformPositionVectors = {
    keyboard: new THREE.Vector3(0.015/2 * 3, 0, -0.015 * 2),
    hmd: new THREE.Vector3(0.015/2 * 3, 0, 0),
  };
  const localTransformRotationQuaterions = {
    keyboard: new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 0, -1)
    ).premultiply(
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        Math.PI / 4
      )
    ),
    hmd: new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      Math.PI / 4
    ).premultiply(new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(1, 0, 0)
    )),
  };
  const localStringPositionVectors = {
    keyboard: new THREE.Vector3(0, 0.015 * 12, 0.015 * 2),
    hmd: new THREE.Vector3(0, 0.015 * 2, 0),
  };
  const localStringRotationQuaterions = {
    keyboard: zeroQuaternion,
    hmd: new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 1, 0)
    ),
  };
  const localTransformScaleVector = new THREE.Vector3(2, 2, 2);
  const localVector = new THREE.Vector3();

  const _requestAudio = url => new Promise((accept, reject) => {
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
    audio.onerror = err => {
      _cleanup();

      reject(err);
    };

    audio.crossOrigin = 'Anonymous';
    audio.src = url;
    document.body.appendChild(audio);
  });

  return () => _requestAudio('/archae/tools/sfx/gun.ogg')
    .then(gunAudio => {
      const bulletMaterial = new THREE.MeshPhongMaterial({
        color: 0xFF0000,
        shading: THREE.FlatShading,
      });

      const bullets = [];
      const bulletGeometry = (() => {
        const coreGeometry = new THREE.BoxBufferGeometry(0.02, 0.02, 0.04);
        const tipGeometry = new THREE.CylinderBufferGeometry(0, sq(0.02 / 2), 0.04, 4, 1)
          .applyMatrix(new THREE.Matrix4().makeRotationY(-Math.PI * (3 / 12)))
          .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(0.04 / 2) - (0.04 / 2)));

        return geometryUtils.concatBufferGeometry([coreGeometry, tipGeometry]);
      })();
      const _makeBulletMesh = () => {
        const geometry = bulletGeometry;
        const material = bulletMaterial;

        const mesh = new THREE.Mesh(geometry, material);
        const now = Date.now();
        mesh.startTime = now;
        mesh.lastTime = now;
        return mesh;
      };

      const gunApi = {
        asset: 'ITEM.GUN',
        itemAddedCallback(grabbable) {
          const _grab = e => {
            grabbable.setLocalTransform(localTransformPositionVectors[pose.getVrMode()], localTransformRotationQuaterions[pose.getVrMode()], localTransformScaleVector);
          };
          grabbable.on('grab', _grab);
          const _release = e => {
            grabbable.setLocalTransform(zeroVector, zeroQuaternion, oneVector);
          };
          grabbable.on('release', _release);
          const _triggerdown = e => {
            const {side} = e;

            if (grabbable.getGrabberSide() === side) {
              const {gamepads} = pose.getStatus();
              const gamepad = gamepads[side];

              if (gamepad) {
                const {position, rotation} = grabbable;

                const bullet = _makeBulletMesh();
                bullet.position.copy(position)
                  .add(localVector.copy(forwardVector).applyQuaternion(rotation).multiplyScalar(0.25));
                bullet.quaternion.copy(rotation);
                bullet.updateMatrixWorld();
                scene.add(bullet);

                bullets.push(bullet);

                input.vibrate(side, 1, 20);

                // XXX play audio here

                e.stopImmediatePropagation();
              }
            }
          };
          input.on('triggerdown', _triggerdown, {
            priority: 1,
          });

          const _update = () => {
            const now = Date.now();

            const removedBullets = [];
            for (let i = 0; i < bullets.length; i++) {
              const bullet = bullets[i];
              const {startTime} = bullet;
              const timeSinceStart = now - startTime;

              if (timeSinceStart < BULLET_TTL) {
                const {lastTime} = bullet;
                const timeDiff = now - lastTime;

                bullet.position.add(
                  new THREE.Vector3(0, 0, -BULLET_SPEED * timeDiff)
                    .applyQuaternion(bullet.quaternion)
                );
                bullet.updateMatrixWorld();

                bullet.lastTime = now;
              } else {
                scene.remove(bullet);
                removedBullets.push(bullet);
              }
            }
            for (let i = 0; i < removedBullets.length; i++) {
              bullets.splice(bullets.indexOf(removedBullets[i]), 1);
            }
          };
          render.on('update', _update);

          grabbable[dataSymbol] = {
            cleanup: () => {
              grabbable.removeListener('grab', _grab);
              grabbable.removeListener('release', _release);
              input.removeListener('triggerdown', _triggerdown);

              render.removeListener('update', _update);
            },
          };
        },
        itemRemovedCallback(grabbable) {
          grabbable[dataSymbol].cleanup();

          delete grabbable[dataSymbol];
        },
      };
      items.registerItem(this, gunApi);

      const gunRecipe = {
        output: 'ITEM.GUN',
        width: 1,
        height: 1,
        input: [
          'ITEM.STONE',
        ],
      };
      recipes.register(gunRecipe);

      return () => {
        items.unregisterItem(this, gunApi);
        recipes.unregister(gunRecipe);
      };
    });
};
const sq = n => Math.sqrt((n * n) + (n * n));

module.exports = gun;
