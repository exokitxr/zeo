const SIDES = ['left', 'right'];

class Raycast {
  mount() {
    const {three: {THREE, scene, camera}, elements, render, pose, input, world, ui, sound, utils: {geometry: geometryUtils}} = zeo;

    const forwardVector = new THREE.Vector3(0, 1, 0);
    const normalMaterial = new THREE.MeshPhongMaterial({
      color: 0xF44336,
      shading: THREE.FlatShading,
      transparent: true,
      opacity: 0.5,
    });

    const _makeDotMesh = () => {
      const geometry = geometryUtils.concatBufferGeometry([
        new THREE.CylinderBufferGeometry(0, 0.015, 0.05, 5)
         .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.05 / 2, 0)),
        new THREE.TorusBufferGeometry(0.05, 0.01, 3, 6)
         .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2)),
      ])
      const material = normalMaterial;

      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      return mesh;
    };
    const dotMeshes = {
      left: _makeDotMesh(),
      right: _makeDotMesh(),
    };
    scene.add(dotMeshes.left);
    scene.add(dotMeshes.right);

    const raycastables = [];
    const _update = () => {
      if (raycastables.length > 0) {
        const {gamepads} = pose.getStatus();

        const intersections = [];
        SIDES.forEach(side => {
          const gamepad = gamepads[side];

          if (gamepad) {
            const {worldPosition: controllerPosition, worldRotation: controllerRotation} = gamepad;
            const dotMesh = dotMeshes[side];

            const raycaster = new THREE.Raycaster(
              controllerPosition,
              new THREE.Vector3(0, 0, -1).applyQuaternion(controllerRotation),
              camera.near,
              camera.far
            );
            const intersections = raycaster.intersectObjects(raycastables, true);

            if (intersections.length > 0) {
              const intersection = intersections[0];
              const {point: intersectionPoint, face: intersectionFace, object: intersectionObject} = intersection;
              const {normal} = intersectionFace;
              const intersectionObjectRotation = intersectionObject.getWorldQuaternion();
              const worldNormal = normal.clone().applyQuaternion(intersectionObjectRotation);

              dotMesh.position.copy(intersectionPoint);
              dotMesh.quaternion.setFromUnitVectors(
                forwardVector,
                worldNormal
              );

              if (!dotMesh.visible) {
                dotMesh.visible = true;
              }
            } else {
              if (dotMesh.visible) {
                dotMesh.visible = false;
              }
            }
          }
        });
      }
    };
    render.on('update', _update);

    const raycastableComponent = {
      selector: '[raycastable]',
      attributes: {
        raycastable: {
          type: 'checkbox',
          value: true,
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();
        const entityObject = entityElement.getObject();

        /* const sphereMesh = new THREE.Mesh(
          new THREE.SphereBufferGeometry(0.1, 7, 5),
          new THREE.MeshPhongMaterial({
            color: 0x4CAF50,
            shading: THREE.FlatShading,
            shininess: 0,
          })
        );
        entityObject.add(sphereMesh); */

        const _addRaycastable = () => {
          raycastables.push(entityObject);
        };
        entityApi.addRaycastable = _addRaycastable;

        const _removeRaycastable = () => {
          const index = raycastables.indexOf(entityObject);
          if (index !== -1) {
            raycastables.splice(index, 1);
          }
        };
        entityApi.removeRaycastable = _removeRaycastable;

        entityApi._cleanup = () => {
          _removeRaycastable();
        };
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getComponentApi();
        const entityObject = entityElement.getObject();

        switch (name) {
          case 'position': {
            const position = newValue;

            if (position) {
              entityObject.position.set(position[0], position[1], position[2]);
              entityObject.quaternion.set(position[3], position[4], position[5], position[6]);
              entityObject.scale.set(position[7], position[8], position[9]);
            }

            break;
          }
          case 'raycastable': {
            if (newValue) {
              entityApi.addRaycastable();
            } else {
              entityApi.removeRaycastable();
            }

            break;
          }
        }
      },
      entityRemovedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();

        entityApi._cleanup();
      },
    };
    elements.registerComponent(this, raycastableComponent);

    this._cleanup = () => {
      SIDES.forEach(side => {
        scene.remove(dotMeshes[side]);
      });

      elements.unregisterComponent(this, raycastableComponent);

      render.removeListener('update', _update);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Raycast;
