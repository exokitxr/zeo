const BAG_Y_OFFSET = -0.5;
const BAG_Z_OFFSET = -0.05;

const SIDES = ['left', 'right'];

class Bag {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

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

        const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
        const _decomposeMatrix = matrix => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        const WIREFRAME_DARK_MATERIAL = new THREE.MeshBasicMaterial({
          color: 0x808080,
          wireframe: true,
          transparent: true,
        });
        const WIREFRAME_HIGHLIGHT_MATERIAL = new THREE.MeshBasicMaterial({
          color: 0x0000FF,
          wireframe: true,
        });

        const bagMesh = (() => {
          const result = new THREE.Object3D();

          const geometry = new THREE.BoxBufferGeometry(0.1, 0.1, 0.1, 1, 1, 1);

          const pocketMeshes = [];
          const pocketHighlightMeshes = [];
          [
            {
              name: 'mesh8',
              position: [0.2, BAG_Y_OFFSET + 0.15, BAG_Z_OFFSET], // top right
            },
            {
              name: 'mesh7',
              position: [0.2, BAG_Y_OFFSET + 0.05, BAG_Z_OFFSET],
            },
            {
              name: 'mesh6',
              position: [0.2, BAG_Y_OFFSET - 0.05, BAG_Z_OFFSET],
            },
            {
              name: 'mesh5',
              position: [0.2, BAG_Y_OFFSET - 0.15, BAG_Z_OFFSET], // bottom right
            },
            {
              name: 'mesh4',
              position: [-0.2, BAG_Y_OFFSET + 0.15, BAG_Z_OFFSET], // top left
            },
            {
              name: 'mesh3',
              position: [-0.2, BAG_Y_OFFSET + 0.05, BAG_Z_OFFSET],
            },
            {
              name: 'mesh2',
              position: [-0.2, BAG_Y_OFFSET - 0.05, BAG_Z_OFFSET],
            },
            {
              name: 'mesh1',
              position: [-0.2, BAG_Y_OFFSET - 0.15, BAG_Z_OFFSET], // bottom left
            },
          ].forEach(({name, position: [x, y, z]}, i) => {
            const pocketMesh = new THREE.Mesh(geometry, WIREFRAME_DARK_MATERIAL);
            pocketMesh.position.x = x;
            pocketMesh.position.y = y;
            pocketMesh.position.z = z;
            pocketMesh.rotation.x = -Math.PI / 2;
            result.add(pocketMesh);
            pocketMeshes.push(pocketMesh);

            const pocketHighlightMesh = new THREE.Mesh(geometry, WIREFRAME_HIGHLIGHT_MATERIAL);
            pocketHighlightMesh.position.x = x;
            pocketHighlightMesh.position.y = y;
            pocketHighlightMesh.position.z = z;
            pocketHighlightMesh.visible = false;
            pocketHighlightMesh.weaponMesh = null;
            result.add(pocketHighlightMesh);
            pocketHighlightMeshes.push(pocketHighlightMesh);
          });
          result.pocketMeshes = pocketMeshes;
          result.pocketHighlightMeshes = pocketHighlightMeshes;

          return result;
        })();
        scene.add(bagMesh);

        const _update = () => {
          const {hmd, gamepads} = webvr.getStatus();

          bagMesh.position.copy(hmd.position);
          const hmdRotation = new THREE.Euler().setFromQuaternion(hmd.rotation, camera.rotation.order);
          bagMesh.rotation.y = hmdRotation.y;

          const {pocketMeshes, pocketHighlightMeshes} = bagMesh;
          pocketMeshes.forEach((pocketMesh, i) => {
            pocketMesh.visible = true;

            const pocketHighlightMesh = pocketHighlightMeshes[i];
            pocketHighlightMesh.visible = false;
          });
          SIDES.forEach(side => {
            const gamepad = gamepads[side];

            if (gamepad) {
              const {position: controllerPosition} = gamepad;

              const pocketMeshSpecs = pocketMeshes.map((pocketMesh, i) => {
                const {position: pocketPosition} = _decomposeObjectMatrixWorld(pocketMesh);

                return {
                  index: i,
                  distance: controllerPosition.distanceTo(pocketPosition),
                };
              });
              const pocketMeshSpecsInRange = pocketMeshSpecs.filter(pocketMeshSpec => pocketMeshSpec.distance <= 0.1);

              if (pocketMeshSpecsInRange.length > 0) {
                const sortedPocketMeshSpecs = pocketMeshSpecsInRange.sort((a, b) => a.distance - b.distance);
                const closestPocketMeshSpec = sortedPocketMeshSpecs[0];
                const {index: closestPocketMeshIndex} = closestPocketMeshSpec;

                const closestPocketMesh = pocketMeshes[closestPocketMeshIndex];
                closestPocketMesh.visible = false;

                const closestPocketHighlightMesh = pocketHighlightMeshes[closestPocketMeshIndex];
                closestPocketHighlightMesh.visible = true;
              }
            }
          });
        };
        rend.on('update', _update);

        this._cleanup = () => {
          scene.remove(bagMesh);

          rend.removeListener('update', _update);
        };

        const _getBagMesh = () => bagMesh;

        return {
          getBagMesh: _getBagMesh,
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Bag;
