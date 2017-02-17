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

        const _makeEquipmentHoverState = () => ({
          equipmentIndex: -1,
        });
        const equipmentHoverStates = {
          left: _makeEquipmentHoverState(),
          right: _makeEquipmentHoverState(),
        };

        const bagMesh = (() => {
          const result = new THREE.Object3D();

          const geometry = new THREE.BoxBufferGeometry(0.1, 0.1, 0.1, 1, 1, 1);

          const _makeMesh = ({position: [x, y, z]}) => {
            const pocketMesh = new THREE.Mesh(geometry, WIREFRAME_DARK_MATERIAL);
            pocketMesh.position.x = x;
            pocketMesh.position.y = y;
            pocketMesh.position.z = z;
            pocketMesh.rotation.x = -Math.PI / 2;
            result.add(pocketMesh);

            const highlightMesh = new THREE.Mesh(geometry, WIREFRAME_HIGHLIGHT_MATERIAL);
            highlightMesh.position.x = x;
            highlightMesh.position.y = y;
            highlightMesh.position.z = z;
            highlightMesh.visible = false;
            result.add(highlightMesh);
            pocketMesh.highlightMesh = highlightMesh;

            return pocketMesh;
          };

          const headMesh = _makeMesh({
            position: [0, 0.1, 0.05],
          });
          result.headMesh = headMesh;
          const bodyMesh = _makeMesh({
            position: [0, BAG_Y_OFFSET, BAG_Z_OFFSET],
          });
          result.bodyMesh = bodyMesh;
          const armMeshes = [
            {
              position: [0.25, -0.1, 0.05], // right
            },
            {
              position: [-0.25, -0.1, 0.05], // left
            },
          ].map(_makeMesh);
          result.armMeshes = armMeshes;
          const pocketMeshes = [
            {
              position: [0.2, BAG_Y_OFFSET + 0.15, BAG_Z_OFFSET], // top right
            },
            {
              position: [0.2, BAG_Y_OFFSET + 0.05, BAG_Z_OFFSET],
            },
            {
              position: [0.2, BAG_Y_OFFSET - 0.05, BAG_Z_OFFSET],
            },
            {
              position: [0.2, BAG_Y_OFFSET - 0.15, BAG_Z_OFFSET], // bottom right
            },
            {
              position: [-0.2, BAG_Y_OFFSET + 0.15, BAG_Z_OFFSET], // top left
            },
            {
              position: [-0.2, BAG_Y_OFFSET + 0.05, BAG_Z_OFFSET],
            },
            {
              position: [-0.2, BAG_Y_OFFSET - 0.05, BAG_Z_OFFSET],
            },
            {
              position: [-0.2, BAG_Y_OFFSET - 0.15, BAG_Z_OFFSET], // bottom left
            },
          ].map(_makeMesh);
          result.pocketMeshes = pocketMeshes;

          const equipmentBoxMeshes = [headMesh, bodyMesh].concat(armMeshes).concat(pocketMeshes);
          result.equipmentBoxMeshes = equipmentBoxMeshes;

          return result;
        })();
        scene.add(bagMesh);

        const _update = () => {
          const {hmd, gamepads} = webvr.getStatus();

          bagMesh.position.copy(hmd.position);
          const hmdRotation = new THREE.Euler().setFromQuaternion(hmd.rotation, camera.rotation.order);
          bagMesh.rotation.y = hmdRotation.y;

          const {equipmentBoxMeshes} = bagMesh;
          equipmentBoxMeshes.forEach(equipmentBoxMesh => {
            equipmentBoxMesh.visible = true;

            const {highlightMesh} = equipmentBoxMesh;
            highlightMesh.visible = false;
          });
          SIDES.forEach(side => {
            const gamepad = gamepads[side];

            if (gamepad) {
              const {position: controllerPosition} = gamepad;
              const equipmentHoverState = equipmentHoverStates[side];

              const equipmentBoxMeshSpecs = equipmentBoxMeshes.map((equipmentBoxMesh, i) => {
                const {position: equipmentBoxMeshPosition} = _decomposeObjectMatrixWorld(equipmentBoxMesh);

                return {
                  index: i,
                  distance: controllerPosition.distanceTo(equipmentBoxMeshPosition),
                };
              });
              const equipmentBoxMeshSpecsInRange = equipmentBoxMeshSpecs.filter(equipmentBoxMeshSpec => equipmentBoxMeshSpec.distance <= 0.1);

              if (equipmentBoxMeshSpecsInRange.length > 0) {
                const sortedEquipmentBoxMeshSpecs = equipmentBoxMeshSpecsInRange.sort((a, b) => a.distance - b.distance);
                const closestEquipmentBoxMeshSpec = sortedEquipmentBoxMeshSpecs[0];
                const {index: closestEquipmentBoxMeshIndex} = closestEquipmentBoxMeshSpec;

                equipmentHoverState.equipmentIndex = closestEquipmentBoxMeshIndex;

                const closestEquipmentBoxMesh = equipmentBoxMeshes[closestEquipmentBoxMeshIndex];
                closestEquipmentBoxMesh.visible = false;

                const {highlightMesh: closestHighlightMesh} = closestEquipmentBoxMesh;
                closestHighlightMesh.visible = true;
              } else {
                equipmentHoverState.equipmentIndex = -1;
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
        const _getHoveredEquipmentIndex = side => {
          const {equipmentIndex} = equipmentHoverStates[side];

          if (equipmentIndex !== -1) {
            return equipmentIndex;
          } else {
            return -1;
          }
        };

        return {
          getBagMesh: _getBagMesh,
          getHoveredEquipmentIndex: _getHoveredEquipmentIndex,
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Bag;
