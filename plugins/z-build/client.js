const mod = require('mod-loop');

const DIRTY_TIME = 1000;

const SIDES = ['left', 'right'];

class ZBuild {
  mount() {
    const {three: {THREE, scene, camera}, elements, input, pose, world, render, player, utils: {network: networkUtils, geometry: geometryUtils, menu: menuUtils}} = zeo;
    const {AutoWs} = networkUtils;

    const targetPlaneImg = menuUtils.getTargetPlaneImg();
    const colorWheelImg = menuUtils.getColorWheelImg();

    let live = true;
    this.cleanup = () => {
      live = false;
    };

    // const worldElement = elements.getWorldElement();

    const _requestImg = url => new Promise((accept, reject) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(err);
      };
    });
    const _requestImgs = () => Promise.all([
      _requestImg('archae/z-build/icons/rotate.svg'),
      _requestImg('archae/z-build/icons/resize.svg'),
    ])
      .then(([
        rotateImg,
        resizeImg,
      ]) => ({
        rotateImg,
        resizeImg,
      }));

    return _requestImgs()
      .then(({
        rotateImg,
        resizeImg,
      }) => {
        if (live) {
          const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
          const _decomposeMatrix = matrix => {
            const position = new THREE.Vector3();
            const rotation = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            matrix.decompose(position, rotation, scale);
            return {position, rotation, scale};
          };

          const zeroVector = new THREE.Vector3();
          const zeroQuaternion = new THREE.Quaternion();
          const oneVector = new THREE.Vector3(1, 1, 1);
          const oneAndHalfVector = new THREE.Vector3(1.5, 1.5, 1.5);

          const _makeShapeMaterial = ({
            color = 0x808080,
          } = {}) => new THREE.MeshPhongMaterial({
            color,
            shading: THREE.FlatShading,
            side: THREE.DoubleSide,
          });

          const buildComponent = {
            selector: 'build[position][build-id][color]',
            attributes: {
              position: {
                type: 'matrix',
                value: [
                  0, 1.2, 0,
                  0, 0, 0, 1,
                  1, 1, 1,
                ],
              },
              'build-id': {
                type: 'text',
                value: _makeId,
              },
              color: {
                type: 'color',
                value: '#808080',
              },
              file: {
                type: 'file',
                value: () => elements.makeFile({
                  ext: 'json',
                }).then(file => file.url),
              },
              grabbable: {
                type: 'checkbox',
                value: true,
              },
              holdable: {
                type: 'checkbox',
                value: true,
              },
              size: {
                type: 'vector',
                value: [0.2, 0.2, 0.2],
              },
            },
            entityAddedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();
              const entityObject = entityElement.getObject();

              const shapesWidth = 0.18;
              const shapesHeight = 0.18;
              const shapesPerRow = 4;
              const shapesPerCol = 2;
              const shapeWidth = shapesWidth / shapesPerRow;
              const shapeHeight = shapesHeight / shapesPerCol;
              const shapeSize = 0.02;
              const toolMesh = (() => {
                const object = new THREE.Object3D();

                const coreMesh = (() => {
                  const geometry = (() => {
                    const sq = n => Math.sqrt((n * n) + (n * n));

                    const coreGeometry = new THREE.BoxBufferGeometry(0.04, 0.04, 0.2);
                    const tipsGeometries = [
                      new THREE.BoxBufferGeometry(0.02, 0.02, 0.05)
                        .applyMatrix(new THREE.Matrix4().makeTranslation(-0.04 / 2, 0.04 / 2, -0.2 / 2)),
                      new THREE.BoxBufferGeometry(0.02, 0.02, 0.05)
                        .applyMatrix(new THREE.Matrix4().makeTranslation(0.04 / 2, 0.04 / 2, -0.2 / 2)),
                      new THREE.BoxBufferGeometry(0.02, 0.02, 0.05)
                        .applyMatrix(new THREE.Matrix4().makeTranslation(-0.04 / 2, -0.04 / 2, -0.2 / 2)),
                      new THREE.BoxBufferGeometry(0.02, 0.02, 0.05)
                        .applyMatrix(new THREE.Matrix4().makeTranslation(0.04 / 2, -0.04 / 2, -0.2 / 2)),
                    ];

                    return geometryUtils.concatBufferGeometry([coreGeometry].concat(tipsGeometries));
                  })();
                  const material = new THREE.MeshPhongMaterial({
                    color: 0x808080,
                  });

                  const mesh = new THREE.Mesh(geometry, material);
                  return mesh;
                })();
                object.add(coreMesh);
                object.coreMesh = coreMesh;

                const shapeMeshContainer = (() => {
                  const object = new THREE.Object3D();
                  object.position.z = -(0.2 / 2) - (0.05 / 2) - (0.02 / 2);
                  return object;
                })();
                object.add(shapeMeshContainer);
                object.shapeMeshContainer = shapeMeshContainer;

                const menuMesh = (() => {
                  const object = new THREE.Object3D();

                  const targetPlaneMesh = (() => {
                    const geometry = (() => {
                      const planeGeometries = [
                        new THREE.PlaneBufferGeometry(0.2, 0.2)
                          .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
                          .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.2 / 2, 0)),
                        new THREE.PlaneBufferGeometry(0.2, 0.2)
                          .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
                          .applyMatrix(new THREE.Matrix4().makeRotationZ(-Math.PI / 2))
                          .applyMatrix(new THREE.Matrix4().makeTranslation(0.2 / 2, 0, 0)),
                        new THREE.PlaneBufferGeometry(0.2, 0.2)
                          .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
                          .applyMatrix(new THREE.Matrix4().makeRotationZ(Math.PI))
                          .applyMatrix(new THREE.Matrix4().makeTranslation(0, -0.2 / 2, 0)),
                        new THREE.PlaneBufferGeometry(0.2, 0.2)
                          .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
                          .applyMatrix(new THREE.Matrix4().makeRotationZ(Math.PI / 2))
                          .applyMatrix(new THREE.Matrix4().makeTranslation(-0.2 / 2, 0, 0)),
                      ];

                      return geometryUtils.concatBufferGeometry(planeGeometries);
                    })();
                    const texture = new THREE.Texture(
                      targetPlaneImg,
                      THREE.UVMapping,
                      THREE.ClampToEdgeWrapping,
                      THREE.ClampToEdgeWrapping,
                      THREE.NearestFilter,
                      THREE.NearestFilter,
                      THREE.RGBAFormat,
                      THREE.UnsignedByteType,
                      16
                    );
                    texture.needsUpdate = true;
                    const material = new THREE.MeshBasicMaterial({
                      color: 0xFFFFFF,
                      map: texture,
                      side: THREE.DoubleSide,
                      transparent: true,
                      alphaTest: 0.5,
                    });

                    const mesh = new THREE.Mesh(geometry, material);
                    return mesh;
                  })();
                  object.add(targetPlaneMesh);

                  const shapeMesh = (() => {
                    const object = new THREE.Object3D();
                    object.position.y = 0.1;

                    const backgroundMesh = (() => {
                      const geometry = new THREE.PlaneBufferGeometry(0.18, 0.18)
                        .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
                      const material = new THREE.MeshPhongMaterial({
                        color: 0x808080,
                        shading: THREE.FlatShading,
                        side: THREE.DoubleSide,
                      });
                      return new THREE.Mesh(geometry, material);
                    })();
                    object.add(backgroundMesh);

                    const boxMesh = (() => {
                      const geometry = new THREE.BoxBufferGeometry(0.02, 0.02, 0.02)
                        .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
                      const material = _makeShapeMaterial({
                        color: 0xFF0000,
                      });
                      const mesh = new THREE.Mesh(geometry, material);
                      mesh.scale.copy(oneAndHalfVector);
                      mesh.shapeType = 'box';
                      return mesh;
                    })();
                    const rectangleMesh = (() => {
                      const geometry = new THREE.BoxBufferGeometry(0.02, 0.04, 0.02)
                        .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
                      const material = _makeShapeMaterial();
                      const mesh = new THREE.Mesh(geometry, material);
                      mesh.shapeType = 'rectangle';
                      return mesh;
                    })();
                    const triangularPyramidMesh = (() => {
                      const geometry = new THREE.CylinderBufferGeometry(0, sq(0.01), 0.02, 3, 1)
                        .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
                      const material = _makeShapeMaterial();
                      const mesh = new THREE.Mesh(geometry, material);
                      mesh.shapeType = 'triangularPyramid';
                      return mesh;
                    })();
                    const rectangularPyramidMesh = (() => {
                      const geometry = new THREE.CylinderBufferGeometry(0, sq(0.01), 0.02, 4, 1)
                        .applyMatrix(new THREE.Matrix4().makeRotationY(-Math.PI * (3 / 12)))
                        .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
                      const material = _makeShapeMaterial();
                      const mesh = new THREE.Mesh(geometry, material);
                      mesh.shapeType = 'rectangularPyramid';
                      return mesh;
                    })();
                    const planeMesh = (() => {
                      const geometry = new THREE.PlaneBufferGeometry(0.03, 0.03);
                        // .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
                        // .applyMatrix(new THREE.Matrix4().makeRotationZ(-Math.PI / 2));
                      const material = _makeShapeMaterial();
                      const mesh = new THREE.Mesh(geometry, material);
                      mesh.shapeType = 'plane';
                      return mesh;
                    })();
                    const sphereMesh = (() => {
                      const geometry = new THREE.SphereBufferGeometry(0.015, 8, 8)
                        .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
                      const material = _makeShapeMaterial();
                      const mesh = new THREE.Mesh(geometry, material);
                      mesh.shapeType = 'sphere';
                      return mesh;
                    })();
                    const cylinderMesh = (() => {
                      const geometry = new THREE.CylinderBufferGeometry(0.015, 0.015, 0.03, 8, 1)
                        .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
                      const material = _makeShapeMaterial();
                      const mesh = new THREE.Mesh(geometry, material);
                      mesh.shapeType = 'cylinder';
                      return mesh;
                    })();
                    const torusMesh = (() => {
                      const geometry = new THREE.TorusBufferGeometry(0.015, 0.02 / 4, 4, 8)
                        .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
                      const material = _makeShapeMaterial();
                      const mesh = new THREE.Mesh(geometry, material);
                      mesh.shapeType = 'torus';
                      return mesh;
                    })();
                    const shapeMeshes = [
                      boxMesh,
                      rectangleMesh,
                      triangularPyramidMesh,
                      rectangularPyramidMesh,
                      planeMesh,
                      sphereMesh,
                      cylinderMesh,
                      torusMesh,
                    ];

                    shapeMeshes.forEach((shapeMesh, index) => {
                      const x = index % shapesPerRow;
                      const y = Math.floor(index / shapesPerRow);
                      shapeMesh.position.x = -(shapesWidth / 2) + (shapeWidth / 2) + (x * (shapesWidth / shapesPerRow));
                      shapeMesh.position.y = shapeSize / 2;
                      shapeMesh.position.z = -(shapesHeight / 2) + (shapeHeight / 2) + (y * (shapesHeight / shapesPerCol));

                      object.add(shapeMesh);
                    });
                    object.shapeMeshes = shapeMeshes;

                    return object;
                  })();
                  object.add(shapeMesh);
                  object.shapeMesh = shapeMesh;

                  const colorMesh = (() => {
                    const object = new THREE.Object3D();
                    object.position.x = 0.1;
                    object.rotation.z = -Math.PI / 2;
                    object.rotation.order = camera.rotation.order;

                    const colorWheelMesh = (() => {
                      const size = 0.18;

                      const object = new THREE.Object3D();
                      object.size = size;

                      const planeMesh = (() => {
                        const geometry = new THREE.PlaneBufferGeometry(size, size)
                          .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));

                        const texture = new THREE.Texture(
                          colorWheelImg,
                          THREE.UVMapping,
                          THREE.ClampToEdgeWrapping,
                          THREE.ClampToEdgeWrapping,
                          THREE.NearestFilter,
                          THREE.NearestFilter,
                          THREE.RGBAFormat,
                          THREE.UnsignedByteType,
                          16
                        );
                        texture.needsUpdate = true;
                        const material = new THREE.MeshBasicMaterial({
                          color: 0xFFFFFF,
                          map: texture,
                          side: THREE.DoubleSide,
                        });

                        const mesh = new THREE.Mesh(geometry, material);
                        return mesh;
                      })();
                      object.add(planeMesh);

                      const notchMesh = (() => {
                        const geometry = new THREE.CylinderBufferGeometry(0, sq(0.004), 0.01, 4, 1)
                          .applyMatrix(new THREE.Matrix4().makeRotationY(-Math.PI * (3 / 12)))
                          .applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI));
                        const material = new THREE.MeshPhongMaterial({
                          color: 0xFF0000,
                          shading: THREE.FlatShading,
                        });

                        const mesh = new THREE.Mesh(geometry, material);
                        mesh.position.y = 0.01 / 2;
                        return mesh;
                      })();
                      object.add(notchMesh);
                      object.notchMesh = notchMesh;

                      return object;
                    })();
                    object.add(colorWheelMesh);
                    object.colorWheelMesh = colorWheelMesh;

                    return object;
                  })();
                  object.add(colorMesh);
                  object.colorMesh = colorMesh;

                  const rotateMesh = (() => {
                    const object = new THREE.Object3D();
                    object.position.y = -0.1;
                    object.rotation.x = -Math.PI / 2;
                    object.rotation.z = Math.PI;
                    object.rotation.order = camera.rotation.order;

                    const planeMesh = (() => {
                      const geometry = new THREE.PlaneBufferGeometry(0.18, 0.18);
                      const texture = new THREE.Texture(
                        rotateImg,
                        THREE.UVMapping,
                        THREE.ClampToEdgeWrapping,
                        THREE.ClampToEdgeWrapping,
                        THREE.NearestFilter,
                        THREE.NearestFilter,
                        THREE.RGBAFormat,
                        THREE.UnsignedByteType,
                        16
                      );
                      texture.needsUpdate = true;
                      const material = new THREE.MeshBasicMaterial({
                        color: 0xFFFFFF,
                        map: texture,
                        side: THREE.DoubleSide,
                        transparent: true,
                        alphaTest: 0.5,
                      });

                      const mesh = new THREE.Mesh(geometry, material);
                      return mesh;
                    })();
                    object.add(planeMesh);

                    return object;
                  })();
                  object.add(rotateMesh);
                  object.rotateMesh = rotateMesh;

                  const scaleMesh = (() => {
                    const object = new THREE.Object3D();
                    object.position.x = -0.1;
                    object.rotation.x = -Math.PI / 2;
                    object.rotation.z = Math.PI / 2;
                    object.rotation.order = 'ZYX';

                    const planeMesh = (() => {
                      const geometry = new THREE.PlaneBufferGeometry(0.18, 0.18);
                      const texture = new THREE.Texture(
                        resizeImg,
                        THREE.UVMapping,
                        THREE.ClampToEdgeWrapping,
                        THREE.ClampToEdgeWrapping,
                        THREE.NearestFilter,
                        THREE.NearestFilter,
                        THREE.RGBAFormat,
                        THREE.UnsignedByteType,
                        16
                      );
                      texture.needsUpdate = true;
                      const material = new THREE.MeshBasicMaterial({
                        color: 0xFFFFFF,
                        map: texture,
                        side: THREE.DoubleSide,
                        transparent: true,
                        alphaTest: 0.5,
                      });

                      const mesh = new THREE.Mesh(geometry, material);
                      return mesh;
                    })();
                    object.add(planeMesh);

                    return object;
                  })();
                  object.add(scaleMesh);
                  object.scaleMesh = scaleMesh;

                  return object;
                })();
                object.add(menuMesh);
                object.menuMesh = menuMesh;

                return object;
              })();
              entityObject.add(toolMesh);

              entityApi.align = () => {
                const {position} = entityApi;

                entityObject.position.set(position[0], position[1], position[2]);
                entityObject.quaternion.set(position[3], position[4], position[5], position[6]);
                entityObject.scale.set(position[7], position[8], position[9]);
              };

              entityApi.color = new THREE.Color(0x000000);
              entityApi.render = () => {
                if (mesh) {
                  const {color} = entityApi;
                  mesh.material.color.copy(color);
                };
              };

              let connection = null;
              const _ensureConnect = () => {
                const {file} = entityApi;

                if (file && !connection) {
                  const peerId = player.getId();
                  const {buildId} = entityApi;
                  connection = new AutoWs(_relativeWsUrl('archae/buildws?peerId=' + encodeURIComponent(peerId) + '&buildId=' + encodeURIComponent(buildId)));

                  let currentRemoteBuildSpec = null;
                  connection.on('message', msg => {
                    if (typeof msg.data === 'string') {
                      const e = JSON.parse(msg.data) ;
                      const {type} = e;

                      if (type === 'buildSpec') {
                        const {meshId} = e;
                        currentRemoteBuildSpec = {
                          meshId,
                        };
                      } else {
                        console.warn('unknown message type', JSON.stringify(type));
                      }
                    } else {
                      if (currentRemoteBuildSpec !== null) {
                        const {meshId} = currentRemoteBuildSpec;
                        const {data} = msg;

                        _loadMesh({meshId, data});
                      } else {
                        console.warn('buffer data before paint spec', msg);
                      }
                    }
                  });
                } else if (!file && connection) {
                  _clearMeshes();

                  SIDES.forEach(side => {
                    const buildState = buildStates[side];
                    buildState.building = false;
                  });

                  connection.destroy();
                  connection = null;
                }
              };
              entityApi.ensureConnect = _ensureConnect;

              const _makeBuildMesh = () => {
                const object = new THREE.Object3D();

                let mesh = null;
                object.setShape = shape => {
                  const {
                    menuMesh: {
                      shapeMesh: {
                        shapeMeshes,
                      },
                    },
                  } = toolMesh;
                  const shapeMesh = shapeMeshes.find(shapeMesh => shapeMesh.shapeType === shape);

                  const oldMesh = mesh;
                  if (oldMesh) {
                    object.remove(oldMesh);
                  }

                  const newMesh = shapeMesh.clone();
                  newMesh.position.copy(zeroVector);
                  newMesh.quaternion.copy(zeroQuaternion);
                  newMesh.scale.copy(oneVector);
                  object.add(newMwesh);

                  mesh = newMesh;
                };
                object.setRotation = rotation => {
                  mesh.quaternion.copy(rotation); // XXX this should be an array
                };
                object.setScaleValue = scaleValue => {
                  const scaleValueExp = Math.pow(2, scaleValue);
                  const scaleVector = oneVector.clone().multiplyScalar(scaleValueExp);
                  mesh.scale.copy(scaleVector);
                };
                object.setColor = color => {
                  mesh.material.color = new THREE.Color(color);
                };
                object.setTarget = target => {
                  switch (target) {
                    case 'tool': {
                      shapeMeshContainer.add(mesh);

                      break;
                    }
                    case 'scene': {
                      scene.add(mesh);

                      break;
                    }
                  }
                };

                return object;
              };

              let currentMeshId = null;
              let meshes = {};

              const _loadMesh = ({meshId, data}) => {
                let mesh = meshes[meshId];
                if (!mesh) {
                  mesh = _makeBuildMesh();
                  meshes[meshId] = mesh;
                }

                const j = (() => {
                  if (data instanceof ArrayBuffer) {
                    return _jsonParse(_arrayBufferToString(data));
                  } else if (data && typeof data === 'object') {
                    return data;
                  } else {
                    return undefined;
                  }
                })();

                const {shape, rotation, scaleValue, color, target} = data;
                mesh.setShape(shape);
                mesh.setRotation(rotation);
                mesh.setScaleValue(scaleValue);
                mesh.setColor(color);
                mesh.setTarget(target);

                return mesh;
              };
              const _clearMeshes = () => {
                for (const meshId in meshes) {
                  const mesh = meshes[meshId];
                  mesh.parent.remove(mesh);
                }
                meshes = {};
              };

              /* entityApi.load = () => {
                const {file} = entityApi;

                if (file) {
                  file.read({
                    type: 'model',
                  })
                    .then(newMeshesContainer => {
                      if (newMeshesContainer) {
                        const {children} = newMeshesContainer;

                        for (let i = 0; i < children.length; i++) {
                          const child = children[i];
                          meshesContainer.add(child);
                        }
                      }
                    });
                } else {
                  if (mesh) {
                    scene.remove(mesh);
                    mesh = null;
                  }

                  for (let i = 0; i < meshes.length; i++) {
                    const mesh = meshes[i];
                    scene.remove(mesh);
                  }
                  meshes.length = 0;

                  SIDES.forEach(side => {
                    const buildState = buildStates[side];
                    buildState.building = false;
                  });
                }
              };

              let dirtyFlag = false;
              entityApi.cancelSave = null;
              entityApi.save = () => {
                const {cancelSave} = entityApi;

                if (!cancelSave) {
                  const timeout = setTimeout(() => {
                    const {file} = entityApi;

                    const s = JSON.stringify(meshesContainer.toJSON(), null, 2);

                    const _cleanup = () => {
                      entityApi.cancelSave = null;

                      if (dirtyFlag) {
                        dirtyFlag = false;

                        entityApi.save();
                      }
                    };

                    file.write(s)
                      .then(() => {
                        if (live) {
                          const broadcastEvent = new CustomEvent('broadcast', { // XXX support multiplayer here
                            detail: {
                              type: 'build.update',
                              id: entityElement.getId(),
                            },
                          });
                          worldElement.dispatchEvent(broadcastEvent);

                          _cleanup();
                        }
                      })
                      .catch(err => {
                        console.warn(err);

                        _cleanup();
                      });

                    entityApi.cancelSave = () => {
                      live = false;
                    };

                    dirtyFlag = false;
                  }, DIRTY_TIME);

                  entityApi.cancelSave = () => {
                    cancelTimeout(timeout);
                  };
                }
              }; */

              const _makeBuildState = () => ({
                grabbed: false,
                building: false,
                touchStart: null,
                touchCurrent: null,
                pressStart: null,
                pressCurrent: null,
                menu: 'shape',
                angle: 0,
                shape: 'box',
                rotation: new THREE.Quaternion(),
                scaleValue: 0,
                color: '',
              });
              const buildStates = {
                left: _makeBuildState(),
                right: _makeBuildState(),
              };

              const _grab = e => {
                const {detail: {side}} = e;
                const buildState = buildStates[side];

                buildState.grabbed = true;
              };
              entityElement.addEventListener('grab', _grab);
              const _release = e => {
                const {detail: {side}} = e;
                const buildState = buildStates[side];

                buildState.grabbed = false;
                buildState.building = false;
              };
              entityElement.addEventListener('release', _release);
              const _triggerdown = e => {
                const {side} = e;
                const {file} = entityApi;

                if (file) {
                  const buildState = buildStates[side];
                  const {grabbed} = buildState;

                  if (grabbed) {
                    buildState.building = true;

                    const {shape, rotation, scaleValue} = buildState;
                    const {color} = entityApi;

                    currentMeshId = _makeId();
                    const mesh = _loadMesh({
                      meshId: currentMeshId,
                      data: {
                        shape,
                        rotation: rotation.toArray(),
                        scaleValue,
                        color,
                        target: 'tool',
                      },
                    });
                  }
                }
              };
              input.on('triggerdown', _triggerdown);
              const _triggerup = e => {
                const {side} = e;
                const {file} = entityApi;

                if (file) {
                  const buildState = buildStates[side];
                  const {grabbed} = buildState;

                  if (grabbed) {
                    buildState.building = false;

                    const mesh = meshes[currentMeshId];
                    const {position, rotation, scale} = _decomposeObjectMatrixWorld(mesh);
                    mesh.position.copy(position);
                    mesh.quaternion.copy(rotation);
                    mesh.scale.copy(scale);

                    currentMeshId = null;

                    // XXX broadcast update here

                    // entityApi.save();
                  }
                }
              };
              input.on('triggerup', _triggerup);
              const _paddown = e => {
                const {side} = e;
                const buildState = buildStates[side];
                const {grabbed} = buildState;

                if (grabbed) {
                  const {gamepads} = pose.getStatus();
                  const gamepad = gamepads[side];
                  const {axes} = gamepad;
                  buildState.pressStart = new THREE.Vector2().fromArray(axes);
                  buildState.touchStart = null;

                  const {menuMesh} = toolMesh;
                  const {angle} = buildState;
                  menuMesh.rotation.z = angle;

                  e.stopImmediatePropagation();
                }
              };
              input.on('paddown', _paddown, {
                priority: 1,
              });
              const _padup = e => {
                const {side} = e;
                const buildState = buildStates[side];
                const {grabbed} = buildState;

                if (grabbed) {
                  const {menu} = buildState;

                  if (menu === 'color') {
                    const {color} = buildState;
                    entityElement.setAttribute('color', JSON.stringify('#' + color.toString(16)));
                  } else if (menu === 'rotate') {
                    const {pressStart, pressCurrent, rotation} = buildState;
                    const pressDiff = pressCurrent.clone().sub(pressStart);
                    const xAngle = _padDiffToAngle(pressDiff.x);
                    const yAngle = _padDiffToAngle(-pressDiff.y);

                    rotation.premultiply(
                      new THREE.Quaternion().setFromEuler(new THREE.Euler(yAngle, 0, xAngle, camera.rotation.order))
                    );
                  } else if (menu === 'resize') {
                    const {pressStart, pressCurrent, scaleValue} = buildState;
                    const pressDiff = pressCurrent.clone().sub(pressStart);
                    const yValue = pressDiff.y;

                    buildState.scaleValue = scaleValue + yValue;
                  }

                  buildState.pressStart = null;
                  buildState.pressCurrent = null;

                  e.stopImmediatePropagation();
                }
              };
              input.on('padup', _padup, {
                priority: 1,
              });

              const menuRotationSpecs = [
                {
                  menu: 'shape',
                  angle: 0,
                },
                {
                  menu: 'color',
                  angle: Math.PI / 2,
                },
                {
                  menu: 'rotate',
                  angle: Math.PI,
                },
                {
                  menu: 'resize',
                  angle: Math.PI / 2 * 3,
                },
              ];
              const _padDiffToAngle = v => (v / 2) * Math.PI;
              const _angleDiff = (a, b) => {
                let diff = b - a;
                diff = mod(diff + Math.PI, Math.PI * 2) - Math.PI;
                return Math.abs(diff);
              };
              const _update = () => {
                const {gamepads} = pose.getStatus();

                SIDES.forEach(side => {
                  const gamepad = gamepads[side];

                  if (gamepad) {
                    const buildState = buildStates[side];
                    const {grabbed} = buildState;

                    if (grabbed) {
                      const {buttons: {pad: {touched: padTouched}}} = gamepad;
                      const {touchStart, pressStart} = buildState;

                      if (!pressStart) {
                        if (padTouched && !touchStart) {
                          const {axes} = gamepad;
                          buildState.touchStart = new THREE.Vector2().fromArray(axes);
                          buildState.touchCurrent = buildState.touchStart.clone();
                        } else if (!padTouched && touchStart) {
                          const {touchCurrent, angle: startAngle} = buildState;
                          const touchDiff = touchCurrent.clone().sub(touchStart);

                          const menuRotationDistanceSpecs = menuRotationSpecs.map(menuRotationSpec => {
                            const {menu, angle} = menuRotationSpec;
                            const distance = _angleDiff(startAngle + _padDiffToAngle(-touchDiff.x), angle);

                            return {
                              menu,
                              angle,
                              distance,
                            };
                          });
                          const closestMenuRotationSpec = menuRotationDistanceSpecs.sort((a, b) => a.distance - b.distance)[0];

                          buildState.touchStart = null;
                          buildState.menu = closestMenuRotationSpec.menu;
                          buildState.angle = closestMenuRotationSpec.angle;

                          const {menuMesh} = toolMesh;
                          menuMesh.rotation.z = buildState.angle;
                        } else if (padTouched && touchStart) {
                          const {axes} = gamepad;
                          const touchCurrent = new THREE.Vector2().fromArray(axes);
                          buildState.touchCurrent = touchCurrent;

                          const {menuMesh} = toolMesh;
                          const {angle: startAngle} = buildState;
                          const touchDiff = touchCurrent.clone().sub(touchStart);
                          menuMesh.rotation.z = startAngle + _padDiffToAngle(-touchDiff.x);
                        }
                      }

                      const {menu} = buildState;
                      if (menu === 'shape') {
                        const {pressStart} = buildState;

                        if (pressStart) {
                          const {axes} = gamepad;

                          const x = Math.round(((((axes[0] / 2) + 0.5) * shapesWidth) - (shapeWidth / 2)) / shapeWidth);
                          const y = Math.round((((-(axes[1] / 2) + 0.5) * shapesHeight) - (shapeHeight / 2)) / shapeHeight);
                          const shapeIndex = (y * shapesPerRow) + x;

                          const {
                            menuMesh: {
                              shapeMesh: {
                                shapeMeshes,
                              },
                            },
                          } = toolMesh;
                          for (let i = 0; i < shapeMeshes.length; i++) {
                            const shapeMesh = shapeMeshes[i];
                            const selected = i !== shapeIndex;
                            shapeMesh.scale.copy(selected ? oneVector : oneAndHalfVector);
                            shapeMesh.material.color.setHex(selected ? 0x808080 : 0xFF0000);
                          }

                          const shapeMesh = shapeMeshes[shapeIndex];
                          const {shapeType} = shapeMesh;
                          buildState.shape = shapeType;
                        }
                      } else if (menu === 'color') {
                        const gamepad = gamepads[side];

                        if (gamepad) {
                          const {pressStart} = buildState;

                          if (pressStart) {
                            const {menuMesh} = toolMesh;
                            const {colorMesh} = menuMesh;
                            const {colorWheelMesh} = colorMesh;
                            const {size, notchMesh} = colorWheelMesh;
                            const {axes} = gamepad;

                            notchMesh.position.x = -(size / 2) + (((axes[0] / 2) + 0.5) * size);
                            notchMesh.position.z = (size / 2) - (((axes[1] / 2) + 0.5) * size);

                            const colorHex = colorWheelImg.getColor((axes[0] / 2) + 0.5, (-axes[1] / 2) + 0.5);
                            buildState.color = colorHex;

                            notchMesh.material.color.setHex(colorHex);
                          }
                        }
                      } else if (menu === 'rotate') {
                        const {pressStart} = buildState;

                        if (pressStart) {
                          const {axes} = gamepad;
                          const pressCurrent = new THREE.Vector2().fromArray(axes);
                          buildState.pressCurrent = pressCurrent;

                          if (mesh) {
                            const pressDiff = pressCurrent.clone().sub(pressStart);
                            const xAngle = _padDiffToAngle(-pressDiff.x);
                            const yAngle = _padDiffToAngle(-pressDiff.y);

                            const {rotation} = buildState;
                            const newRotation = rotation.clone().premultiply(
                              new THREE.Quaternion().setFromEuler(new THREE.Euler(yAngle, 0, xAngle, camera.rotation.order))
                            );
                            mesh.quaternion.copy(newRotation);
                          }
                        }
                      } else if (menu === 'resize') {
                        const {pressStart} = buildState;

                        if (pressStart) {
                          const {axes} = gamepad;
                          const pressCurrent = new THREE.Vector2().fromArray(axes);
                          buildState.pressCurrent = pressCurrent;

                          if (mesh) {
                            const pressDiff = pressCurrent.clone().sub(pressStart);
                            const yValue = pressDiff.y;

                            const {scaleValue} = buildState;
                            const newScaleValue = scaleValue + yValue;
                            const newScaleValueExp = Math.pow(2, newScaleValue);
                            const newScaleVector = oneVector.clone().multiplyScalar(newScaleValueExp);
                            mesh.scale.copy(newScaleVector);
                          }
                        }
                      }
                    }
                  }
                });
              };
              render.on('update', _update);

              entityApi._cleanup = () => {
                entityObject.remove(toolMesh);

                for (const meshId in meshes) {
                  const mesh = meshes[meshId];
                  scene.remove(mesh);
                }

                const {cancelSave} = entityApi;
                if (cancelSave) {
                  cancelSave();
                }

                entityElement.removeEventListener('grab', _grab);
                entityElement.removeEventListener('release', _release);

                input.removeListener('triggerdown', _triggerdown);
                input.removeListener('triggerup', _triggerup);
                input.removeListener('paddown', _paddown);
                input.removeListener('padup', _padup);

                render.removeListener('update', _update);
              };
            },
            entityRemovedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();
              entityApi._cleanup();
            },
            entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
              const entityApi = entityElement.getComponentApi();

              switch (name) {
                case 'position': {
                  entityApi.position = newValue;

                  entityApi.align();

                  break;
                }
                case 'file': {
                  entityApi.file = newValue;

                  /* entityApi.load();

                  if (!newValue) {
                    const {cancelSave} = entityApi;

                    if (cancelSave) {
                      cancelSave();
                      entityApi.cancelSave = null;
                    }
                  } */

                  break;
                }
                case 'color': {
                  entityApi.color = new THREE.Color(newValue);

                  entityApi.render();

                  break;
                }
              }
            },
          };
          elements.registerComponent(this, buildComponent);

          this._cleanup = () => {
            elements.unregisterComponent(this, buildComponent);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

const _relativeWsUrl = s => {
  const l = window.location;
  return ((l.protocol === 'https:') ? 'wss://' : 'ws://') + l.host + l.pathname + (!/\/$/.test(l.pathname) ? '/' : '') + s;
};
const sq = n => Math.sqrt((n * n) + (n * n));
const _arrayBufferToString = b => String.fromCharCode.apply(null, new Uint16Array(b));
/* const _stringToArrayBuffer = str => {
  var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
  var bufView = new Uint16Array(buf);
  for (var i=0, strLen=str.length; i<strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}; */
const _concatArrayBuffers = as => {
  let length = 0;
  for (let i = 0; i < as.length; i++) {
    const e = as[i];
    length += e.length;
  }

  const result = new Uint8Array(length);
  let index = 0;
  for (let i = 0; i < as.length; i++) {
    const e = as[i];
    result.set(e, index);
    index += e.length;
  }
  return result;
};

module.exports = ZBuild;
