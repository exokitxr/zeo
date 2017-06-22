const ConvexGeometry = require('./lib/three-extra/ConvexGeometry');

class House {
  mount() {
    const {three: {THREE, scene, camera}, elements, render, pose, input, world, ui, sound, utils: {geometry: geometryUtils}} = zeo;

    const THREEConvexGeometry = ConvexGeometry(THREE);

    const halfSq = sq(0.05) / 2;
    const roofHalfGeometry = new THREEConvexGeometry([
      new THREE.Vector3(0, 3, -1.5),
      new THREE.Vector3(0, 3, 1.5),
      new THREE.Vector3(0 + halfSq, 3 - halfSq, -1.5),
      new THREE.Vector3(0 + halfSq, 3 - halfSq, 1.5),

      new THREE.Vector3(0 - 1.2, 3 - 1.2, -1.5),
      new THREE.Vector3(0 - 1.2, 3 - 1.2, 1.5),
      new THREE.Vector3(0 - 1.2 + halfSq, 3 - 1.2 - halfSq, -1.5),
      new THREE.Vector3(0 - 1.2 + halfSq, 3 - 1.2 - halfSq, 1.5),
    ]);
    const roofWindowGeometry = new THREEConvexGeometry([
      new THREE.Vector3(0, 3, -1.5),
      new THREE.Vector3(0, 3, -1.5 + 0.05),

      new THREE.Vector3(-1, 2, -1.5),
      new THREE.Vector3(-1, 2, -1.5 + 0.05),

      new THREE.Vector3(1, 2, -1.5),
      new THREE.Vector3(1, 2, -1.5 + 0.05),
    ]);
    const houseMaterial = new THREE.MeshPhongMaterial({
      color: 0x808080,
      shading: THREE.FlatShading,
    });

    const houseEntity = {
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0, 0, 0,
            0, 0, 0, 1,
            1, 1, 1,
          ],
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = entityElement.getEntityApi();
        const entityObject = entityElement.getObject();

        const mesh = (() => {
          const object = new THREE.Object3D();

          const roofMesh = (() => {
            const object = new THREE.Object3D();

            const left = (() => {
              const geometry = roofHalfGeometry.clone();
              const material = houseMaterial;

              const mesh = new THREE.Mesh(geometry, material);
              return mesh;
            })();
            object.add(left);

            const right = (() => {
              const geometry = roofHalfGeometry.clone()
                .applyMatrix(new THREE.Matrix4().makeRotationY(Math.PI));
              const material = houseMaterial;

              const mesh = new THREE.Mesh(geometry, material);
              return mesh;
            })();
            object.add(right);

            return object;
          })();
          object.add(roofMesh);

          const wallMesh = (() => {
            const object = new THREE.Object3D();

            const left = (() => {
              const geometry = new THREE.BoxBufferGeometry(0.05, 2, 3)
                .applyMatrix(new THREE.Matrix4().makeTranslation(-1 + 0.05, 1, 0));
              const material = houseMaterial;

              const mesh = new THREE.Mesh(geometry, material);
              return mesh;
            })();
            object.add(left);

            const right = (() => {
              const geometry = new THREE.BoxBufferGeometry(0.05, 2, 3)
                .applyMatrix(new THREE.Matrix4().makeTranslation(1 - 0.05, 1, 0));
              const material = houseMaterial;

              const mesh = new THREE.Mesh(geometry, material);
              return mesh;
            })();
            object.add(right);

            const back = (() => {
              const geometry = new THREE.BoxBufferGeometry(2 - 0.05, 2, 0.05)
                .applyMatrix(new THREE.Matrix4().makeTranslation(0, 1, -1.5 + (0.05 / 2)));
              const material = houseMaterial;

              const mesh = new THREE.Mesh(geometry, material);
              return mesh;
            })();
            object.add(back);

            const backWindow = (() => {
              const geometry = roofWindowGeometry.clone();
              const material = houseMaterial;

              const mesh = new THREE.Mesh(geometry, material);
              return mesh;
            })();
            object.add(backWindow);

            const frontWindow = (() => {
              const geometry = roofWindowGeometry.clone()
                .applyMatrix(new THREE.Matrix4().makeRotationY(Math.PI));
              const material = houseMaterial;

              const mesh = new THREE.Mesh(geometry, material);
              return mesh;
            })();
            object.add(frontWindow);

            return object;
          })();
          object.add(wallMesh);

          return object;
        })();
        entityObject.add(mesh);
        entityApi.mesh = mesh;

        entityApi._cleanup = () => {
          entityObject.remove(mesh);
        };
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getEntityApi();

        switch (name) {
          case 'position': {
            const position = newValue;

            if (position) {
              const {mesh} = entityApi;

              mesh.position.set(position[0], position[1], position[2]);
              mesh.quaternion.set(position[3], position[4], position[5], position[6]);
              mesh.scale.set(position[7], position[8], position[9]);
            }

            break;
          }
        }
      },
      entityRemovedCallback(entityElement) {
        const entityApi = entityElement.getEntityApi();

        entityApi._cleanup();
      },
    };
    elements.registerEntity(this, houseEntity);

    this._cleanup = () => {
      elements.unregisterEntity(this, houseEntity);
    };
  }

  unmount() {
    this._cleanup();
  }
}

const sq = n => Math.sqrt((n * n) + (n * n));

module.exports = House;
