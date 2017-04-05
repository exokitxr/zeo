const ConvexGeometry = require('./lib/three-extra/ConvexGeometry');

class Avatar {
  mount() {
    const {three: {THREE}, elements} = zeo;

    const THREEConvexGeometry = ConvexGeometry(THREE);

    const sqrt2 = Math.sqrt(2);
    const hexahedronGeometry = (() => {
      const points = [
        new THREE.Vector3(0, 0.1, 0),
        new THREE.Vector3(-0.1, 0, 0),
        new THREE.Vector3(0.1, 0, 0),
        new THREE.Vector3(0, 0, 0.1 / sqrt2),
        new THREE.Vector3(0, 0, -0.1 / sqrt2),
        new THREE.Vector3(0, -0.1, 0),
      ];
      return new THREEConvexGeometry(points);
    })();
    const pyramidGeometry = (() => {
      const points = [
        new THREE.Vector3(-0.1, 0, -0.1),
        new THREE.Vector3(0.1, 0, -0.1),
        new THREE.Vector3(0, 0, 0.1 / sqrt2),
        new THREE.Vector3(0, -0.1, 0),
      ];
      return new THREEConvexGeometry(points);
    })();
    const triangleGeometry = (() => {
      const points = [
        new THREE.Vector3(0, 0.1, 0),
        new THREE.Vector3(-0.1, 0, 0),
        new THREE.Vector3(0.1, 0, 0),
        new THREE.Vector3(0, 0, 0.1 / sqrt2),
        new THREE.Vector3(0, 0, -0.1 / sqrt2),
      ];
      return new THREEConvexGeometry(points);
    })();

    const raptorComponent = {
      selector: 'raptor[position]',
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
        const entityApi = entityElement.getComponentApi();
        const entityObject = entityElement.getObject();

        const mesh = (() => {
          const result = new THREE.Object3D();
          result.position.x = -1;

          const solidMaterial = new THREE.MeshPhongMaterial({
            color: 0x4CAF50,
            shininess: 10,
            shading: THREE.FlatShading,
          });

          const head = (() => {
            const geometry = hexahedronGeometry.clone();
            const material = solidMaterial;
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.y = 1;
            mesh.position.z = 0.4;
            mesh.scale.z = 3;
            return mesh;
          })();
          result.add(head);
          result.head = head;

          const body = (() => {
            const geometry = pyramidGeometry.clone();
            const material = solidMaterial;
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.y = 0.9;
            mesh.scale.set(2, 3, 5);
            return mesh;
          })();
          result.add(body);
          result.body = body;

          const leftArm = (() => {
            const geometry = triangleGeometry.clone();
            const material = solidMaterial;
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(-0.15, 0.75, 0.25);
            mesh.scale.set(0.5, 0.75, 2.5);
            return mesh;
          })();
          result.add(leftArm);
          result.body = leftArm;

          const rightArm = (() => {
            const geometry = triangleGeometry.clone();
            const material = solidMaterial;
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(0.15, 0.75, 0.25);
            mesh.scale.set(0.5, 0.75, 2.5);
            return mesh;
          })();
          result.add(rightArm);
          result.body = rightArm;

          /* const leftLeg = (() => {
            const geometry = tetrahedronGeometry.clone();
            const material = solidMaterial;
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.y = 0.3;
            mesh.position.x = -0.1;
            mesh.scale.set(0.75, 3, 0.75);
            return mesh;
          })();
          result.add(leftLeg);
          result.body = leftLeg;

          const rightLeg = (() => {
            const geometry = tetrahedronGeometry.clone();
            const material = solidMaterial;
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.y = 0.3;
            mesh.position.x = 0.1;
            mesh.scale.set(0.75, 3, 0.75);
            return mesh;
          })();
          result.add(rightLeg);
          result.body = rightLeg; */

          return result;
        })();
        entityObject.add(mesh);
        entityApi.mesh = mesh;

        entityApi._cleanup = () => {
          entityObject.remove(mesh);
        };
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getComponentApi();

        switch (name) {
          /* case 'position': { // XXX re-enable this
            const position = newValue;

            if (position) {
              const {mesh} = entityApi;

              mesh.position.set(position[0], position[1], position[2]);
              mesh.quaternion.set(position[3], position[4], position[5], position[6]);
              mesh.scale.set(position[7], position[8], position[9]);
            }

            break;
          } */
        }
      },
      entityRemovedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();

        entityApi._cleanup();
      },
    };
    elements.registerComponent(this, raptorComponent);

    this._cleanup = () => {
      elements.unregisterComponent(this, raptorComponent);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Avatar;
