import TransformControls from './lib/three-extra/TransformControls';

const SIDES = ['left', 'right'];

class Transform {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    const cleanups = [];
    this._cleanup = () => {
      const oldCleanups = cleanups.slice();
      for (let i = 0; i < oldCleanups.length; i++) {
        const cleanup = oldCleanups[i];
        cleanup();
      }
    };

    let live = true;
    cleanups.push(() => {
      live = false;
    });

    return archae.requestPlugins([
      '/core/engines/three',
      '/core/engines/input',
      '/core/engines/webvr',
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/utils/geometry-utils',
    ])
      .then(([
        three,
        input,
        webvr,
        biolumi,
        rend,
        geometryUtils,
      ]) => {
        if (live) {
          const {THREE, scene} = three;

          const THREETransformControls = TransformControls(THREE);
          const {
            THREETransformGizmoTranslate,
            THREETransformGizmoRotate,
            THREETransformGizmoScale,
          } = THREETransformControls;

          const transparentMaterial = biolumi.getTransparentMaterial();

          const zeroVector = new THREE.Vector3();
          const oneVector = new THREE.Vector3(1, 1, 1);
          const upVector = new THREE.Vector3(0, 1, 0);
          const scaleNormalVector = new THREE.Vector3(-1, 0, 1).normalize();
          const zeroQuaternion = new THREE.Quaternion();

          const nubbinMaterial = new THREE.MeshBasicMaterial({
            color: 0xCCCCCC,
          });
          cleanups.push(() => {
            nubbinMaterial.dispose();
          });
          const scalerMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFFF00,
          });
          cleanups.push(() => {
            scalerMaterial.dispose();
          });

          const _makeDragState = () => ({
            src: null,
          });
          const dragStates = {
            left: _makeDragState(),
            right: _makeDragState(),
          };

          const transformGizmos = [];

          const _getTransformGizmos = () => transformGizmos;

          const rotateScale = 0.5;
          const scaleScale = 0.3;
          const scaleVector = new THREE.Vector3(scaleScale, scaleScale, scaleScale);
          const scaleFactor = scaleVector.length();
          const _makeTransformGizmo = ({position = zeroVector, rotation = zeroQuaternion, scale = oneVector, onpreview = nop, onupdate = nop}) => {
            const transformId = _makeId();

            const transformGizmo = (() => {
              const object = new THREE.Object3D();
              object.transformId = transformId;
              const properties = {
                position: new THREE.Vector3(),
                rotation: new THREE.Quaternion(),
                scale: new THREE.Vector3(1, 1, 1),
              };
              const state = {
                initialScale: new THREE.Vector3(1, 1, 1),
              };
              object.getProperties = () => properties;
              const _update = (position, rotation, scale) => {
                properties.position.copy(position);
                properties.rotation.copy(rotation);
                properties.scale.copy(scale);
                state.initialScale.copy(scale);

                object.position.copy(position);
                rotateGizmo.quaternion.copy(rotation);
                scaleGizmo.position.copy(scaleVector);
                object.updateMatrixWorld();

                // _updateBoxTargets();
              };
              object.update = _update;
              object.syncPosition = () => {
                properties.position.copy(object.position);
              };
              object.syncRotation = () => {
                properties.rotation.copy(rotateGizmo.quaternion);
              };
              object.syncScale = () => {
                properties.scale.copy(
                  state.initialScale.clone()
                    .multiply(scaleGizmo.position.clone().divideScalar(scaleFactor))
                );
              };
              object.onpreview = onpreview;
              object.onupdate = onupdate;

              const transformGizmo = new THREETransformGizmoTranslate();
              object.add(transformGizmo);
              object.transformGizmo = transformGizmo;

              const rotateGizmo = new THREETransformGizmoRotate();
              const rotateGizmoNubbin = (() => {
                const geometry = new THREE.SphereBufferGeometry(0.1 / 2 / rotateScale, 8, 8);
                const material = nubbinMaterial;
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.z = 1;
                return mesh;
              })();
              rotateGizmo.add(rotateGizmoNubbin);
              rotateGizmo.scale.set(rotateScale, rotateScale, rotateScale);
              object.add(rotateGizmo);
              object.rotateGizmo = rotateGizmo;

              const scaleGizmo = (() => {
                const geometry = new THREE.BoxBufferGeometry(0.075, 0.075, 0.075);
                const material = scalerMaterial;
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.copy(scaleVector);
                return mesh;
              })();
              object.add(scaleGizmo);
              object.scaleGizmo = scaleGizmo;

              return object;
            })();

            let boxAnchors = null;
            const _removeBoxTargets = () => {
              if (boxAnchors) {
                for (let i = 0; i < boxAnchors.length; i++) {
                  const boxAnchor = boxAnchors[i];
                  scene.remove(boxAnchor);

                  rend.removeMesh(boxAnchor);
                }
                rend.reindex();

                boxAnchors = null;
              }
            };
            transformGizmo.removeBoxTargets = _removeBoxTargets;
            const _makeBoxTarget = (position, rotation, scale, size, anchor) => {
              const geometry = geometryUtils.unindexBufferGeometry(new THREE.BoxBufferGeometry(size.x, size.y, size.z));
              const material = transparentMaterial;
              const mesh = new THREE.Mesh(geometry, material);
              mesh.position.copy(position);
              mesh.quaternion.copy(rotation);
              mesh.scale.copy(scale);
              mesh.anchor = anchor;
              return mesh;
            };
            const _updateBoxTargets = () => {
              _removeBoxTargets();

              boxAnchors = [
                _makeBoxTarget(
                  transformGizmo.position.clone().add(new THREE.Vector3(1, 0, 0)),
                  new THREE.Quaternion(),
                  new THREE.Vector3(1, 1, 1),
                  new THREE.Vector3(0.2, 0.1, 0.1),
                  {
                    onmousedown: `transform:${transformId}:x`,
                  }
                ),
                _makeBoxTarget(
                    transformGizmo.position.clone().add(new THREE.Vector3(0, 1, 0)),
                  new THREE.Quaternion(),
                  new THREE.Vector3(1, 1, 1),
                  new THREE.Vector3(0.1, 0.2, 0.1),
                  {
                    onmousedown: `transform:${transformId}:y`,
                  }
                ),
                _makeBoxTarget(
                  transformGizmo.position.clone().add(new THREE.Vector3(0, 0, 1)),
                  new THREE.Quaternion(),
                  new THREE.Vector3(1, 1, 1),
                  new THREE.Vector3(0.1, 0.1, 0.2),
                  {
                    onmousedown: `transform:${transformId}:z`,
                  }
                ),
                _makeBoxTarget(
                  transformGizmo.position.clone(),
                  new THREE.Quaternion(),
                  new THREE.Vector3(1, 1, 1),
                  new THREE.Vector3(0.2, 0.2, 0.2),
                  {
                    onmousedown: `transform:${transformId}:xyz`,
                  }
                ),
                _makeBoxTarget(
                  transformGizmo.position.clone().add(new THREE.Vector3(0.3 / 2, 0.3 / 2, 0)),
                  new THREE.Quaternion(),
                  new THREE.Vector3(1, 1, 1),
                  new THREE.Vector3(0.3, 0.3, 0.01),
                  {
                    onmousedown: `transform:${transformId}:xy`,
                  }
                ),
                _makeBoxTarget(
                  transformGizmo.position.clone().add(new THREE.Vector3(0, 0.3 / 2, 0.3 / 2)),
                  new THREE.Quaternion(),
                  new THREE.Vector3(1, 1, 1),
                  new THREE.Vector3(0.01, 0.3, 0.3),
                  {
                    onmousedown: `transform:${transformId}:yz`,
                  }
                ),
                _makeBoxTarget(
                  transformGizmo.position.clone().add(new THREE.Vector3(0.3 / 2, 0, 0.3 / 2)),
                  new THREE.Quaternion(),
                  new THREE.Vector3(1, 1, 1),
                  new THREE.Vector3(0.3, 0.01, 0.3),
                  {
                    onmousedown: `transform:${transformId}:xz`,
                  }
                ),
                _makeBoxTarget(
                  transformGizmo.position.clone().add(
                    new THREE.Vector3(0, 0, rotateScale)
                      .applyQuaternion(transformGizmo.rotateGizmo.quaternion)
                  ),
                  new THREE.Quaternion(),
                  new THREE.Vector3(1, 1, 1),
                  new THREE.Vector3(0.1, 0.1, 0.1),
                  {
                    onmousedown: `transform:${transformId}:rotate`,
                  }
                ),
                _makeBoxTarget(
                  transformGizmo.position.clone().add(transformGizmo.scaleGizmo.position),
                  new THREE.Quaternion(),
                  new THREE.Vector3(1, 1, 1),
                  new THREE.Vector3(0.1, 0.1, 0.1),
                  {
                    onmousedown: `transform:${transformId}:scale`,
                  }
                ),
              ];
              for (let i = 0; i < boxAnchors.length; i++) {
                const boxAnchor = boxAnchors[i];
                scene.add(boxAnchor);
                boxAnchor.updateMatrixWorld();

                rend.addMesh(boxAnchor);
              }

              rend.reindex();
              /* for (let i = 0; i < boxAnchors.length; i++) {
                const boxAnchor = boxAnchors[i];
                rend.updateMatrixWorld(boxAnchor);
              } */
            };
            transformGizmo.updateBoxTargets = _updateBoxTargets;

            _update(position, rotation, scale);
            _updateBoxTargets();

            transformGizmos.push(transformGizmo);

            return transformGizmo;
          };
          const _destroyTransformGizmo = transformGizmo => {
            transformGizmo.removeBoxTargets();
            transformGizmos.splice(transformGizmos.indexOf(transformGizmo), 1);
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
                if (match = onmousedown.match(/^transform:([^:]+):(x|y|z|xyz|xy|yz|xz|rotate|scale)$/)) {
                  const transformId = match[1];
                  const mode = match[2];

                  const dragState = dragStates[side];
                  const {gamepads} = webvr.getStatus();
                  const gamepad = gamepads[side];
                  const {worldPosition: controllerPosition, worldRotation: controllerRotation} = gamepad;
                  const transformGizmo = transformGizmos.find(transformGizmo => transformGizmo.transformId === transformId);
                  dragState.src = {
                    transformId: transformId,
                    mode: mode,
                    startControllerPosition: controllerPosition.clone(),
                    startControllerRotation: controllerRotation.clone(),
                    startIntersectionPoint: intersectionPoint.clone(),
                    startPosition: transformGizmo.position.clone(),
                  };

                  transformGizmo.removeBoxTargets();

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
              const {transformId} = src;
              const transformGizmo = transformGizmos.find(transformGizmo => transformGizmo.transformId === transformId);

              const {position, rotation, scale} = transformGizmo.getProperties();
              transformGizmo.update(position, rotation, scale);
              transformGizmo.updateBoxTargets();
              transformGizmo.onupdate(position, rotation, scale);

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
                const {transformId, mode, startControllerPosition, startControllerRotation, startIntersectionPoint, startPosition} = src;
                const transformGizmo = transformGizmos.find(transformGizmo => transformGizmo.transformId === transformId);

                const _preview = () => {
                  const {position, rotation, scale} = transformGizmo.getProperties();
                  transformGizmo.onpreview(position, rotation, scale);
                };

                if (mode === 'x') {
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
                    transformGizmo.position.copy(endPosition);
                    transformGizmo.updateMatrixWorld();

                    transformGizmo.syncPosition();

                    _preview();
                  }
                } else if (mode === 'y') {
                  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), startIntersectionPoint);
                  const {worldPosition: controllerPosition, worldRotation: controllerRotation, worldScale: controllerScale} = gamepad;
                  const controllerLine = geometryUtils.makeControllerLine(controllerPosition, controllerRotation, controllerScale);
                  const controllerIntersectionPoint = plane.intersectLine(controllerLine);

                  if (controllerIntersectionPoint) {
                    const endIntersectionPoint = new THREE.Vector3(
                      startIntersectionPoint.x,
                      controllerIntersectionPoint.y,
                      startIntersectionPoint.z
                    );
                    const positionDiff = endIntersectionPoint.clone().sub(startIntersectionPoint);
                    const endPosition = startPosition.clone().add(positionDiff);
                    transformGizmo.position.copy(endPosition);
                    transformGizmo.updateMatrixWorld();

                    transformGizmo.syncPosition();

                    _preview();
                  }
                } else if (mode === 'z') {
                  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(1, 0, 0), startIntersectionPoint);
                  const {worldPosition: controllerPosition, worldRotation: controllerRotation, worldScale: controllerScale} = gamepad;
                  const controllerLine = geometryUtils.makeControllerLine(controllerPosition, controllerRotation, controllerScale);
                  const controllerIntersectionPoint = plane.intersectLine(controllerLine);

                  if (controllerIntersectionPoint) {
                    const endIntersectionPoint = new THREE.Vector3(
                      startIntersectionPoint.x,
                      startIntersectionPoint.y,
                      controllerIntersectionPoint.z
                    );
                    const positionDiff = endIntersectionPoint.clone().sub(startIntersectionPoint);
                    const endPosition = startPosition.clone().add(positionDiff);
                    transformGizmo.position.copy(endPosition);
                    transformGizmo.updateMatrixWorld();

                    transformGizmo.syncPosition();

                    _preview();
                  }
                } else if (mode === 'xy') {
                  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), startIntersectionPoint);
                  const {worldPosition: controllerPosition, worldRotation: controllerRotation, worldScale: controllerScale} = gamepad;
                  const controllerLine = geometryUtils.makeControllerLine(controllerPosition, controllerRotation, controllerScale);
                  const endIntersectionPoint = plane.intersectLine(controllerLine);

                  if (endIntersectionPoint) {
                    const positionDiff = endIntersectionPoint.clone().sub(startIntersectionPoint);
                    const endPosition = startPosition.clone().add(positionDiff);
                    transformGizmo.position.copy(endPosition);
                    transformGizmo.updateMatrixWorld();

                    transformGizmo.syncPosition();

                    _preview();
                  }
                } else if (mode === 'yz') {
                  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(1, 0, 0), startIntersectionPoint);
                  const {worldPosition: controllerPosition, worldRotation: controllerRotation, worldScale: controllerScale} = gamepad;
                  const controllerLine = geometryUtils.makeControllerLine(controllerPosition, controllerRotation, controllerScale);
                  const endIntersectionPoint = plane.intersectLine(controllerLine);

                  if (endIntersectionPoint) {
                    const positionDiff = endIntersectionPoint.clone().sub(startIntersectionPoint);
                    const endPosition = startPosition.clone().add(positionDiff);
                    transformGizmo.position.copy(endPosition);
                    transformGizmo.updateMatrixWorld();

                    transformGizmo.syncPosition();

                    _preview();
                  }
                } else if (mode === 'xz') {
                  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), startIntersectionPoint);
                  const {worldPosition: controllerPosition, worldRotation: controllerRotation, worldScale: controllerScale} = gamepad;
                  const controllerLine = geometryUtils.makeControllerLine(controllerPosition, controllerRotation, controllerScale);
                  const endIntersectionPoint = plane.intersectLine(controllerLine);

                  if (endIntersectionPoint) {
                    const positionDiff = endIntersectionPoint.clone().sub(startIntersectionPoint);
                    const endPosition = startPosition.clone().add(positionDiff);
                    transformGizmo.position.copy(endPosition);
                    transformGizmo.updateMatrixWorld();

                    transformGizmo.syncPosition();

                    _preview();
                  }
                } else if (mode === 'xyz') {
                  const {worldPosition: controllerPosition, worldRotation: controllerRotation} = gamepad;
                  const endPosition = controllerPosition.clone()
                    .add(
                      new THREE.Vector3(0, 0, -1)
                        .applyQuaternion(controllerRotation)
                        .multiplyScalar(startIntersectionPoint.clone().sub(startControllerPosition).length())
                    )
                    .add(
                      startPosition.clone().sub(startIntersectionPoint)
                    );
                  transformGizmo.position.copy(endPosition);
                  transformGizmo.updateMatrixWorld();

                  transformGizmo.syncPosition();

                  _preview();
                } else if (mode === 'rotate') {
                  const {worldPosition: controllerPosition, worldRotation: controllerRotation} = gamepad;
                  const endPosition = controllerPosition.clone()
                    .add(
                      new THREE.Vector3(0, 0, -1)
                        .applyQuaternion(controllerRotation)
                    );
                  const endSpherePoint = new THREE.Sphere(startPosition.clone(), rotateScale)
                    .clampPoint(endPosition);
                  const rotationMatrix = new THREE.Matrix4().lookAt(
                    endSpherePoint,
                    startPosition,
                    upVector.clone().applyQuaternion(controllerRotation)
                  );
                  transformGizmo.rotateGizmo.quaternion.setFromRotationMatrix(rotationMatrix);
                  transformGizmo.rotateGizmo.updateMatrixWorld();

                  transformGizmo.syncRotation();

                  _preview();
                } else if (mode === 'scale') {
                  const {worldPosition: controllerPosition, worldRotation: controllerRotation} = gamepad;
                  const endPlanePoint = new THREE.Plane()
                    .setFromNormalAndCoplanarPoint(scaleNormalVector.clone(), startPosition.clone())
                    .intersectLine(
                      new THREE.Line3(
                        controllerPosition.clone(),
                        controllerPosition.clone().add(new THREE.Vector3(0, 0, -15).applyQuaternion(controllerRotation))
                      )
                    );
                  if (endPlanePoint) {
                    const endLinePoint = new THREE.Line3(startPosition.clone(), startPosition.clone().add(oneVector))
                      .closestPointToPoint(endPlanePoint, false);
                    const endScalePoint = endLinePoint.clone().sub(startPosition);
                    transformGizmo.scaleGizmo.position.copy(endScalePoint);
                    transformGizmo.scaleGizmo.updateMatrixWorld();

                    transformGizmo.syncScale();

                    _preview();
                  }
                }
              }
            });
          };
          rend.on('update', _update);

          cleanups.push(() => {
            input.removeListener('triggerdown', _triggerdown);
            input.removeListener('triggerup', _triggerup);
            rend.removeListener('update', _update);
          });

          return {
            getTransformGizmos: _getTransformGizmos,
            makeTransformGizmo: _makeTransformGizmo,
            destroyTransformGizmo: _destroyTransformGizmo,
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}
const _makeId = () => Math.random().toString(36).substring(7);
const nop = () => {};
const yes = () => true;

module.exports = Transform;
