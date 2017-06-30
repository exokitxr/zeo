const NUM_BOX_MESHES = 20;
const NUM_POSITIONS = 1000;
const UPDATE_RATE = 20;

const SIDES = ['left', 'right'];

class Physics {
  mount() {
    const {three, elements, input, pose, render, player, physics} = zeo;
    const {THREE, scene} = three;

    const zeroVector = new THREE.Vector3();
    const boxGeometry = new THREE.BoxBufferGeometry(0.3, 0.3, 0.3);
    const boxMaterial = new THREE.MeshPhongMaterial({
      color: 0xFF0000,
      transparent: true,
      opacity: 0.9,
    });

    const playerId = player.getId();

    const _getRandomState = () => {
      const position = new THREE.Vector3(
        -2 + (Math.random() * 4),
        50,
        -2 + (Math.random() * 4)
      );
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        Math.random() * (Math.PI * 2),
        Math.random() * (Math.PI * 2),
        Math.random() * (Math.PI * 2)
      ));
      return {position, rotation};
    };
    const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
      for (let i = 0; i < src.length; i++) {
        dst[startIndexIndex + i] = src[i] + startAttributeIndex;
      }
    };

    const cleanupSymbol = Symbol();

    const physicsEntity = {
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0, 0, 0,
            0, 0, 0, 1,
            1, 1, 1
          ]
        },
      },
      entityAddedCallback(entityElement) {
        const boxMeshes = [];
        const bodies = [];

        const boxMegaMesh = (() => {
          const geometry = new THREE.BufferGeometry();
          const positions = new Float32Array(NUM_POSITIONS * 3);
          const positionAttribute = new THREE.BufferAttribute(positions, 3);
          geometry.addAttribute('position', positionAttribute);
          const normals = new Float32Array(NUM_POSITIONS * 3);
          const normalAttribute = new THREE.BufferAttribute(normals, 3);
          geometry.addAttribute('normal', normalAttribute);
          const indices = new Uint16Array(NUM_POSITIONS * 3);
          const indexAttribute = new THREE.BufferAttribute(indices, 1);
          geometry.setIndex(indexAttribute);
          geometry.setDrawRange(0, 0);

          const mesh = new THREE.Mesh(geometry, boxMaterial);
          mesh.frustumCulled = false;
          mesh.needsUpdate = false;
          mesh.update = () => {
            if (mesh.needsUpdate) {
              let attributeIndex = 0;
              let indexIndex = 0;

              for (let i = 0; i < SIDES.length; i++) {
                const side = SIDES[i];
                const controllerMesh = controllerMeshes[side];
                const {childMesh} = controllerMesh;
                const geometry = childMesh.geometry
                  .clone()
                  .applyMatrix(childMesh.matrixWorld);
                const newPositions = geometry.getAttribute('position').array;
                positions.set(newPositions, attributeIndex);
                const newNormals = geometry.getAttribute('normal').array;
                normals.set(newNormals, attributeIndex);
                const newIndices = geometry.index.array;
                _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

                attributeIndex += newPositions.length;
                indexIndex += newIndices.length;
              }
              for (let i = 0; i < boxMeshes.length; i++) {
                const boxMesh = boxMeshes[i];
                const geometry = boxMesh.geometry
                  .clone()
                  .applyMatrix(boxMesh.matrixWorld);
                const newPositions = geometry.getAttribute('position').array;
                positions.set(newPositions, attributeIndex);
                const newNormals = geometry.getAttribute('normal').array;
                normals.set(newNormals, attributeIndex);
                const newIndices = geometry.index.array;
                _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

                attributeIndex += newPositions.length;
                indexIndex += newIndices.length;
              }
              positionAttribute.needsUpdate = true;
              normalAttribute.needsUpdate = true;
              indexAttribute.needsUpdate = true;
              geometry.setDrawRange(0, indexIndex);

              mesh.needsUpdate = false;
            }
          };
          return mesh;
        })();
        scene.add(boxMegaMesh);

        const _makeControllerMesh = side => {
          const object = new THREE.Object3D();

          const childMesh = (() => {
            const geometry = new THREE.BoxBufferGeometry(0.115, 0.075, 0.215);
            const material = boxMaterial;
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(0, -(0.075 / 2), (0.215 / 2) - 0.045);
            mesh.updateMatrix();
            return mesh;
          })();
          object.add(childMesh);
          object.childMesh = childMesh;

          const physicsBody = physics.makeBody(object, `controller:${playerId}:${side}`, {
            linearFactor: zeroVector.toArray(),
            angularFactor: zeroVector.toArray(),
            disableDeactivation: true,
            bindObject: true,
            bindConnection: true,
          });
          physicsBody.on('update', () => {
            boxMegaMesh.needsUpdate = true;
          });
          object.physicsBody = physicsBody;

          return object;
        };
        const controllerMeshes = {
          left: _makeControllerMesh('left'),
          right: _makeControllerMesh('right'),
        };
        boxMegaMesh.needsUpdate = true;

        const _makeBoxMesh = () => {
          const geometry = boxGeometry;
          const material = boxMaterial;
          const mesh = new THREE.Mesh(geometry, material);
          const {position, rotation} = _getRandomState();
          mesh.position.copy(position);
          mesh.quaternion.copy(rotation);
          mesh.updateMatrix();
          return mesh;
        };

        for (let i = 0; i < NUM_BOX_MESHES; i++) {
          const boxMesh = _makeBoxMesh();
          boxMeshes.push(boxMesh);

          const boxBody = physics.makeBody(boxMesh, 'box:' + i, {
            bindObject: true,
            bindConnection: false,
          });
          boxBody.on('update', () => {
            boxMegaMesh.needsUpdate = true;
          });
          boxMesh.body = boxBody;
          bodies.push(boxBody);
        };
        boxMegaMesh.needsUpdate = true;

        const planeMesh = (() => {
          const geometry = new THREE.PlaneBufferGeometry(1000, 1000, 1, 1)
            .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(
              new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 0, 1),
                new THREE.Vector3(0, 1, 0)
              )
            ));
          const material = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0,
            depthWrite: false,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(0, 0, 0);
          mesh.quaternion;
          return mesh;
        })();
        scene.add(planeMesh);
        planeMesh.updateMatrixWorld();
        const planeBody = physics.makeBody(planeMesh, 'plane', {
          mass: 0,
          bindObject: true,
          bindConnection: false,
        });
        planeMesh.body = planeBody;

        const _keypress = e => {
          if (e.key === 'k') {
            for (let i = 0; i < bodies.length; i++) {
              const body = bodies[i];
              const {position, rotation} = _getRandomState();
              const linearVelocity = zeroVector.toArray();
              const angularVelcity = zeroVector.toArray();
              const activate = true;
              body.setState(position.toArray(), rotation.toArray(), linearVelocity, angularVelcity, activate);
            }
          }
        };
        input.on('keypress', _keypress);

        let lastUpdateTime = Date.now();
        const _update = () => {
          const _updateBoxMegaMesh = () => {
            boxMegaMesh.update();
          };
          const _updateControllerState = () => {
            const now = Date.now();
            const timeDiff = now - lastUpdateTime;
            if (timeDiff > UPDATE_RATE) {
              const {gamepads} = pose.getStatus();

              for (let i = 0; i < SIDES.length; i++) {
                const side = SIDES[i];
                const gamepad = gamepads[side];
                const {worldPosition: controlerPosition, worldRotation: controllerRotation} = gamepad;
                const controllerMesh = controllerMeshes[side];
                const {physicsBody} = controllerMesh;
                physicsBody.setState(controlerPosition.toArray(), controllerRotation.toArray(), zeroVector.toArray(), zeroVector.toArray(), false);
              }

              lastUpdateTime = now;
            }
          };

          _updateBoxMegaMesh();
          _updateControllerState();
        };
        render.on('update', _update);

        entityElement[cleanupSymbol] = () => {
          scene.remove(boxMegaMesh);

          for (let i = 0; i < boxMeshes.length; i++) {
            const boxMesh = boxMeshes[i];
            const {body: boxBody} = boxMesh;
            physics.destroyBody(boxBody);
            bodies.splice(bodies.indexOf(boxBody), 1);
          }

          scene.remove(planeMesh);
          const {body: planeBody} = planeMesh;
          physics.destroyBody(planeBody);

          input.removeListener('keypress', _keypress);
          render.removeListener('update', _update);
        };
      },
      entityRemovedCallback(entityElement) {
        const {[cleanupSymbol]: cleanup} = entityElement;

        cleanup();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        // XXX
      },
    };
    elements.registerEntity(this, physicsEntity);

    this._cleanup = () => {
      boxMaterial.dispose();

      elements.unregisterEntity(this, physicsEntity);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Physics;
