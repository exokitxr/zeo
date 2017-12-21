const BAG_Y_OFFSET = -0.5;
const BAG_Z_OFFSET = -0.05;

const SIDES = ['left', 'right'];
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

class BagVr {
  mount() {
    const {three: {THREE, scene, camera}, input, hands, items, pose, player, notification, render} = zeo;

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
    const localVector2 = new THREE.Vector3();
    const localQuaternion = new THREE.Quaternion();
    const localMatrix = new THREE.Matrix4();

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
      /* const bodyMesh = _makeMesh({
        position: [0, BAG_Y_OFFSET, BAG_Z_OFFSET],
      });
      result.bodyMesh = bodyMesh; */
      /* const armMeshes = [
        {
          position: [0.25, -0.1, 0.05], // right
        },
        {
          position: [-0.25, -0.1, 0.05], // left
        },
      ].map(_makeMesh);
      result.armMeshes = armMeshes; */
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

      const equipmentBoxMeshes = pocketMeshes.concat([headMesh/*, bodyMesh*/])/*.concat(armMeshes)*/;
      result.equipmentBoxMeshes = equipmentBoxMeshes;

      return result;
    };
    const bagMesh = _makeBagMesh();
    scene.add(bagMesh);

    /* const hudMesh = (() => {
      const geometry = new THREE.PlaneBufferGeometry(0.5, 0.5);
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
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
      const material = new THREE.MeshBasicMaterial({
        map: texture,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      return mesh;
    })();
    scene.add(hudMesh); */

    const _loadEquipment = () => {
      items.requestStorageFiles()
        .then(storageFiles => storageFiles.find(fileSpec => fileSpec.name === 'bag-vr-data' && fileSpec.ext === 'json'))
        .then(bagVrDataFile => {
          if (bagVrDataFile) {
            return bagVrDataFile.readAsJson();
          } else {
            return Promise.resolve(null);
          }
        })
        .then(assetsData => {
          assetsData = assetsData || [];
          for (let i = 0; i < assetsData.length; i++) {
            const assetData = assetsData[i];

            if (assetData) {
              const {id, name, ext, json, file} = assetData;
              const itemSpec = {
                assetId: _makeId(),
                id,
                name,
                ext,
                json,
                file,
                position: zeroVector.toArray().concat(zeroQuaternion.toArray()).concat(localVector.copy(oneVector).multiplyScalar(0.4).toArray()),
                owner: player.getId(),
                physics: false,
                visible: true,
                open: false,
              };
              const grabbable = items.makeItem(itemSpec); // XXX remove these on hte server side on quit via owner binding

              const equipmentBoxMesh = bagMesh.equipmentBoxMeshes[i];
              equipmentBoxMesh.add(grabbable.mesh);
              // grabbable.setState(zeroVector, zeroQuaternion, localVector.copy(oneVector).multiplyScalar(0.4));

              equipmentState.assets[i] = grabbable;
            }
          }
        });
    };
    _loadEquipment();
    const _saveEquipment = _debounce(next => {
      items.requestStorageFiles()
        .then(storageFiles => {
          const bagVrDataFile = storageFiles.find(fileSpec => fileSpec.name === 'bag-vr-data' && fileSpec.ext === 'json');

          if (bagVrDataFile) {
            return Promise.resolve(bagVrDataFile);
          } else {
            return items.requestMakeStorageFile('bag-vr-data', 'json');
          }
        })
        .then(bagVrDataFile => {
          const assetsData = equipmentState.assets.map(assetInstance => {
            if (assetInstance) {
              const assetData = {
                id: assetInstance.id,
                name: assetInstance.name,
                ext: assetInstance.ext,
              };
              if (assetInstance.json) {
                assetData.json = assetInstance.json;
              }
              if (assetInstance.file) {
                assetData.file = assetInstance.file;
              }
              return assetData;
            } else {
              return null;
            }
          });
          const assetsDataJson = JSON.stringify(assetsData);
          return bagVrDataFile.write(assetsDataJson);
        })
        .then(() => {
          next();
        })
        .catch(err => {
          console.warn(err);

          next();
        });
    });

    const equipmentState = {
      assets: (() => {
        const numEquipmentBoxMeshes = bagMesh.equipmentBoxMeshes.length;
        const result = Array(numEquipmentBoxMeshes);
        for (let i = 0; i < numEquipmentBoxMeshes; i++) {
          result[i] = null;
        }
        return result;
      })()
    };
    const _makeEquipmentHoverState = () => ({
      equipmentIndex: -1,
    });
    const equipmentHoverStates = {
      left: _makeEquipmentHoverState(),
      right: _makeEquipmentHoverState(),
    };

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
          const hovered = SIDES.some(side => equipmentHoverStates[side].equipmentIndex === i);
          equipmentBoxMesh.material.color.setHex(hovered ? 0x2196F3 : 0x101010);
          equipmentBoxMesh.material.polygonOffset = hovered;
        }
      };
      const _updateAssetInstances = () => {
        const status = pose.getStatus();
        const hmdWorldPosition = status.hmd.worldPosition;
        const hmdWorldRotation = status.hmd.worldRotation;
        const destinationPosition = localVector.copy(hmdWorldPosition)
          .add(localVector2.set(0, -1.6, 0));
        const destinationMatrix = localMatrix.compose(
          destinationPosition,
          hmdWorldRotation,
          oneVector
        );
        const destinationMatrixInverse = localMatrix.getInverse(destinationMatrix);

        const assetInstances = items.getAssetInstances();
        for (let i = 0; i < assetInstances.length; i++) {
          const assetInstance = assetInstances[i];
          if (!assetInstance.isGrabbed() && !equipmentState.assets.includes(assetInstance)) {
            const diffVector = localVector2.copy(assetInstance.position)
              .applyMatrix4(destinationMatrixInverse)
              .sub(zeroVector);
            const diffScalar = Math.max(Math.abs(diffVector.x), Math.abs(diffVector.y), Math.abs(diffVector.z));
            if (diffScalar < 0.4) {
              let freeEquipmentIndex = -1;
              for (let j = 0; j < bagMesh.equipmentBoxMeshes.length; j++) {
                if (equipmentState.assets[j] === null) {
                  freeEquipmentIndex = j;
                  break;
                }
              }

              if (freeEquipmentIndex !== -1) {
                const grabbable = assetInstance;

                const equipmentBoxMesh = bagMesh.equipmentBoxMeshes[freeEquipmentIndex];
                equipmentBoxMesh.add(grabbable.mesh);
                grabbable.setState(zeroVector, zeroQuaternion, localVector.copy(oneVector).multiplyScalar(0.4));
                grabbable.disablePhysics();
                grabbable.setOwner(player.getId());

                equipmentState.assets[freeEquipmentIndex] = grabbable;
                _saveEquipment();
              }

              const note = notification.addNotification(`Picked up ${assetInstance.name}.${assetInstance.ext}`);
              setTimeout(() => {
                notification.removeNotification(note);
              }, 3000);
            }
          }
        }
      };

      _updateBagMesh();
      _updateEquipmentBoxMeshes();
      _updateAssetInstances();
    };
    render.on('update', _update);

    const _gripdown = e => {
      const {side} = e;

      const equipmentHoverState = equipmentHoverStates[side];
      const {equipmentIndex} = equipmentHoverState;
      if (equipmentIndex !== -1) {
        const grabbable = equipmentState.assets[equipmentIndex];

        if (grabbable) {
          const equipmentBoxMesh = bagMesh.equipmentBoxMeshes[equipmentIndex];
          equipmentBoxMesh.remove(grabbable.mesh);
          scene.add(grabbable.mesh);

          grabbable.grab(side);
          grabbable.setOwner(null);

          equipmentState.assets[equipmentIndex] = null;
          _saveEquipment();
        }
      }
    };
    input.on('gripdown', _gripdown);

    const _release = e => {
      const {side, grabbable} = e;

      const equipmentHoverState = equipmentHoverStates[side];
      const {equipmentIndex} = equipmentHoverState;
      if (equipmentIndex !== -1) {
        const equipmentBoxMesh = bagMesh.equipmentBoxMeshes[equipmentIndex];
        equipmentBoxMesh.add(grabbable.mesh);
        grabbable.setState(zeroVector, zeroQuaternion, localVector.copy(oneVector).multiplyScalar(0.4));
        grabbable.disablePhysics();
        grabbable.setOwner(player.getId());

        equipmentState.assets[equipmentIndex] = grabbable;
        _saveEquipment();
      }
    };
    hands.on('release', _release);

    this._cleanup = () => {
      scene.remove(bagMesh);

      render.removeListener('update', _update);
      input.removeListener('gripdown', _gripdown);
      hands.removeListener('release', _release);
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
const _makeId = () => Math.random().toString(36).substring(7);
const _debounce = fn => {
  let running = false;
  let queued = false;

  const _go = () => {
    if (!running) {
      running = true;

      fn(() => {
        running = false;

        if (queued) {
          queued = false;

          _go();
        }
      });
    } else {
      queued = true;
    }
  };
  return _go;
};

module.exports = BagVr;
