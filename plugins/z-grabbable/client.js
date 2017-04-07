const DEFAULT_MATRIX = [
  0, 1, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const SIDES = ['left', 'right'];

class ZGrabbable {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const {three: {THREE}, elements, pose, input, player, utils: {js: {events: {EventEmitter}}}} = zeo;

    const worldElement = elements.getWorldElement();
    const localUserId = player.getId();

    const zeroVector = new THREE.Vector3();
    const zeroQuaternion = new THREE.Quaternion();
    const oneVector = new THREE.Vector3(1, 1, 1);

    const _decomposeObjectMatrixWorld = object => {
      const {matrixWorld} = object;
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrixWorld.decompose(position, rotation, scale);
      return {position, rotation, scale};
    };

    const _makeGlobalGrabState = () => ({
      grabbable: null,
    });
    const globalGrabStates = {
      left: _makeGlobalGrabState(),
      right: _makeGlobalGrabState(),
    };

    const _grab = (userId, side, elementId) => {
      const isMe = userId === localUserId;

      const object = (() => {
        const grabbable = grabbables.find(grabbable => grabbable.entityElement.getId() === elementId);
        return grabbable ? grabbable.object : null;
      })();
      const controllerMeshes = (() => {
        if (isMe) {
          return player.getControllerMeshes();
        } else {
          return player.getRemoteControllerMeshes(userId);
        }
      })();

      const controllerMesh = controllerMeshes[side];
      object.originalParent = object.parent;
      controllerMesh.add(object);
      object.position.copy(zeroVector);
      object.quaternion.copy(zeroQuaternion);
      object.scale.copy(oneVector);

      if (isMe) {
        const broadcastEvent = new CustomEvent('broadcast', {
          detail: {
            type: 'grabbable.grab',
            args: [userId, side, elementId],
          },
        });
        worldElement.dispatchEvent(broadcastEvent);
      }
    };
    const _release = (userId, side, elementId) => {
      const isMe = userId === localUserId;

      const object = (() => {
        const grabbable = grabbables.find(grabbable => grabbable.entityElement.getId() === elementId);
        return grabbable ? grabbable.object : null;
      })();

      const {position, rotation, scale} = _decomposeObjectMatrixWorld(object);
      object.originalParent.add(object);
      object.originalParent = null;
      object.position.copy(position);
      object.quaternion.copy(rotation);
      object.scale.copy(scale);

      if (isMe) {
        const broadcastEvent = new CustomEvent('broadcast', {
          detail: {
            type: 'grabbable.release',
            args: [userId, side, elementId],
          },
        });
        worldElement.dispatchEvent(broadcastEvent);
      }
    };

    const grabbables = [];

    class Grabbable {
      constructor(entityElement, object) {
        this.entityElement = entityElement;
        this.object = object;

        this.grabbable = false;
        this.size = null;
        this.holdable = false;

        this.grabState = null;

        this.trygrab = this.trygrab.bind(this);
        this.grab = this.grab.bind(this);

        grabbables.push(this);
      }

      setGrabbable(newValue) {
        this.grabbable = newValue;

        this.render();
      }

      setSize(newValue) {
        this.size = newValue;

        this.render();
      }

      setHoldable(newValue) {
        this.holdable = newValue;

        this.render();
      }

      render() {
        const {entityElement, grabbable, size, holdable, trygrab, grab} = this;

        if (grabbable && size && holdable) {
          entityElement.addEventListener('trygrab', trygrab);
          entityElement.addEventListener('grab', grab);
        } else {
          entityElement.removeEventListener('trygrab', trygrab);
          entityElement.removeEventListener('grab', grab);

          const {grabState} = this;
          if (grabState) {
            this.release();
          }
        }
      }

      trygrab(e) { // XXX make this work in multiplayer
        const {detail: {side}} = e;
        const globalGrabState = globalGrabStates[side];
        const {grabbable: globalGrabbable} = globalGrabState;

        if (!globalGrabbable) {
          const {gamepads} = pose.getStatus();
          const gamepad = gamepads[side];

          if (gamepad) {
            const {position: controllerPosition} = gamepad;
            const {object, size} = this;
            const {position: objectPosition} = _decomposeObjectMatrixWorld(object);
            const radius = Math.max.apply(Math, size) / 2;
            const sphere = new THREE.Sphere(objectPosition, radius);

            if (sphere.containsPoint(controllerPosition)) {
              const grabEvent = new CustomEvent('grab', {
                detail: {
                  side,
                },
              });
              const {entityElement} = this;
              entityElement.dispatchEvent(grabEvent);
            }
          }
        }
      }

      grab(e) {
        const {detail: {side}} = e;
        const globalGrabState = globalGrabStates[side];
        const {grabbable: globalGrabbable} = globalGrabState;

        if (!globalGrabbable) {
          const {entityElement, object} = this;
          const originalPosition = entityElement.hasAttribute('position');
          const originalSpPhysics = entityElement.hasAttribute('sp-physics');

          const grabState = {
            side,
            originalPosition,
            originalSpPhysics,
          };
          this.grabState = grabState;

          _grab(localUserId, side, entityElement.getId());

          if (originalSpPhysics) {
            entityElement.setAttribute('sp-physics', JSON.stringify(false));
          }

          globalGrabState.grabbable = this;
        }
      }

      release() {
        const {entityElement, object, grabState: {side, originalPosition, originalSpPhysics}} = this;

        this.grabState = null;

        const globalGrabState = globalGrabStates[side];
        globalGrabState.grabbable = null;

        const {position, rotation, scale} = _decomposeObjectMatrixWorld(object);
        const linearVelocity = pose.getControllerLinearVelocity(side);
        const angularVelocity = pose.getControllerAngularVelocity(side);
        const releaseEvent = new CustomEvent('release', {
          detail: {
            side,
            entityElement,
            object,
            position,
            rotation,
            scale,
            linearVelocity,
            angularVelocity,
          },
        });

        _release(localUserId, side, entityElement.getId());

        if (originalPosition) {
          entityElement.setAttribute('position', JSON.stringify(position.toArray().concat(rotation.toArray()).concat(scale.toArray())));
        }
        if (originalSpPhysics) {
          entityElement.setAttribute('sp-physics', JSON.stringify(true));
        }

        entityElement.dispatchEvent(releaseEvent);
      }

      swap() {
        const {entityElement, object, grabState} = this;
        const {side} = grabState;
        const otherSide = side === 'left' ? 'right' : 'left';

        grabState.side = otherSide;

        const globalGrabState = globalGrabStates[side];
        globalGrabState.grabbable = null;
        const otherGlobalGrabState = globalGrabStates[otherSide];
        otherGlobalGrabState.grabbable = this;

        const controllerMeshes = player.getControllerMeshes();
        const otherControllerMesh = controllerMeshes[otherSide];
        otherControllerMesh.add(object);

        const swapEvent = new CustomEvent('swap', {
          detail: {
            side: otherSide,
          },
        });
        entityElement.dispatchEvent(swapEvent);
      }

      destroy() {
        const {grabState} = this;

        if (grabState) {
          this.release();
        }

        grabbables.splice(grabbables.indexOf(this), 1);
      }
    }

    const _gripdown = e => {
      const {side} = e;
      const globalGrabState = globalGrabStates[side];
      const {grabbable: globalGrabbable} = globalGrabState;

      if (!globalGrabbable) {
        const {gamepads} = pose.getStatus();
        const gamepad = gamepads[side];

        if (gamepad) {
          const {position: controllerPosition} = gamepad;

          const otherSide = side === 'left' ? 'right' : 'left';
          const otherGlobalGrabState = globalGrabStates[otherSide];
          const {grabbable: otherGlobalGrabbable} = otherGlobalGrabState;

          const grabbableDistanceSpecs = grabbables.map(grabbable => {
            if (grabbable !== otherGlobalGrabbable) {
              const {object, size} = grabbable;
              const {position: objectPosition} = _decomposeObjectMatrixWorld(object);
              const radius = Math.max.apply(Math, size) / 2;
              const sphere = new THREE.Sphere(objectPosition, radius);

              if (sphere.containsPoint(controllerPosition)) {
                const distance = controllerPosition.distanceTo(objectPosition);

                return {
                  grabbable,
                  side: null,
                  distance,
                };
              } else {
                return null;
              }
            } else {
              return null;
            }
          })
            .concat([
              (() => {
                if (otherGlobalGrabbable) {
                  const otherGamepad = gamepads[otherSide];

                  if (otherGamepad) {
                    const {position: otherControllerPosition} = otherGamepad;
                    const distance = controllerPosition.distanceTo(otherControllerPosition);

                    if (distance < 0.2) {
                      return {
                        grabbable: otherGlobalGrabbable,
                        side: otherSide,
                        distance,
                      };
                    } else {
                      return null;
                    }
                  } else {
                    return null;
                  }
                } else {
                  return null;
                }
              })()
            ])
            .filter(spec => spec !== null);

          if (grabbableDistanceSpecs.length > 0) {
            const {side: bestGrabbableSide, grabbable: bestGrabbable} = grabbableDistanceSpecs.sort((a, b) => a.distance - b.distance)[0];

            if (bestGrabbableSide) {
              bestGrabbable.swap();
            } else {
              const trygrabEvent = new CustomEvent('trygrab', {
                detail: {
                  side,
                },
              });
              const {entityElement} = bestGrabbable;
              entityElement.dispatchEvent(trygrabEvent);
            }

            e.stopImmediatePropagation();
          }
        }
      }
    };
    input.on('gripdown', _gripdown);
    const _gripup = e => {
      const {side} = e;
      const globalGrabState = globalGrabStates[side];
      const {grabbable: globalGrabbable} = globalGrabState;

      if (globalGrabbable) {
        globalGrabbable.release();

        e.stopImmediatePropagation();
      }
    };
    input.on('gripup', _gripup);

    const grabbableComponent = {
      selector: '[grabbable][size]',
      attributes: {
        grabbable: {
          type: 'checkbox',
          value: true,
        },
        size: {
          type: 'vector',
          value: [1, 1, 1],
          min: 0.1,
          max: 1,
          step: 0.1,
        },
        holdable: {
          type: 'checkbox',
          value: true,
        },
        position: {
          type: 'matrix',
          value: DEFAULT_MATRIX,
        },
      },
      entityAddedCallback(entityElement) {
        const grabbable = new Grabbable(entityElement, entityElement.getObject());
        entityElement.setComponentApi(grabbable);
      },
      entityRemovedCallback(entityElement) {
        const grabbable = entityElement.getComponentApi();
        grabbable.destroy();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const grabbable = entityElement.getComponentApi();

        switch (name) {
          case 'grabbable': {
            grabbable.setGrabbable(newValue);

            break;
          }
          case 'size': {
            grabbable.setSize(newValue);

            break;
          }
          case 'holdable': {
            grabbable.setHoldable(newValue);

            break;
          }
        }
      }
    };
    elements.registerComponent(this, grabbableComponent);

    worldElement.addEventListener('message', e => {
      const {detail: {type}} = e;

      if (type === 'grabbable.grab') {
        const {detail: {args: [userId, side, elementId]}} = e;

        _grab(userId, side, elementId);
      } else if (type === 'grabbable.release') {
        const {detail: {args: [userId, side, elementId]}} = e;

        _release(userId, side, elementId);
      }
    });

    this._cleanup = () => {
      elements.unregisterComponent(this, grabbableComponent);

      input.removeListener('gripdown', _gripdown);
      input.removeListener('gripup', _gripup);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = ZGrabbable;
