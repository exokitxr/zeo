const DEFAULT_GRAB_RADIUS = 0.2;
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

    return archae.requestPlugins([
      '/core/engines/cyborg',
    ])
      .then(([
        cyborg,
      ]) => {
        if (live) {
          const {three: {THREE}, elements, pose, input, utils: {js: {events: {EventEmitter}}}} = zeo;
          const player = cyborg.getPlayer();

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

          const grabbables = [];

          class Grabbable {
            constructor(entityElement, object) {
              this.entityElement = entityElement;
              this.object = object;

              this.grabbable = false;
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

            setHoldable(newValue) {
              this.holdable = newValue;

              this.render();
            }

            render() {
              const {entityElement, grabbable, holdable, trygrab, grab} = this;

              if (grabbable && holdable) {
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

            trygrab(e) {
              const {detail: {side}} = e;
              const globalGrabState = globalGrabStates[side];
              const {grabbable: globalGrabbable} = globalGrabState;

              if (!globalGrabbable) {
                const {gamepads} = pose.getStatus();
                const gamepad = gamepads[side];

                if (gamepad) {
                  const {position: controllerPosition} = gamepad;
                  const {object} = this;
                  const {position: objectPosition} = _decomposeObjectMatrixWorld(object);

                  if (controllerPosition.distanceTo(objectPosition) <= DEFAULT_GRAB_RADIUS) {
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
                const {parent: originalParent} = object;
                const originalSpPhysics = entityElement.getAttribute('sp-physics');

                const grabState = {
                  side,
                  originalParent,
                  originalSpPhysics,
                };
                this.grabState = grabState;

                const controllers = cyborg.getControllers();
                const controller = controllers[side];
                const {mesh: controllerMesh} = controller;
                object.position.copy(zeroVector);
                object.quaternion.copy(zeroQuaternion);
                object.scale.copy(oneVector);
                controllerMesh.add(object);

                if (originalSpPhysics) {
                  entityElement.setAttribute('sp-physics', JSON.stringify(false));
                }

                globalGrabState.grabbable = this;
              }
            }

            release() {
              const {entityElement, object, grabState: {side, originalParent, originalSpPhysics}} = this;

              this.grabState = null;

              const globalGrabState = globalGrabStates[side];
              globalGrabState.grabbable = null;

              const {position, rotation, scale} = _decomposeObjectMatrixWorld(object);
              const linearVelocity = player.getControllerLinearVelocity(side);
              const angularVelocity = player.getControllerAngularVelocity(side);
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

              object.position.copy(position);
              object.quaternion.copy(rotation);
              object.scale.copy(scale);
              originalParent.add(object);

              entityElement.setAttribute('position', JSON.stringify(position.toArray().concat(rotation.toArray()).concat(scale.toArray())));
              if (originalSpPhysics) {
                entityElement.setAttribute('sp-physics', JSON.stringify(true));
              }

              entityElement.dispatchEvent(releaseEvent);
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

                const grabbableDistanceSpecs = grabbables.map(grabbable => {
                  const {object} = grabbable;
                  const {position: objectPosition} = _decomposeObjectMatrixWorld(object);
                  const distance = controllerPosition.distanceTo(objectPosition);

                  return {
                    grabbable,
                    distance,
                  };
                }).filter(({distance}) => distance <= DEFAULT_GRAB_RADIUS);

                if (grabbableDistanceSpecs.length > 0) {
                  const {grabbable: bestGrabbable} = grabbableDistanceSpecs.sort((a, b) => a.distance - b.distance)[0];

                  const trygrabEvent = new CustomEvent('trygrab', {
                    detail: {
                      side,
                    },
                  });
                  const {entityElement} = bestGrabbable;
                  entityElement.dispatchEvent(trygrabEvent);

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
            selector: '[grabbable]',
            attributes: {
              grabbable: {
                type: 'checkbox',
                value: true,
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
                case 'holdable': {
                  grabbable.setHoldable(newValue);

                  break;
                }
              }
            }
          };
          elements.registerComponent(this, grabbableComponent);

          this._cleanup = () => {
            elements.unregisterComponent(this, grabbableComponent);

            input.removeListener('gripdown', _gripdown);
            input.removeListener('gripup', _gripup);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = ZGrabbable;
