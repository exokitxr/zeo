const NUM_BOX_MESHES = 20;

const SIDES = ['left', 'right'];

class Physics {
  mount() {
    const {three, elements, input, pose, render, player, physics} = zeo;
    const {THREE, scene} = three;

    const zeroVector = new THREE.Vector3();
    const boxGeometry = new THREE.BoxBufferGeometry(0.1, 0.1, 0.1);
    const boxMaterial = new THREE.MeshPhongMaterial({
      color: 0xFF0000,
      transparent: true,
      opacity: 0.9,
    });

    const playerId = player.getId();

    const _getRandomState = () => {
      const position = new THREE.Vector3(-2 + (Math.random() * 4), 3, -2 + (Math.random() * 4));
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        Math.random() * (Math.PI * 2),
        Math.random() * (Math.PI * 2),
        Math.random() * (Math.PI * 2)
      ));
      return {position, rotation};
    };

    const dataSymbol = Symbol();
    const bodies = [];

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

      const physicsBody = physics.makeBody(object, `controller:${playerId}:${side}`, {
        linearFactor: zeroVector.toArray(),
        angularFactor: zeroVector.toArray(),
        disableDeactivation: true,
        bindObject: true,
        bindConnection: true,
      });
      object.physicsBody = physicsBody;

      return object;
    };
    const controllerMeshes = {
      left: _makeControllerMesh('left'),
      right: _makeControllerMesh('right'),
    };
    scene.add(controllerMeshes.left);
    scene.add(controllerMeshes.right);

    const testEntity = {
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0, 0, 0,
            0, 0, 0, 1,
            1, 1, 1
          ]
        },
        text: {
          type: 'text',
          value: 'Some text',
        },
        number: {
          type: 'number',
          value: 1,
          min: 0,
          max: 10,
          step: 1,
        },
        select: {
          type: 'select',
          value: 'Option A',
          options: [
            'Option A',
            'Option B',
          ],
        },
        color: {
          type: 'color',
          value: '#E91E63',
        },
        checkbox: {
          type: 'checkbox',
          value: false,
        },
        file: {
          type: 'file',
          value: 'https://lol.com',
        },
      },
      entityAddedCallback(entityElement) {
        const _makeBoxMesh = () => {
          const geometry = boxGeometry;
          const material = boxMaterial;
          const mesh = new THREE.Mesh(geometry, material);
          const {position, rotation} = _getRandomState();
          mesh.position.copy(position);
          mesh.quaternion.copy(rotation);
          return mesh;
        };

        const boxMeshes = [];
        for (let i = 0; i < NUM_BOX_MESHES; i++) {
          const boxMesh = _makeBoxMesh();
          scene.add(boxMesh);
          boxMesh.updateMatrixWorld();
          boxMeshes.push(boxMesh);

          const boxBody = physics.makeBody(boxMesh, 'box:' + i, {
            bindObject: true,
            bindConnection: false,
          });
          
          boxMesh.body = boxBody;
          bodies.push(boxBody);
        };

        const planeMesh = (() => {
          const geometry = new THREE.PlaneBufferGeometry(1000, 1000, 1, 1)
            .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(
              new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 0, 1),
                new THREE.Vector3(0, 1, 0)
              )
            ));
          const material = new THREE.MeshPhongMaterial({
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

        entityElement[dataSymbol] = {
          boxMeshes,
          planeMesh,
        };
      },
      entityRemovedCallback(entityElement) {
        const {[dataSymbol]: {boxMeshes, planeMesh}} = entityElement;

        for (let i = 0; i < boxMeshes.length; i++) {
          const boxMesh = boxMeshes[i];
          scene.remove(boxMesh);
          const {body: boxBody} = boxMesh;
          physics.destroyBody(boxBody);
          bodies.splice(bodies.indexOf(boxBody), 1);
        }

        scene.remove(planeMesh);
        const {body: planeBody} = planeMesh;
        physics.destroyBody(planeBody);
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        // XXX
      },
    };
    elements.registerEntity(this, testEntity);

    let lastUpdateTime = Date.now();
    const _update = () => {
      const now = Date.now();
      const timeDiff = now - lastUpdateTime;
      if (timeDiff > 50) {
        const {gamepads} = pose.getStatus();

        SIDES.forEach(side => {
          const gamepad = gamepads[side];
          const {worldPosition: controlerPosition, worldRotation: controllerRotation} = gamepad;
          const controllerMesh = controllerMeshes[side];
          const {physicsBody} = controllerMesh;
          physicsBody.setState(controlerPosition.toArray(), controllerRotation.toArray(), zeroVector.toArray(), zeroVector.toArray(), false);
        });

        lastUpdateTime = now;
      }
    };
    render.on('update', _update);

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

    this._cleanup = () => {
      boxMaterial.dispose();

      scene.remove(controllerMeshes.left);
      scene.remove(controllerMeshes.right);

      elements.unregisterEntity(this, testEntity);

      render.removeListener('update', _update);
      input.removeListener('keypress', _keypress);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Physics;
