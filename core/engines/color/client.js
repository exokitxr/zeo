const SIZE = 0.2;

const SIDES = ['left', 'right'];

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
      '/core/engines/rend',
      '/core/utils/geometry-utils',
      '/core/utils/menu-utils',
    ])
      .then(([
        three,
        input,
        webvr,
        biolumi,
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
          const menuColorWheels = [];
          rend.registerAuxObject('colorWheels', menuColorWheels);

          const _getSize = () => SIZE;
          const _makeColorWheel = ({onpreview, onupdate, menu = false, isEnabled = yes}) => {
            const object = new THREE.Object3D();
            const colorId = _makeId();
            object.colorId = colorId;
            object.onpreview = onpreview;
            object.onupdate = onupdate;
            object.menu = menu;

            const colorWheelMesh = (() => {
              const object = new THREE.Object3D();
              object.x = 0.5;
              object.y = 0.5;

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
                const geometry = new THREE.TorusBufferGeometry(SIZE / 20, SIZE / 80, 3, 8);
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
              object.y = 0.5;

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

            object.getColor = () => {
              const {x, y} = colorWheelMesh;
              const baseColor = new THREE.Color(colorWheelImg.getColor(x, 1 - y));
              const {y: v} = colorBarMesh;
              const valueColor = new THREE.Color(colorBarImg.getColor(v));
              return baseColor.clone().multiply(valueColor).getHexString();
            };
            object.update = (position, rotation, scale) => {
              object.position.copy(position);
              object.quaternion.copy(rotation);
              object.scale.copy(scale);

              _updateBoxTargets();
            };

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
                biolumi.makeBoxAnchor({
                  boxTarget: geometryUtils.makeBoxTarget(
                    object.position.clone().add(new THREE.Vector3(-SIZE / 10 / 2, 0, 0).applyQuaternion(object.quaternion)),
                    object.quaternion.clone(),
                    new THREE.Vector3(1, 1, 1),
                    new THREE.Vector3(SIZE, SIZE, SIZE / 20)
                  ),
                  anchor: {
                    onmousedown: `color:${colorId}:wheel`,
                  },
                  isEnabled: isEnabled,
                }),
                biolumi.makeBoxAnchor({
                  boxTarget: geometryUtils.makeBoxTarget(
                    object.position.clone().add(new THREE.Vector3(SIZE / 2, 0, 0).applyQuaternion(object.quaternion)),
                    object.quaternion.clone(),
                    new THREE.Vector3(1, 1, 1),
                    new THREE.Vector3(SIZE / 10, SIZE, SIZE / 20)
                  ),
                  anchor: {
                    onmousedown: `color:${colorId}:bar`,
                  },
                  isEnabled: isEnabled,
                }),
              ];
              for (let i = 0; i < boxAnchors.length; i++) {
                const boxAnchor = boxAnchors[i];
                rend.addBoxAnchor(boxAnchor);
              }
            };
            object.updateBoxTargets = _updateBoxTargets;

            colorWheels.push(object);

            if (menu) {
              menuColorWheels.push(colorWheel);
            }

            return object;
          };
          const _destroyColorWheel = colorWheel => {
            colorWheel.removeBoxTargets();

            colorWheels.splice(colorWheels.indexOf(colorWheel), 1);

            if (colorWheel.menu) {
              menuColorWheels.splice(menuColorWheels.indexOf(colorWheel), 1);
            }
          };

          const _triggerdown = e => {
            const {side} = e;

            const _doClickColorWheel = () => {
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
                    startPosition: colorWheel.position.clone(),
                    startRotation: colorWheel.quaternion.clone(),
                  };

                  return true;
                } else {
                  return false;
                }
              } else {
                return false;
              }
            };

            if (_doClickColorWheel()) {
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

              const color = colorWheel.getColor();
              colorWheel.onupdate(color);

              dragState.src = null;
            }
          };
          input.on('triggerup', _triggerup);
          const _update = () => {
            SIDES.forEach(side => {
              const dragState = dragStates[side];
              const {src} = dragState;
              const {gamepads} = webvr.getStatus();
              const gamepad = gamepads[side];

              if (src) {
                const {colorId, mode, startPosition, startRotation} = src;
                const colorWheel = colorWheels.find(colorWheel => colorWheel.colorId === colorId);

                const _preview = () => {
                  const color = colorWheel.getColor();
                  colorWheel.onpreview(color);
                };

                if (mode === 'wheel') {
                  const {worldPosition: controllerPosition, worldRotation: controllerRotation} = gamepad;
                  const intersectionPoint = new THREE.Plane().setFromNormalAndCoplanarPoint(
                    new THREE.Vector3(0, 0, -1).applyQuaternion(startRotation),
                    startPosition.clone()
                  )
                    .intersectLine(
                      new THREE.Line3(
                        controllerPosition.clone(),
                        controllerPosition.clone().add(new THREE.Vector3(0, 0, -15).applyQuaternion(controllerRotation))
                      )
                    );
                  const yPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
                    new THREE.Vector3(1, 0, 0).applyQuaternion(startRotation),
                    startPosition.clone().add(
                      new THREE.Vector3(-SIZE / 2, -SIZE / 2, 0).applyQuaternion(startRotation)
                    )
                  );
                  const xPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
                    new THREE.Vector3(0, 1, 0).applyQuaternion(startRotation),
                    startPosition.clone().add(
                      new THREE.Vector3(-SIZE / 2, -SIZE / 2, 0).applyQuaternion(startRotation)
                    )
                  );
                  const x = yPlane.distanceToPoint(intersectionPoint) / SIZE;
                  const y = xPlane.distanceToPoint(intersectionPoint) / SIZE;

                  if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
                    colorWheel.colorWheelMesh.x = x;
                    colorWheel.colorWheelMesh.y = y;

                    colorWheel.colorWheelMesh.notchMesh.position.x = -(SIZE / 2) + (x * SIZE);
                    colorWheel.colorWheelMesh.notchMesh.position.y = -(SIZE / 2) + (y * SIZE);

                    _preview();
                  }
                } else if (mode === 'bar') {
                  const {worldPosition: controllerPosition, worldRotation: controllerRotation} = gamepad;
                  const intersectionPoint = new THREE.Plane().setFromNormalAndCoplanarPoint(
                    new THREE.Vector3(0, 0, -1).applyQuaternion(startRotation),
                    startPosition.clone()
                  )
                    .intersectLine(
                      new THREE.Line3(
                        controllerPosition.clone(),
                        controllerPosition.clone().add(new THREE.Vector3(0, 0, -15).applyQuaternion(controllerRotation))
                      )
                    );
                  const xPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
                    new THREE.Vector3(0, 1, 0).applyQuaternion(startRotation),
                    startPosition.clone().add(
                      new THREE.Vector3(SIZE / 2, -SIZE / 2, 0).applyQuaternion(startRotation)
                    )
                  );
                  const y = xPlane.distanceToPoint(intersectionPoint) / SIZE;

                  if (y >= 0 && y <= 1) {
                    colorWheel.colorBarMesh.y = y;

                    colorWheel.colorBarMesh.notchMesh.position.y = -(SIZE / 2) + (y * SIZE);

                    _preview();
                  }
                }
              }
            });
          };
          rend.on('update', _update);

          this._cleanup = () => {
            notchMaterial.dispose();

            input.removeListener('triggerdown', _triggerdown);
            input.removeListener('triggerup', _triggerup);
            rend.removeListener('update', _update);
          };

          return {
            getSize: _getSize,
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
const yes = () => true;

module.exports = Color;
