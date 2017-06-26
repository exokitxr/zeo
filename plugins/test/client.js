const SIDES = ['left', 'right'];

class Test {
  mount() {
    const {three, elements, input, pose, render, physics, payment} = zeo;
    const {THREE, scene} = three;

    const zeroVector = new THREE.Vector3();
    const boxMaterial = new THREE.MeshPhongMaterial({
      color: 0xFF0000,
      transparent: true,
      opacity: 0.9,
    });

    const dataSymbol = Symbol();
    const bodies = [];

    console.log('mount');

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

      const physicsBody = physics.makeBody(object, 'controller:' + side, {
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
        console.log('entityAddedCallback', {entityElement});

        const boxMesh = (() => {
          const geometry = new THREE.BoxBufferGeometry(1, 1, 1);
          const material = boxMaterial;
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(-2, 5, 0);
          mesh.rotation.set(Math.PI / 4, 0, Math.PI / 4);
          return mesh;
        })();
        scene.add(boxMesh);
        boxMesh.updateMatrixWorld();
        const boxBody = physics.makeBody(boxMesh, 'box', {
          bindObject: true,
          bindConnection: false,
        });
        boxBody.initialState = {
          position: boxMesh.position.toArray(),
          rotation: boxMesh.quaternion.toArray(),
        };
        bodies.push(boxBody);

        const planeMesh = (() => {
          const geometry = new THREE.PlaneBufferGeometry(10, 10, 100, 100)
            .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(
              new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 0, 1),
                new THREE.Vector3(0, 1, 0)
              )
            ));
          const material = new THREE.MeshPhongMaterial({
            color: 0xFFFFFF,
            wireframe: true,
            transparent: true,
            opacity: 0.5,
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
        planeBody.initialState = {
          position: planeMesh.position.toArray(),
          rotation: planeMesh.quaternion.toArray(),
        };
        bodies.push(planeBody);

        entityElement[dataSymbol] = {
          boxMesh,
          boxBody,
          planeMesh,
          planeBody,
        };
      },
      entityRemovedCallback(entityElement) {
        console.log('entityRemovedCallback', {entityElement});

        const {[dataSymbol]: {boxMesh, boxBody, planeMesh, planeBody}} = entityElement;
        scene.remove(boxMesh);
        scene.remove(planeMesh);
        physics.destroyBody(boxBody);
        physics.destroyBody(planeBody);
        bodies.splice(bodies.indexOf(boxBody), 1);
        bodies.splice(bodies.indexOf(planeBody), 1);
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        console.log('entityAttributeValueChangedCallback', {entityElement, name, oldValue, newValue});
      },
    };
    elements.registerEntity(this, testEntity);

    const _update = () => {
      const {gamepads} = pose.getStatus();

      SIDES.forEach(side => {
        const gamepad = gamepads[side];
        const {worldPosition: controlerPosition, worldRotation: controllerRotation} = gamepad;
        const controllerMesh = controllerMeshes[side];
        const {physicsBody} = controllerMesh;
        physicsBody.setState(controlerPosition.toArray(), controllerRotation.toArray(), zeroVector.toArray(), zeroVector.toArray(), false);
      });
    };
    render.on('update', _update);

    const _keypress = e => {
      if (e.keyCode === 112) { // P
        payment.requestCharge({
          dstAddress: 'G4ExZ6nYBPnu7Sr1c8kMgbzz3VS9DbGi6cNeghEirbHj',
          srcAsset: 'ZEOCOIN',
          srcQuantity: 10,
        })
          .then(result => {
            console.warn('charge result', result);
          })
          .catch(err => {
            console.warn('charge error', err);
          });
      } else if (e.keyCode === 107) { // K
        for (let i = 0; i < bodies.length; i++) {
          const body = bodies[i];
          const {initialState: {position, rotation}} = body;
          const linearVelocity = zeroVector.toArray();
          const angularVelcity = zeroVector.toArray();
          const activate = true;
          body.setState(position, rotation, linearVelocity, angularVelcity, activate);
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
    console.log('unmount');

    this._cleanup();
  }
}

module.exports = Test;
