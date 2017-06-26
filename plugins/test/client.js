class Test {
  mount() {
    const {three, elements, input, pose, physics, payment} = zeo;
    const {THREE, scene} = three;

    const dataSymbol = Symbol();
    const bodies = [];

    console.log('mount');

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
          const material = new THREE.MeshPhongMaterial({
            color: 0xFF0000,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(-2, 5, 0);
          mesh.rotation.set(Math.PI / 4, 0, Math.PI / 4);
          return mesh;
        })();
        scene.add(boxMesh);
        boxMesh.updateMatrixWorld();
        const boxBody = physics.makeBody(boxMesh, 'box', {
          mass: 1,
          bindObject: true,
          bindConnection: true,
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
          body.setState(position, rotation);
        }
      }
    };
    input.on('keypress', _keypress);

    this._cleanup = () => {
      elements.unregisterEntity(this, testEntity);

      input.removeListener('keypress', _keypress);
    };
  }

  unmount() {
    console.log('unmount');

    this._cleanup();
  }
}

module.exports = Test;
