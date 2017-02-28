const DEFAULT_USER_HEIGHT = 1.6;

const SIDES = ['left', 'right'];

class Trash {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    const cleanups = [];
    this._cleanup = () => {
      live = false;

      const oldCleanups = cleanups.slice();
      for (let i = 0; i < oldCleanups.length; i++) {
        const cleanup = oldCleanups[i];
        cleanup();
      }
    };

    return archae.requestPlugins([
      '/core/engines/input',
      '/core/engines/three',
      '/core/engines/webvr',
      '/core/engines/rend',
      '/core/plugins/geometry-utils',
    ]).then(([
      input,
      three,
      webvr,
      rend,
      geometryUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera, renderer} = three;

        const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
        const _decomposeMatrix = matrix => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        const trashGeometry = (() => {
          const geometry = geometryUtils.unindexBufferGeometry(new THREE.BoxBufferGeometry(0.5, 1, 0.5));

          const positionsAttrbiute = geometry.getAttribute('position');
          const positions = positionsAttrbiute.array;
          const numFaces = positions.length / 3 / 3;
          for (let i = 0; i < numFaces; i++) {
            const baseIndex = i * 3 * 3;
            const points = [
              positions.slice(baseIndex, baseIndex + 3),
              positions.slice(baseIndex + 3, baseIndex + 6),
              positions.slice(baseIndex + 6, baseIndex + 9),
            ];
            if (points[0][1] >= 0.5 && points[1][1] >= 0.5 && points[0][1] >= 0.5) {
              for (let j = 0; j < 9; j++) {
                positions[baseIndex + j] = 0;
              }
            }
          }

          return geometry;
        })();
        const solidMaterial = new THREE.MeshPhongMaterial({
          color: 0x808080,
          side: THREE.DoubleSide,
        });
        const wireframeMaterial = new THREE.MeshBasicMaterial({
          color: 0x0000FF,
          wireframe: true,
        });

        const _makeHoverState = () => ({
          hovered: false,
        });
        const hoverStates = {
          left: _makeHoverState(),
          right: _makeHoverState(),
        };

        const trashMesh = (() => {
          const geometry = trashGeometry;
          const material = solidMaterial;

          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.y = -DEFAULT_USER_HEIGHT + 0.5;
          mesh.position.z = -1;

          const highlightMesh = (() => {
            const geometry = new THREE.BoxBufferGeometry(0.5, 1, 0.5);
            const material = wireframeMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.order = camera.rotation.order;
            mesh.visible = false;
            return mesh;
          })();
          mesh.add(highlightMesh);
          mesh.highlightMesh = highlightMesh;

          return mesh;
        })();
        rend.registerMenuMesh('trashMesh', trashMesh);

        const _update = () => {
          const {gamepads} = webvr.getStatus();
          const {position: trashPosition, rotation: trashRotation, scale: trashScale} = _decomposeObjectMatrixWorld(trashMesh);
          const trashBoxTarget = geometryUtils.makeBoxTarget(trashPosition, trashRotation, trashScale, new THREE.Vector3(0.5, 1, 0.5));

          SIDES.forEach(side => {
            const hoverState = hoverStates[side];
            const hovered = (() => {
              const gamepad = gamepads[side];

              if (gamepad) {
                const {position: controllerPosition} = gamepad;
                return trashBoxTarget.containsPoint(controllerPosition);
              } else {
                return false;
              }
            })();
            hoverState.hovered = hovered;
          });
          const {highlightMesh} = trashMesh;
          highlightMesh.visible = SIDES.some(side => hoverStates[side].hovered);
        };
        rend.on('update', _update);

        this._cleanup = () => {
          scene.remove(mesh);

          rend.removeListener('update', _update);
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Trash;
