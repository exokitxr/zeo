const DEFAULT_GRAB_RADIUS = 0.2;

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

          const {events} = jsUtils;
          const {EventEmitter} = events;

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

          class Grabbable {
            constructor(element, object) {
              this.element = element;
              this.object = object;

              this.grabState = null;

              this.trygrab = this.trygrab.bind(this);
            }

            setGrabbable(newValue) {
              const {element, trygrab} = this;

              if (newValue) {
                element.addEventListener('trygrab', trygrab);
              } else {
                element.removeEventListener('trygrab', trygrab);

                const {grabState} = this;
                if (grabState) {
                  this.release();
                }
              }
            }

            trygrab(e) {
              const {detail: {side, entityElement}} = e;
              const globalGrabState = globalGrabStates[side];
              const {grabbable: globalGrabbable} = globalGrabState;

              if (!globalGrabbable) {
                const {side} = grabState;
                const {gamepads} = pose.getStatus();
                const gamepad = gamepads[side];

                if (gamepad) {
                  const {position: controllerPosition} = gamepad;
                  const {position: objectPosition} = _decomposeObjectMatrixWorld(object);

                  if (controllerPosition.distanceTo(objectPosition) <= DEFAULT_GRAB_RADIUS) {
                    const object = entityElement.getObject();
                    const {parent: originalParent} = object; // XXX use this during release
                    const grabState = {
                      side: side,
                      entityElement: entityElement,
                      originalParent: originalParent,
                    };
                    this.grabState = grabState;

                    globalGrabState.grabbable = this;

                    const controllers = cyborg.getControllers();
                    const controller = controllers[side];
                    const {mesh: controllerMesh} = controller;
                    controllerMesh.add(object);

                    const grabEvent = new CustomEvent('grab', {
                      detail: {
                        side,
                        entityElement,
                      },
                    });
                    entityElement.dispatchEvent(grabEvent);
                  }
                }
              }
            }

            release() {
              const {grabState: {side, entityElement}} = this;

              this.grabState = null;

              const globalGrabState = globalGrabStates[side];
              globalGrabState.grabbable = null;

              // XXX put the object back onto the originalParent here

              const object = entityElement.getObject();
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
              entityElement.dispatchEvent(releaseEvent);
            }

            destroy() {
              const {grabState} = this;

              if (grabState) {
                this.release();
              }
            }
          }

          const _gripup = e => {
            const {side} = e;
            const globalGrabState = globalGrabStates[side];
            const {grabbable: globalGrabbable} = globalGrabState;

            if (globalGrabbable) {
              globalGrabbable.release();
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
              }
            }
          };
          };
          elements.registerComponent(this, grabbableComponent);

          this._cleanup = () => {
            elements.unregisterComponent(this, grabbableComponent);

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
