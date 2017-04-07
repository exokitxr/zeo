const ConvexGeometry = require('./lib/three-extra/ConvexGeometry');

const SIDES = ['left', 'right'];

class Egg {
  mount() {
    const {three: {THREE, scene, camera}, elements, render, pose, input, world, ui, sound, utils: {geometry: geometryUtils}} = zeo;

    const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
    const _decomposeMatrix = matrix => {
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(position, rotation, scale);
      return {position, rotation, scale};
    };

    const THREEConvexGeometry = ConvexGeometry(THREE);

    const shellGeometries = [
      new THREEConvexGeometry([
        new THREE.Vector3(-0.1, -0.05, -0.1),
        new THREE.Vector3(0.1, -0.05, -0.1),
        new THREE.Vector3(-0.1, -0.05, 0.1),
        new THREE.Vector3(0.1, -0.05, 0.1),

        new THREE.Vector3(-0.05, -0.125, -0.05),
        new THREE.Vector3(0.05, -0.125, -0.05),
        new THREE.Vector3(-0.05, -0.125, 0.05),
        new THREE.Vector3(0.05, -0.125, 0.05),
      ]),
      new THREEConvexGeometry([
        new THREE.Vector3(-0.1, 0.05, -0.1),
        new THREE.Vector3(0.1, 0.05, -0.1),
        new THREE.Vector3(-0.1, 0.05, 0.1),
        new THREE.Vector3(0.1, 0.05, 0.1),

        new THREE.Vector3(-0.1, -0.05, -0.1),
        new THREE.Vector3(0.1, -0.05, -0.1),
        new THREE.Vector3(-0.1, -0.05, 0.1),
        new THREE.Vector3(0.1, -0.05, 0.1),

        new THREE.Vector3(-0.05, -0.125, -0.05),
        new THREE.Vector3(0.05, -0.125, -0.05),
        new THREE.Vector3(-0.05, -0.125, 0.05),
        new THREE.Vector3(0.05, -0.125, 0.05),
      ]),
      new THREEConvexGeometry([
        new THREE.Vector3(-0.1, 0.05, -0.1),
        new THREE.Vector3(0.1, 0.05, -0.1),
        new THREE.Vector3(-0.1, 0.05, 0.1),
        new THREE.Vector3(0.1, 0.05, 0.1),

        new THREE.Vector3(-0.1, -0.05, -0.1),
        new THREE.Vector3(0.1, -0.05, -0.1),
        new THREE.Vector3(-0.1, -0.05, 0.1),
        new THREE.Vector3(0.1, -0.05, 0.1),

        new THREE.Vector3(-0.05, 0.175, -0.05),
        new THREE.Vector3(0.05, 0.175, -0.05),
        new THREE.Vector3(-0.05, 0.175, 0.05),
        new THREE.Vector3(0.05, 0.175, 0.05),

        new THREE.Vector3(-0.05, -0.125, -0.05),
        new THREE.Vector3(0.05, -0.125, -0.05),
        new THREE.Vector3(-0.05, -0.125, 0.05),
        new THREE.Vector3(0.05, -0.125, 0.05),
      ]),
    ];
    const sqrt2 = Math.sqrt(2);
    /* const quentahedronGeometry = new THREEConvexGeometry([
      new THREE.Vector3(0, 0.1, 0),
      new THREE.Vector3(-0.1, 0, 0),
      new THREE.Vector3(0.1, 0, 0),
      new THREE.Vector3(0, 0, 0.1 / sqrt2),
      new THREE.Vector3(0, 0, -0.1 / sqrt2),
    ]);
    const tetrahedronGeometry = new THREEConvexGeometry([
      new THREE.Vector3(-0.1, 0, 0),
      new THREE.Vector3(0.1, 0, 0),
      new THREE.Vector3(0, -0.1, 0),
      new THREE.Vector3(0, 0, 0.1 / sqrt2),
    ]); */
    const pyramidGeometry = new THREEConvexGeometry([
      new THREE.Vector3(-0.1, 0, -0.1),
      new THREE.Vector3(0.1, 0, -0.1),
      new THREE.Vector3(0, 0, 0.1 / sqrt2),
      new THREE.Vector3(0, -0.1, 0),
    ]);
    const triangleGeometry = new THREEConvexGeometry([
      new THREE.Vector3(0, 0.1, 0),
      new THREE.Vector3(-0.1, 0, 0),
      new THREE.Vector3(0.1, 0, 0),
      new THREE.Vector3(0, 0, 0.1 / sqrt2),
      new THREE.Vector3(0, 0, -0.1 / sqrt2),
    ]);
    const longGeometry = new THREEConvexGeometry([
      new THREE.Vector3(-0.1, 0, 0),
      new THREE.Vector3(0.1, 0, 0),
      new THREE.Vector3(0, -0.05, 0.05),
      new THREE.Vector3(0, 0, -0.2),
    ]);
    const tallGeometryLeft = new THREEConvexGeometry([
      new THREE.Vector3(0, 0.05, 0.1),
      new THREE.Vector3(0, 0.1, -0.1),
      new THREE.Vector3(-0.075, 0, 0),
      new THREE.Vector3(0, -0.2, -0.1),
    ]);
    const tallGeometryRight = new THREEConvexGeometry([
      new THREE.Vector3(0, 0.05, 0.1),
      new THREE.Vector3(0, 0.1, -0.1),
      new THREE.Vector3(0.075, 0, 0),
      new THREE.Vector3(0, -0.2, -0.1),
    ]);
    const shellMaterial = new THREE.MeshPhongMaterial({
      color: 0x808080,
      shininess: 10,
      shading: THREE.FlatShading,
    });
    const whiteMaterial = new THREE.MeshPhongMaterial({
      color: 0xFFFFFF,
      shininess: 10,
      shading: THREE.FlatShading,
    });
    const yolkMaterial = new THREE.MeshPhongMaterial({
      color: 0xFFC107,
      shininess: 10,
      shading: THREE.FlatShading,
    });
    const raptorMaterial = new THREE.MeshPhongMaterial({
      color: 0xF44336,
      shininess: 10,
      shading: THREE.FlatShading,
    });

    const eggComponent = {
      selector: 'egg[position][bites]',
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0, 0, 0,
            0, 0, 0, 1,
            1, 1, 1,
          ],
        },
        bites: {
          type: 'number',
          value: 2,
          min: 0,
          max: 2,
          step: 1,
        },
        grabbable: {
          type: 'checkbox',
          value: true,
        },
        holdable: {
          type: 'checkbox',
          value: true,
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();
        const entityObject = entityElement.getObject();

        entityApi.mesh = null;
        entityApi.position = null;
        entityApi.bites = 2;

        const _render = () => {
          const {mesh: oldMesh} = entityApi;
          if (oldMesh) {
            entityObject.remove(oldMesh);
          }

          const newMesh = (() => {
            const result = new THREE.Object3D();

            const {bites} = entityApi;
            const shellMesh = (() => {
              const geometry = shellGeometries[bites].clone();
              const material = shellMaterial;
              const mesh = new THREE.Mesh(geometry, material);
              return mesh;
            })();
            result.add(shellMesh);
            if (bites === 1) {
              const whiteMesh = (() => {
                const geometry = new THREE.BoxBufferGeometry(0.15, 0.1, 0.15);
                const material = whiteMaterial;
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.y = 0.01;
                return mesh;
              })();
              result.add(whiteMesh);
              const yolkMesh = (() => {
                const geometry = new THREE.BoxBufferGeometry(0.075, 0.1, 0.075);
                const material = yolkMaterial;
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.y = 0.02;
                return mesh;
              })();
              result.add(yolkMesh);
            }
            if (bites === 0) {
              const raptorMesh = (() => {
                const result = new THREE.Object3D();
                result.position.set(0, -0.1, 0.04);
                // result.rotation.order = camera.rotation.order;
                result.scale.set(0.08, 0.08, 0.08);

                const headBase = (() => {
                  const object = new THREE.Object3D();
                  object.position.y = 1;
                  object.position.z = 0.4;
                  object.rotation.order = camera.rotation.order;
                  return object;
                })();
                result.add(headBase);
                result.headBase = headBase;

                const body = (() => {
                  const geometry = pyramidGeometry.clone();
                  const material = raptorMaterial;
                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.y = 0.9;
                  mesh.scale.set(2, 3, 5);
                  return mesh;
                })();
                result.add(body);
                result.body = body;

                const leftArm = (() => {
                  const geometry = triangleGeometry.clone();
                  const material = raptorMaterial;
                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.set(-0.15, 0.75, 0.25);
                  mesh.scale.set(0.5, 0.75, 2.5);
                  return mesh;
                })();
                result.add(leftArm);
                result.leftArm = leftArm;

                const rightArm = (() => {
                  const geometry = triangleGeometry.clone();
                  const material = raptorMaterial;
                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.set(0.15, 0.75, 0.25);
                  mesh.scale.set(0.5, 0.75, 2.5);
                  return mesh;
                })();
                result.add(rightArm);
                result.rightArm = rightArm;

                const tail = (() => {
                  const geometry = longGeometry.clone();
                  const material = raptorMaterial;
                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.y = 0.9;
                  mesh.position.z = -0.55;
                  mesh.scale.set(1.5, 3, 5);
                  return mesh;
                })();
                result.add(tail);
                result.tail = tail;

                const leftLeg = (() => {
                  const geometry = tallGeometryLeft.clone();
                  const material = raptorMaterial;
                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.set(0.2, 0.6, -0.225);
                  mesh.scale.set(2, 3, 1);
                  return mesh;
                })();
                result.add(leftLeg);
                result.leftLeg = leftLeg;

                const rightLeg = (() => {
                  const geometry = tallGeometryRight.clone();
                  const material = raptorMaterial;
                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.set(-0.2, 0.6, -0.225);
                  mesh.scale.set(2, 3, 1);
                  return mesh;
                })();
                result.add(rightLeg);
                result.rightLeg = rightLeg;

                return result;
              })();
              result.add(raptorMesh);
            }

            return result;
          })();
          entityObject.add(newMesh);
          entityApi.mesh = newMesh;
        };
        entityApi.render = _render;
        _render();

        const _resize = () => {
          const {mesh, position} = entityApi;

          if (mesh && position) {
            mesh.position.set(position[0], position[1], position[2]);
            mesh.quaternion.set(position[3], position[4], position[5], position[6]);
            mesh.scale.set(position[7], position[8], position[9]);
          }
        };
        entityApi.resize = _resize;
        _resize();

        /* const soundBody = (() => {
          const result = sound.makeBody();
          result.setInputElements(audios);
          result.setObject(head);
          return result;
        })(); */

        const _eat = e => {
          const {bites} = entityApi;

          if (bites > 0) {
            entityElement.setAttribute('bites', JSON.stringify(bites));
          }
        };
        entityElement.addEventListener('eat', _eat);

        entityApi._cleanup = () => {
          const {mesh} = entityApi;
          if (mesh) {
            entityObject.remove(mesh);
          }

          entityElement.removeEventListener('eat', _eat);
        };
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getComponentApi();

        switch (name) {
          case 'position': {
            entityApi.position = newValue;

            entityApi.resize();

            break;
          }
          case 'bites': {
            entityApi.bites = newValue;

            entityApi.render();
            entityApi.resize();

            break;
          }
        }
      },
      entityRemovedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();

        entityApi._cleanup();
      },
    };
    elements.registerComponent(this, eggComponent);

    this._cleanup = () => {
      elements.unregisterComponent(this, eggComponent);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Egg;
