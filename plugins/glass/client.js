const {
  WIDTH,
  HEIGHT,

  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} = require('./lib/constants/constants');
const menuRenderer = require('./lib/render/menu');

const BAG_Y_OFFSET = -0.5;
const BAG_Z_OFFSET = -0.05;

const SIDES = ['left', 'right'];

class Glass {
  mount() {
    const {three: {THREE, scene, camera}, pose, render, ui} = zeo;

    const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
    const _decomposeMatrix = matrix => {
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(position, rotation, scale);
      return {position, rotation, scale};
    };

    const glassState = {
      mode: 'picture',
      highlight: 'audio',
    };

    const hudMesh = (() => {
      const menuUi = ui.makeUi({
        width: WIDTH,
        height: HEIGHT,
        color: [1, 1, 1, 0],
      });
      const mesh = menuUi.makePage(({
        glass: {
          mode,
          highlight,
        },
      }) => ({
        type: 'html',
        src: menuRenderer.getHudSrc({mode, highlight}),
        x: 0,
        y: 0,
        w: WIDTH,
        h: HEIGHT,
      }), {
        type: 'glass',
        state: {
          glass: glassState,
        },
        worldWidth: WORLD_WIDTH,
        worldHeight: WORLD_HEIGHT,
      });
      mesh.visible = false;

      const _align = (position, rotation, scale, lerpFactor) => {
        const targetPosition = position.clone().add(
          new THREE.Vector3(
            0,
            0,
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
      };
      mesh.align = _align;

      const {position: cameraPosition, rotation: cameraRotation, scale: cameraScale} = _decomposeObjectMatrixWorld(camera);
      mesh.align(cameraPosition, cameraRotation, cameraScale, 1);

      const {page} = mesh;
      page.initialUpdate();

      return mesh;
    })();
    scene.add(hudMesh);

    let now = Date.now();
    let lastUpdateTime = now;
    const _update = () => {
      now = Date.now();

      const _updateHudMesh = () => {
        const {position: cameraPosition, rotation: cameraRotation, scale: cameraScale} = _decomposeObjectMatrixWorld(camera);
        const timeDiff = now - lastUpdateTime;
        const lerpFactor = timeDiff * 0.005;
        hudMesh.align(cameraPosition, cameraRotation, cameraScale, lerpFactor);

        if (!hudMesh.visible) {
          hudMesh.visible = true;
        }
      };

      _updateHudMesh();
    };
    render.on('update', _update);

    this._cleanup = () => {
      scene.remove(hudMesh);

      render.removeListener('update', _update);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Glass;
