const SIDES = ['left', 'right'];
const SIZE = 0.2;

class Color {
  mount() {
    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/three',
      '/core/engines/input',
      '/core/engines/webvr',
      '/core/engines/biolumi',
      '/core/engines/keyboard',
      '/core/engines/rend',
      '/core/utils/geometry-utils',
      '/core/utils/menu-utils',
    ])
      .then(([
        three,
        input,
        webvr,
        biolumi,
        keyboard,
        rend,
        geometryUtils,
        menuUtils,
      ]) => {
        if (live) {
          const {THREE, scene, camera} = three;

          const targetPlaneImg = menuUtils.getTargetPlaneImg();
          const colorWheelImg = menuUtils.getColorWheelImg();
          const colorBarImg = menuUtils.getColorBarImg();

          const notchMaterial = new THREE.MeshPhongMaterial({
            color: 0xFFFFFF,
            shading: THREE.FlatShading,
          });

          const _makeDragState = () => ({
            src: null,
          });
          const dragStates = {
            left: _makeDragState(),
            right: _makeDragState(),
          };

          const colorWheels = [];
          rend.registerAuxObject('colorWheels', colorWheels);

          const _makeColorWheel = () => {
            const object = new THREE.Object3D();
            const colorId = _makeId();
            object.colorId = colorId;

            const colorWheelMesh = (() => {
              const object = new THREE.Object3D();

              const planeMesh = (() => {
                const geometry = new THREE.PlaneBufferGeometry(SIZE, SIZE)
                  // .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
                  .applyMatrix(new THREE.Matrix4().makeTranslation(-SIZE / 10 / 2, 0, 0));

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
                const geometry = new THREE.TorusBufferGeometry(SIZE / 15, SIZE / 50, 3, 8)
                  // .applyMatrix(new THREE.Matrix4().makeRotationY(-Math.PI * (3 / 12)))
                  // .applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI));
                const material = notchMaterial;

                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(-SIZE / 10 / 2, 0, 0);
                return mesh;
              })();
              object.add(notchMesh);
              object.notchMesh = notchMesh;

              return object;
            })();
            object.add(colorWheelMesh);
            object.colorWheelMesh = colorWheelMesh;

            const colorBarMesh = (() => {
              const object = new THREE.Object3D();

              const planeMesh = (() => {
                const geometry = new THREE.PlaneBufferGeometry(SIZE / 10, SIZE)
                  // .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
                  .applyMatrix(new THREE.Matrix4().makeTranslation(SIZE / 2, 0, 0));

                const texture = new THREE.Texture(
                  colorBarImg,
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
                const geometry = new THREE.BoxBufferGeometry(SIZE / 10, SIZE / 40, SIZE / 40)
                  // .applyMatrix(new THREE.Matrix4().makeRotationY(-Math.PI * (3 / 12)))
                  // .applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI));
                  // .applyMatrix(new THREE.Matrix4().makeTranslation(-SIZE / 10 / 2, 0, 0));
                const material = notchMaterial;

                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(SIZE / 2, 0, 0);
                return mesh;
              })();
              object.add(notchMesh);
              object.notchMesh = notchMesh;

              return object;
            })();
            object.add(colorBarMesh);
            object.colorBarMesh = colorBarMesh;

            let boxAnchors = null;
            const _removeBoxTargets = () => {
              if (boxAnchors) {
                for (let i = 0; i < boxAnchors.length; i++) {
                  const boxAnchor = boxAnchors[i];
                  rend.removeBoxAnchor(boxAnchor);
                }
                boxAnchors = null;
              }
            };
            object.removeBoxTargets = _removeBoxTargets;
            const _updateBoxTargets = () => {
              _removeBoxTargets();

              boxAnchors = [
                {
                  boxTarget: geometryUtils.makeBoxTarget(
                    object.position.clone().add(new THREE.Vector3(-SIZE / 10 / 2, 0, 0).applyQuaternion(object.quaternion)),
                    object.quaternion.clone(),
                    new THREE.Vector3(1, 1, 1),
                    new THREE.Vector3(SIZE, SIZE, SIZE / 20)
                  ),
                  anchor: {
                    onmousedown: `color:${colorId}:wheel`,
                  },
                },
                {
                  boxTarget: geometryUtils.makeBoxTarget(
                    object.position.clone().add(new THREE.Vector3(SIZE / 2, 0, 0).applyQuaternion(object.quaternion)),
                    object.quaternion.clone(),
                    new THREE.Vector3(1, 1, 1),
                    new THREE.Vector3(SIZE / 10, SIZE, SIZE / 20)
                  ),
                  anchor: {
                    onmousedown: `color:${colorId}:bar`,
                  },
                },
              ];
              for (let i = 0; i < boxAnchors.length; i++) {
                const boxAnchor = boxAnchors[i];
                rend.addBoxAnchor(boxAnchor);
              }
            };
            object.updateBoxTargets = _updateBoxTargets;

            return object;
          };
          const _destroyColorWheel = colorWheel => {
            colorWheel.removeBoxTargets();

            colorWheels.splice(colorWheels.indexOf(colorWheel), 1);
          };

          const _triggerdown = e => {
            const {side} = e;

            const _doClickTransformGizmo = () => {
              const hoverState = rend.getHoverState(side);
              const {intersectionPoint} = hoverState;

              if (intersectionPoint) {
                const {anchor} = hoverState;
                const onmousedown = (anchor && anchor.onmousedown) || '';

                let match;
                if (match = onmousedown.match(/^color:([^:]+):(wheel|bar)$/)) {
                  const colorId = match[1];
                  const mode = match[2];

                  const dragState = dragStates[side];
                  const {gamepads} = webvr.getStatus();
                  const gamepad = gamepads[side];
                  const {worldPosition: controllerPosition, worldRotation: controllerRotation} = gamepad;
                  const colorWheel = colorWheels.find(colorWheel => colorWheel.colorId === colorId);
                  dragState.src = {
                    colorId: colorId,
                    mode: mode,
                    startControllerPosition: controllerPosition.clone(),
                    startControllerRotation: controllerRotation.clone(),
                    startIntersectionPoint: intersectionPoint.clone(),
                    startPosition: colorWheel.position.clone(),
                  };

                  colorWheel.removeBoxTargets();

                  return true;
                } else {
                  return false;
                }
              } else {
                return false;
              }
            };

            if (_doClickTransformGizmo()) {
              e.stopImmediatePropagation();
            }
          };
          input.on('triggerdown', _triggerdown);
          const _triggerup = e => {
            const {side} = e;
            const dragState = dragStates[side];
            const {src} = dragState;

            if (src) {
              const {colorId} = src;
              const colorWheel = colorWheels.find(colorWheel => colorWheel.colorId === colorId);

              const {position, rotation, scale} = colorWheel.getProperties();
              colorWheel.onupdate(
                position,
                rotation,
                scale
              );

              colorWheel.updateBoxTargets();

              dragState.src = null;
            }
          };
          input.on('triggerup', _triggerup);
          const _update = () => {
            if (rend.isOpen()) {
              SIDES.forEach(side => {
                const dragState = dragStates[side];
                const {src} = dragState;
                const {gamepads} = webvr.getStatus();
                const gamepad = gamepads[side];

                if (src) {
                  const {colorId, mode, startControllerPosition, startControllerRotation, startIntersectionPoint, startPosition} = src;
                  const colorWheel = colorWheels.find(colorWheel => colorWheel.colorId === colorId);

                  const _preview = () => {
                    const {position, rotation, scale} = colorWheel.getProperties();
                    colorWheel.onpreview(position, rotation, scale);
                  };

                  if (mode === 'wheel') {
                    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), startIntersectionPoint);
                    const {worldPosition: controllerPosition, worldRotation: controllerRotation, worldScale: controllerScale} = gamepad;
                    const controllerLine = geometryUtils.makeControllerLine(controllerPosition, controllerRotation, controllerScale);
                    const controllerIntersectionPoint = plane.intersectLine(controllerLine);

                    if (controllerIntersectionPoint) {
                      const endIntersectionPoint = new THREE.Vector3(
                        controllerIntersectionPoint.x,
                        startIntersectionPoint.y,
                        startIntersectionPoint.z
                      );
                      const positionDiff = endIntersectionPoint.clone().sub(startIntersectionPoint);
                      const endPosition = startPosition.clone().add(positionDiff);
                      colorWheel.position.copy(endPosition);

                      _preview();
                    }
                  } else if (mode === 'bar') {
                    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), startIntersectionPoint);
                    const {worldPosition: controllerPosition, worldRotation: controllerRotation, worldScale: controllerScale} = gamepad;
                    const controllerLine = geometryUtils.makeControllerLine(controllerPosition, controllerRotation, controllerScale);
                    const controllerIntersectionPoint = plane.intersectLine(controllerLine);

                    if (controllerIntersectionPoint) {
                      const endIntersectionPoint = new THREE.Vector3(
                        controllerIntersectionPoint.x,
                        startIntersectionPoint.y,
                        startIntersectionPoint.z
                      );
                      const positionDiff = endIntersectionPoint.clone().sub(startIntersectionPoint);
                      const endPosition = startPosition.clone().add(positionDiff);
                      colorWheel.position.copy(endPosition);

                      _preview();
                    }
                  }
                }
              });
            }
          };
          rend.on('update', _update);

          this._cleanup = () => {
            notchMaterial.dispose();

            input.removeListener('triggerdown', _triggerdown);
            input.removeListener('triggerup', _triggerup);
            rend.removeListener('update', _update);
          };

          (() => { // XXX
            const colorWheel = _makeColorWheel({
              onpreview: (position, rotation, scale) => {
                console.log('preview');
              },
              onupdate: (position, rotation, scale) => {
                console.log('update');
              },
            });
            colorWheel.position.set(0, 2, -5);
            scene.add(colorWheel);
            colorWheel.updateBoxTargets();
          })();

          return {
            makeColorWheel: _makeColorWheel,
            destroyColorWheel: _destroyColorWheel,
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = Color;
