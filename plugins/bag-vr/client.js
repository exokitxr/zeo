const BAG_Y_OFFSET = -0.5;
const BAG_Z_OFFSET = -0.05;

const SIDES = ['left', 'right'];

class BagVr {
  mount() {
    const {three: {THREE, scene, camera}, pose, render} = zeo;

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
    const localVector = new THREE.Vector3();
    const localQuaternion = new THREE.Quaternion();
    const localMatrix = new THREE.Matrix4();

    const _makeEquipmentHoverState = () => ({
      equipmentIndex: -1,
    });
    const equipmentHoverStates = {
      left: _makeEquipmentHoverState(),
      right: _makeEquipmentHoverState(),
    };

    const _makeBagMesh = () => {
      const result = new THREE.Object3D();

      const lineGeometry = new THREE.CylinderBufferGeometry(0.001, 0.001, 0.1, 3, 1);
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(lineGeometry.attributes.position.array.length * 12);
      geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
      // axis
      positions.set(
        lineGeometry.clone().applyMatrix(
          localMatrix.makeTranslation(-0.1/2, 0, -0.1/2)
        ).attributes.position.array,
        lineGeometry.attributes.position.array.length * 0
      );
      positions.set(
        lineGeometry.clone().applyMatrix(
          localMatrix.makeTranslation(0.1/2, 0, -0.1/2)
        ).attributes.position.array,
        lineGeometry.attributes.position.array.length * 1
      );
      positions.set(
        lineGeometry.clone().applyMatrix(
          localMatrix.makeTranslation(-0.1/2, 0, 0.1/2)
        ).attributes.position.array,
        lineGeometry.attributes.position.array.length * 2
      );
      positions.set(
        lineGeometry.clone().applyMatrix(
          localMatrix.makeTranslation(0.1/2, 0, 0.1/2)
        ).attributes.position.array,
        lineGeometry.attributes.position.array.length * 3
      );
      // axis
      positions.set(
        lineGeometry.clone()
          .applyMatrix(
            localMatrix.makeRotationFromQuaternion(localQuaternion.setFromAxisAngle(localVector.set(0, 0, 1), Math.PI/2))
          )
          .applyMatrix(
            localMatrix.makeTranslation(0, -0.1/2, -0.1/2)
          ).attributes.position.array,
        lineGeometry.attributes.position.array.length * 4
      );
      positions.set(
        lineGeometry.clone()
          .applyMatrix(
            localMatrix.makeRotationFromQuaternion(localQuaternion.setFromAxisAngle(localVector.set(0, 0, 1), Math.PI/2))
          )
          .applyMatrix(
            localMatrix.makeTranslation(0, -0.1/2, 0.1/2)
          ).attributes.position.array,
        lineGeometry.attributes.position.array.length * 5
      );
      positions.set(
        lineGeometry.clone()
          .applyMatrix(
            localMatrix.makeRotationFromQuaternion(localQuaternion.setFromAxisAngle(localVector.set(0, 0, 1), Math.PI/2))
          )
          .applyMatrix(
            localMatrix.makeTranslation(0, 0.1/2, -0.1/2)
          ).attributes.position.array,
        lineGeometry.attributes.position.array.length * 6
      );
      positions.set(
        lineGeometry.clone()
          .applyMatrix(
            localMatrix.makeRotationFromQuaternion(localQuaternion.setFromAxisAngle(localVector.set(0, 0, 1), Math.PI/2))
          )
          .applyMatrix(
            localMatrix.makeTranslation(0, 0.1/2, 0.1/2)
          ).attributes.position.array,
        lineGeometry.attributes.position.array.length * 7
      );
      // axis
      positions.set(
        lineGeometry.clone()
          .applyMatrix(
            localMatrix.makeRotationFromQuaternion(localQuaternion.setFromAxisAngle(localVector.set(1, 0, 0), Math.PI/2))
          )
          .applyMatrix(
            localMatrix.makeTranslation(-0.1/2, -0.1/2, 0)
          ).attributes.position.array,
        lineGeometry.attributes.position.array.length * 8
      );
      positions.set(
        lineGeometry.clone()
          .applyMatrix(
            localMatrix.makeRotationFromQuaternion(localQuaternion.setFromAxisAngle(localVector.set(1, 0, 0), Math.PI/2))
          )
          .applyMatrix(
            localMatrix.makeTranslation(-0.1/2, 0.1/2, 0)
          ).attributes.position.array,
        lineGeometry.attributes.position.array.length * 9
      );
      positions.set(
        lineGeometry.clone()
          .applyMatrix(
            localMatrix.makeRotationFromQuaternion(localQuaternion.setFromAxisAngle(localVector.set(1, 0, 0), Math.PI/2))
          )
          .applyMatrix(
            localMatrix.makeTranslation(0.1/2, -0.1/2, 0)
          ).attributes.position.array,
        lineGeometry.attributes.position.array.length * 10
      );
      positions.set(
        lineGeometry.clone()
          .applyMatrix(
            localMatrix.makeRotationFromQuaternion(localQuaternion.setFromAxisAngle(localVector.set(1, 0, 0), Math.PI/2))
          )
          .applyMatrix(
            localMatrix.makeTranslation(0.1/2, 0.1/2, 0)
          ).attributes.position.array,
        lineGeometry.attributes.position.array.length * 11
      );
      const numLinePositions = lineGeometry.attributes.position.array.length / 3;
      const indices = new Uint16Array(lineGeometry.index.array.length * 12);
      for (let i = 0; i < 12; i++) {
        indices.set(
          lineGeometry.index.array,
          lineGeometry.index.array.length * i
        );

        for (let j = 0; j < lineGeometry.index.array.length; j++) {
          lineGeometry.index.array[j] += numLinePositions;
        }
      }
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));

      const _makeMesh = ({position: [x, y, z]}) => {
        const material = new THREE.MeshBasicMaterial({
          color: 0x101010,
          // wireframe: true,
          // transparent: true,
        });
        // material.polygonOffsetFactor = -1;
        material.polygonOffsetUnits = -10;
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
    };
    const bagMesh = _makeBagMesh();
    scene.add(bagMesh);

    const _update = () => {
      const _updateBagMesh = () => {
        const {hmd: hmdStatus} = pose.getStatus();
        const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmdStatus;

        bagMesh.position.copy(hmdPosition);
        const hmdEuler = new THREE.Euler().setFromQuaternion(hmdRotation, camera.rotation.order);
        bagMesh.rotation.y = hmdEuler.y;
        bagMesh.updateMatrixWorld();
      };
      const _updateEquipmentBoxMeshes = () => {
        const {gamepads} = pose.getStatus();

        const {equipmentBoxMeshes} = bagMesh;
        for (let s = 0; s < SIDES.length; s++) {
          const side = SIDES[s];
          const gamepad = gamepads[side];

          if (gamepad) {
            const {worldPosition: controllerPosition} = gamepad;
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
        }
        for (let i = 0; i < equipmentBoxMeshes.length; i++) {
          const equipmentBoxMesh = equipmentBoxMeshes[i];
          const hovered = SIDES.some(side => {
            const equipmentHoverState = equipmentHoverStates[side];
            return equipmentHoverState.equipmentIndex === i;
          });
          equipmentBoxMesh.material.color.setHex(hovered ? 0x2196F3 : 0x101010);
          equipmentBoxMesh.material.polygonOffset = hovered;
        }
      };

      _updateBagMesh();
      _updateEquipmentBoxMeshes();
    };
    render.on('update', _update);

    this._cleanup = () => {
      scene.remove(bagMesh);

      render.removeListener('update', _update);
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
      makeBagMesh: _makeBagMesh,
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = BagVr;
