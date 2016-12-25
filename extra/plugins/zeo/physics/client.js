class Physics {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestEngines([
      '/core/engines/zeo',
      '/core/engines/rend',
    ]).then(([
      zeo,
      rend,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = zeo;
        const world = rend.getCurrentWorld();
        const {physics} = world;

        return world.requestMods([
          '/extra/plugins/zeo/models',
        ]).then(([
          models,
        ]) => {
          if (live) {
            const _getModelPoints = modelJson => {
              const {geometries, object} = modelJson;

              const geometryMap = _makeUuidMap(geometries);

              const _getUnindexedPoints = (attributes, index) => {
                const numPoints = index.length;
                const result = new Float32Array(numPoints * 3);

                for (let i = 0; i < numPoints; i++) {
                  const indexEntry = index[i];
                  const baseSrc = indexEntry * 3;
                  const baseDst = i * 3;

                  result[baseDst + 0] = attributes[baseSrc + 0];
                  result[baseDst + 1] = attributes[baseSrc + 1];
                  result[baseDst + 2] = attributes[baseSrc + 2];
                }

                return result;
              };
              const _getLocalGeometry = (geometryData, matrixWorld) => {
                const {data: {attributes: {position}, index}} = geometryData;

                const result = new THREE.BufferGeometry();
                result.addAttribute('position', new THREE.BufferAttribute(_getUnindexedPoints(position.array, index.array), 3));
                result.applyMatrix(matrixWorld);

                return result;
              };
              const worldGeometries = (() => {
                const result = [];

                const _recurse = (o, parentMatrix = new THREE.Matrix4()) => {
                  const {type, matrix, children} = o;

                  const localMatrix = matrix ? parentMatrix.clone().multiply(new THREE.Matrix4().fromArray(matrix)) : parentMatrix;

                  if (type === 'Mesh') {
                    const {geometry: geometryUuid} = o;
                    const geometryData = geometryMap[geometryUuid];
                    const geometry = _getLocalGeometry(geometryData, localMatrix);
                    result.push(geometry);
                  }

                  if (children) {
                    for (let i = 0; i < children.length; i++) {
                      const child = children[i];
                      _recurse(child, localMatrix);
                    }
                  }
                };
                _recurse(object);

                return result;
              })();
              const points = (() => {
                let result = [];

                for (let i = 0; i < worldGeometries.length; i++) {
                  const geometry = worldGeometries[i];

                  result = result.concat(Array.from(geometry.getAttribute('position').array));
                }

                return result;
              })();

              return points;
            };

            const model = models.getModel('cloud');
            return models.requestModelJson(model)
              .then(modelJson => {
                if (live) {
                  const modelPhysicsBody = new physics.TriangleMesh({
                    position: model.position,
                    rotation: new THREE.Quaternion().setFromEuler(new THREE.Euler(
                      model.rotation[0],
                      model.rotation[1],
                      model.rotation[2],
                      camera.rotation.order
                    )).toArray(),
                    scale: model.scale,
                    points: _getModelPoints(modelJson),
                    mass: 0,
                  });
                  physics.add(modelPhysicsBody);

                  const boxMeshSize = 0.1;
                  const boxPositionOffset = new THREE.Vector3(-1, 2, -1);
                  const zeroVector = new THREE.Vector3();
                  const zeroQuaternion = new THREE.Quaternion();
                  const numBoxMeshes = 20;

                  const _getRandomOffset = () => -0.5 + Math.random() * 1;
                  const _getRandomPosition = () => boxPositionOffset.clone().add(new THREE.Vector3(_getRandomOffset(), 0, _getRandomOffset()));

                  const boxMeshes = (() => {
                    const result = [];

                    const geometry = new THREE.BoxBufferGeometry(boxMeshSize, boxMeshSize, boxMeshSize);
                    const material = new THREE.MeshPhongMaterial({
                      color: 0x333333,
                      shininess: 0,
                      shading: THREE.FlatShading,
                    });

                    for (let i = 0; i < numBoxMeshes; i++) {
                      const mesh = new THREE.Mesh(geometry, material);
                      mesh.position.copy(_getRandomPosition());

                      result.push(mesh);
                    }

                    return result;
                  })();
                  boxMeshes.forEach(boxMesh => {
                    scene.add(boxMesh);
                  });

                  const floorPhysicsBody = new physics.Plane({
                    position: [0, 0, 0],
                    dimensions: [0, 1, 0],
                    mass: 0,
                  });
                  physics.add(floorPhysicsBody);

                  const boxPhysicsBodies = boxMeshes.map(boxMesh => {
                    const physicsBody = physics.makeBody(boxMesh);
                    physicsBody.setObject(boxMesh);
                    return physicsBody;
                  });
                  boxPhysicsBodies.forEach(physicsBody => {
                    physics.add(physicsBody);
                  });

                  const keydown = e => {
                    if (e.keyCode === 82) { // R
                      boxPhysicsBodies.forEach(physicsBody => {
                        physicsBody.setPosition(_getRandomPosition().toArray());
                        physicsBody.setRotation(zeroQuaternion.toArray());
                        physicsBody.setLinearVelocity(zeroVector.toArray());
                        physicsBody.setAngularVelocity(zeroVector.toArray());
                        physicsBody.activate();
                      });

                      e.stopImmediatePropagation();
                    }
                  };
                  zeo.addEventListener('keydown', keydown);

                  this._cleanup = () => {
                    boxMeshes.forEach(boxMesh => {
                      scene.remove(boxMesh);
                    });
                    physics.remove(floorPhysicsBody);
                    boxPhysicsBodies.forEach(physicsBody => {
                      physics.remove(physicsBody);
                    });

                    zeo.removeEventListener('keydown', keydown);
                  };
                }
              });
          }
        });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _makeUuidMap = a => {
  const result = {};

  for (let i = 0; i < a.length; i++) {
    const e = a[i];
    result[e.uuid] = e;
  }

  return result;
};

module.exports = Physics;
