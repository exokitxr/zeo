const BAG_Y_OFFSET = -0.5;
const BAG_Z_OFFSET = -0.05;

const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

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

        const zeroVector = new THREE.Vector3(0, 0, 0);
        const zeroQuaternion = new THREE.Quaternion();
        const oneVector = new THREE.Vector3(1, 1, 1);

        const _makeEquipmentHoverState = () => ({
          equipmentIndex: -1,
        });
        const equipmentHoverStates = {
          left: _makeEquipmentHoverState(),
          right: _makeEquipmentHoverState(),
        };

        const bagMesh = (() => {
          const result = new THREE.Object3D();
          result.visible = false;

          const geometry = new THREE.BoxBufferGeometry(0.1, 0.1, 0.1, 1, 1, 1);

          const _makeMesh = ({position: [x, y, z]}) => {
            const material = new THREE.MeshBasicMaterial({
              color: 0x808080,
              wireframe: true,
              transparent: true,
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.x = x;
            mesh.position.y = y;
            mesh.position.z = z;
            mesh.rotation.x = -Math.PI / 2;
            result.add(mesh);

            return mesh;
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
        rend.registerAuxObject('bagMesh', bagMesh);

        const login = () => {
          bagMesh.visible = true;
        };
        rend.on('login', login);
        const logout = () => {
          bagMesh.visible = false;
        };
        rend.on('logout', logout);
        const _update = () => {
          const {hmd, gamepads} = webvr.getStatus();

          bagMesh.position.copy(hmd.position);
          const hmdRotation = new THREE.Euler().setFromQuaternion(hmd.rotation, camera.rotation.order);
          bagMesh.rotation.y = hmdRotation.y;

          const {equipmentBoxMeshes} = bagMesh;
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
              } else {
                equipmentHoverState.equipmentIndex = -1;
              }
            }
          });
          for (let i = 0; i < equipmentBoxMeshes.length; i++) {
            const equipmentBoxMesh = equipmentBoxMeshes[i];
            const hovered = SIDES.some(side => {
              const equipmentHoverState = equipmentHoverStates[side];
              return equipmentHoverState.equipmentIndex === i;
            });
            equipmentBoxMesh.material.color = new THREE.Color(hovered ? 0x0000FF : 0x808080);
          }
        };
        rend.on('update', _update);

        this._cleanup = () => {
          scene.remove(bagMesh);

          rend.removeListener('login', login);
          rend.removeListener('logout', logout);
          rend.removeListener('update', _update);
        };

        const _getBagMesh = () => bagMesh;
        const _setEquipment = (index, tagMesh) => {
          const {equipmentBoxMeshes} = bagMesh;
          equipmentBoxMeshes[index].add(tagMesh);

          tagMesh.position.copy(zeroVector);
          tagMesh.quaternion.copy(zeroQuaternion);
          tagMesh.scale.copy(oneVector);

          const {item} = tagMesh;
          item.matrix = DEFAULT_MATRIX;
        };
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
          setEquipment: _setEquipment,
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
