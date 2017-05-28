const DIRTY_TIME = 1000;
const DEFAULT_MATRIX = [
  0, 0, -2,
  0, 0, 0, 1,
  1, 1, 1,
];

const SIDES = ['left', 'right'];

class ZBuild {
  mount() {
    const {three: {THREE, scene, camera}, elements, input, pose, render, player, transform, utils: {network: networkUtils, geometry: geometryUtils, menu: menuUtils}} = zeo;
    const {AutoWs} = networkUtils;

    const targetPlaneImg = menuUtils.getTargetPlaneImg();
    const colorWheelImg = menuUtils.getColorWheelImg();

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
    const shapeSize = 0.02;
    const shapeScaleVector = new THREE.Vector3(shapeSize, shapeSize, shapeSize);
    const selectedShapeScaleVector = shapeScaleVector.clone().multiplyScalar(1.5);
    const controllerForwardVector = new THREE.Vector3(0, 0, -15);

    class ShapeControl {
      constructor(object) {
        this.object = object;

        this._enabled = false;
        this._boundingBox = new THREE.Box3();
        const transformGizmo = transform.makeTransformGizmo({
          onpreview: (position, rotation, scale) => {
            this.updateBoundingBox(position, rotation, scale);
          },
          onupdate: (position, rotation, scale) => {
            this.update(position, rotation, scale);
          },
        });
        scene.add(transformGizmo);
        this._transformGizmo = transformGizmo;
      }

      isEnabled() {
        return this._enabled;
      }

      enable() {
        this._enabled = true;
      }

      disable() {
        this._enabled = false;
      }

      checkIntersection(controllerLine) {
        return controllerLine.intersectBox(this._boundingBox);
      }

      setVisibility(visible) {
        if (visible && !this._transformGizmo.visible) {
          this._transformGizmo.visible = true;
        } else if (!visible && this._transformGizmo.visible) {
          this._transformGizmo.visible = false;
        }
      }

      updateObject(position, rotation, scale) {
        this.object.position.copy(position);
        this.object.quaternion.copy(rotation);
        this.object.scale.copy(scale);
      }

      updateBoundingBox(position, rotation, scale) {
        const scalePosition = scale.clone().multiplyScalar(this._transformGizmo.scaleGizmo.scaleFactor);
        const sizeFactor = Math.max(scalePosition.x, scalePosition.y, scalePosition.z, 1) * 2 * 1.1;
        const size = new THREE.Vector3(sizeFactor, sizeFactor, sizeFactor);

        this._boundingBox.setFromCenterAndSize(position, size);
      }

      updateTransformGizmo(position, rotation, scale) {
        const scalePosition = scale.clone().multiplyScalar(this._transformGizmo.scaleGizmo.scaleFactor);

        this._transformGizmo.position.copy(position);
        this._transformGizmo.rotateGizmo.quaternion.copy(rotation);
        this._transformGizmo.scaleGizmo.position.copy(scalePosition);
        this._transformGizmo.updateBoxTargets();
      }

      update(position, rotation, scale) {
        this.updateObject(position, rotation, scale);
        this.updateBoundingBox(position, rotation, scale);
        this.updateTransformGizmo(position, rotation, scale);
      }

      destroy() {
        scene.remove(this._transformGizmo);
        transform.destroyTransformGizmo(this._transformGizmo);
      }
    }
    const shapeControls = [];

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
        const toolMesh = (() => {
          const object = new THREE.Object3D();

          const coreMesh = (() => {
            const geometry = (() => {
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
                const geometry = new THREE.BoxBufferGeometry(1, 1, 1)
                  .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
                const material = _makeShapeMaterial({
                  color: 0xFF0000,
                });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.scale.copy(selectedShapeScaleVector);
                mesh.shapeType = 'box';
                return mesh;
              })();
              const rectangleMesh = (() => {
                const geometry = new THREE.BoxBufferGeometry(1, 2, 1)
                  .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
                const material = _makeShapeMaterial();
                const mesh = new THREE.Mesh(geometry, material);
                mesh.scale.copy(shapeScaleVector);
                mesh.shapeType = 'rectangle';
                return mesh;
              })();
              const triangularPyramidMesh = (() => {
                const geometry = new THREE.CylinderBufferGeometry(0, sq(0.5), 1, 3, 1)
                  .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
                const material = _makeShapeMaterial();
                const mesh = new THREE.Mesh(geometry, material);
                mesh.scale.copy(shapeScaleVector);
                mesh.shapeType = 'triangularPyramid';
                return mesh;
              })();
              const rectangularPyramidMesh = (() => {
                const geometry = new THREE.CylinderBufferGeometry(0, sq(0.5), 1, 4, 1)
                  .applyMatrix(new THREE.Matrix4().makeRotationY(-Math.PI * (3 / 12)))
                  .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
                const material = _makeShapeMaterial();
                const mesh = new THREE.Mesh(geometry, material);
                mesh.scale.copy(shapeScaleVector);
                mesh.shapeType = 'rectangularPyramid';
                return mesh;
              })();
              const planeMesh = (() => {
                const geometry = new THREE.PlaneBufferGeometry(1.5, 1.5);
                  // .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
                  // .applyMatrix(new THREE.Matrix4().makeRotationZ(-Math.PI / 2));
                const material = _makeShapeMaterial();
                const mesh = new THREE.Mesh(geometry, material);
                mesh.scale.copy(shapeScaleVector);
                mesh.shapeType = 'plane';
                return mesh;
              })();
              const sphereMesh = (() => {
                const geometry = new THREE.SphereBufferGeometry(0.75, 8, 8)
                  .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
                const material = _makeShapeMaterial();
                const mesh = new THREE.Mesh(geometry, material);
                mesh.scale.copy(shapeScaleVector);
                mesh.shapeType = 'sphere';
                return mesh;
              })();
              const cylinderMesh = (() => {
                const geometry = new THREE.CylinderBufferGeometry(0.75, 0.75, 1.5, 8, 1)
                  .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
                const material = _makeShapeMaterial();
                const mesh = new THREE.Mesh(geometry, material);
                mesh.scale.copy(shapeScaleVector);
                mesh.shapeType = 'cylinder';
                return mesh;
              })();
              const torusMesh = (() => {
                const geometry = new THREE.TorusBufferGeometry(0.75, 0.25, 4, 8)
                  .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
                const material = _makeShapeMaterial();
                const mesh = new THREE.Mesh(geometry, material);
                mesh.scale.copy(shapeScaleVector);
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
              object.position.y = -0.1;
              object.rotation.z = Math.PI;
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
                  const geometry = new THREE.TorusBufferGeometry(size / 20, size / 80, 3, 8)
                    .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
                  const material = new THREE.MeshPhongMaterial({
                    color: 0xFFFFFF,
                    shading: THREE.FlatShading,
                    transparent: true,
                    opacity: 0.5,
                  });

                  const mesh = new THREE.Mesh(geometry, material);
                  // mesh.position.y = 0.01 / 2;
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

        entityApi.color = null;
        entityApi.setColor = color => {
          entityApi.color = color;

          if (currentMeshId) {
            const mesh = meshes[currentMeshId];
            mesh.setColor(color);

            _broadcastUpdate({
              meshId: currentMeshId,
              data: mesh.getJson(),
            });
          }
        };

        let connection = null;
        const _ensureConnect = () => {
          const {file} = entityApi;

          if (file && !connection) {
            const peerId = player.getId();
            const {buildId} = entityApi;
            connection = new AutoWs(_relativeWsUrl('archae/buildWs?peerId=' + encodeURIComponent(peerId) + '&buildId=' + encodeURIComponent(buildId)));

            connection.on('message', msg => {
              if (typeof msg.data === 'string') {
                const e = JSON.parse(msg.data) ;
                const {type} = e;

                if (type === 'buildSpec') {
                  const {meshId, data} = e;

                  _loadMesh({meshId, data});
                } else if (type === 'clear') {
                  _clearMeshes();
                } else {
                  console.warn('build unknown message type', JSON.stringify(type));
                }
              } else {
                console.warn('build got non-string message', msg);
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

        const _broadcastUpdate = ({meshId, data}) => {
          const e = {
            type: 'buildSpec',
            meshId: meshId,
            data: data,
          };
          const es = JSON.stringify(e);

          connection.send(es);
        };
        const _broadcastClear = () => {
          const e = {
            type: 'clear',
          };
          const es = JSON.stringify(e);

          connection.send(es);
        };

        const _makeBuildMesh = () => {
          let mesh = null;
          const state = {
            shape: null,
            matrix: null,
            color: null,
            target: null,
          };

          const object = new THREE.Object3D();
          object.setShape = shape => {
            if (shape !== state.shape) {
              state.shape = shape;

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
              object.add(newMesh);

              mesh = newMesh;
            }
          };
          object.setMatrix = matrix => {
            if (!_arrayEquals(matrix, state.matrix)) {
              state.matrix = matrix;

              object.position.set(matrix[0], matrix[1], matrix[2]);
              object.quaternion.set(matrix[3], matrix[4], matrix[5], matrix[6]);
              object.scale.set(matrix[7], matrix[8], matrix[9]);
            }
          };
          object.setColor = color => {
            if (color !== state.color) {
              state.color = color;

              mesh.material.color = new THREE.Color(color);
            }
          };
          object.setTarget = target => {
            if (target !== state.target) {
              state.target = target;

              switch (target) {
                case 'tool': {
                  const {shapeMeshContainer} = toolMesh;
                  shapeMeshContainer.add(object);

                  shapeControl.disable();

                  break;
                }
                case 'scene': {
                  scene.add(object);

                  shapeControl.enable();
                  const {position, quaternion: rotation, scale} = object;
                  shapeControl.updateBoundingBox(position.clone(), rotation.clone(), scale.clone());
                  shapeControl.updateTransformGizmo(position.clone(), rotation.clone(), scale.clone());

                  break;
                }
             }
            }
          };
          object.getJson = () => state;
          object.destroy = () => {
            const {target} = state;

            shapeControls.splice(shapeControls.indexOf(shapeControl), 1);
          };

          const shapeControl = new ShapeControl(object);
          shapeControls.push(shapeControl);

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

          const {shape, matrix, scaleValue, color, target} = data;
          mesh.setShape(shape);
          mesh.setMatrix(matrix);
          mesh.setColor(color);
          mesh.setTarget(target);

          return mesh;
        };
        const _clearMeshes = () => {
          for (const meshId in meshes) {
            const mesh = meshes[meshId];
            mesh.parent.remove(mesh);
            mesh.destroy();
          }
          meshes = {};
        };

        const _makeBuildState = () => ({
          grabbed: false,
          building: false,
          pressStart: null,
          pressCurrent: null,
          menu: 'shape',
          shape: 'box',
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

              const {shape} = buildState;
              const {color} = entityApi;

              currentMeshId = _makeId();

              const meshId = currentMeshId;
              const data = {
                shape,
                matrix: DEFAULT_MATRIX,
                color,
                target: 'tool',
              };
              _loadMesh({
                meshId: meshId,
                data: data,
              });
              _broadcastUpdate({
                meshId: meshId,
                data: data,
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
              mesh.setMatrix(position.toArray().concat(rotation.toArray()).concat(scale.toArray()));
              mesh.setTarget('scene');

              _broadcastUpdate({
                meshId: currentMeshId,
                data: mesh.getJson(),
              });

              currentMeshId = null;
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
            }

            buildState.pressStart = null;
            buildState.pressCurrent = null;

            e.stopImmediatePropagation();
          }
        };
        input.on('padup', _padup, {
          priority: 1,
        });
        const _menu = () => {
          _clearMeshes();

          _broadcastClear();
        };
        input.on('menu', _menu);

        const menuRotationSpecs = [
          {
            menu: 'shape',
            // angle: 0,
          },
          {
            menu: 'color',
            // angle: Math.PI / 2,
          },
        ];
        const _update = () => {
          const _updateGrabs = () => {
            const {gamepads} = pose.getStatus();

            SIDES.forEach(side => {
              const gamepad = gamepads[side];

              if (gamepad) {
                const buildState = buildStates[side];
                const {grabbed} = buildState;

                if (grabbed) {
                  const {pressStart} = buildState;

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
                        shapeMesh.scale.copy(selected ? shapeScaleVector : selectedShapeScaleVector);
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
                  }
                }
              }
            });
          };
          const _updateShapeControls = () => {
            if (shapeControls.length > 0) {
              const {gamepads} = pose.getStatus();
              const _getControllerLine = gamepad => {
                const {worldPosition: controllerPosition, worldRotation: controllerRotation} = gamepad;
                const controllerLine = new THREE.Ray(controllerPosition, controllerForwardVector.clone().applyQuaternion(controllerRotation));
                return controllerLine;
              };
              const controllerLines = {
                left: _getControllerLine(gamepads.left),
                right: _getControllerLine(gamepads.right),
              };

              for (let i = 0; i < shapeControls.length; i++) {
                const shapeControl = shapeControls[i];

                if (shapeControl.isEnabled()) {
                  const intersected = SIDES.some(side => shapeControl.checkIntersection(controllerLines[side]));
                  shapeControl.setVisibility(intersected);
                } else {
                  shapeControl.setVisibility(false);
                }
              }
            }
          };

          _updateGrabs();
          _updateShapeControls();
        };
        render.on('update', _update);

        entityApi._cleanup = () => {
          entityObject.remove(toolMesh);

          for (const meshId in meshes) {
            const mesh = meshes[meshId];
            mesh.parent.remove(mesh);
          }

          entityElement.removeEventListener('grab', _grab);
          entityElement.removeEventListener('release', _release);

          input.removeListener('triggerdown', _triggerdown);
          input.removeListener('triggerup', _triggerup);
          input.removeListener('paddown', _paddown);
          input.removeListener('padup', _padup);
          input.removeListener('menu', _menu);

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
          case 'build-id': {
            entityApi.buildId = newValue;

            break;
          }
          case 'file': {
            entityApi.file = newValue;

            entityApi.ensureConnect();

            break;
          }
          case 'color': {
            entityApi.setColor(newValue);

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

  unmount() {
    this._cleanup();
  }
}

const _relativeWsUrl = s => {
  const l = window.location;
  return ((l.protocol === 'https:') ? 'wss://' : 'ws://') + l.host + l.pathname + (!/\/$/.test(l.pathname) ? '/' : '') + s;
};
const _makeId = () => Math.random().toString(36).substring(7);
const sq = n => Math.sqrt((n * n) + (n * n));
const _arrayEquals = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((ae, i) => b[i] === ae);

module.exports = ZBuild;
