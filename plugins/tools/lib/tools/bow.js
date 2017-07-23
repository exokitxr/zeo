const NPC_PLUGIN = 'plugins-npc';
const dataSymbol = Symbol();

const bow = ({archae}) => {
  const {three, pose, input, render, elements, items, teleport} = zeo;
  const {THREE, scene} = three;

  const localPositionVector = new THREE.Vector3(0, 0, 0.015/2 + 0.015*3);
  const localRotationQuaterion = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    Math.PI / 4
  ).premultiply(new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(1, 0, 0)
  ));
  const zeroVector = new THREE.Vector3();
  const oneVector = new THREE.Vector3(1, 1, 1);
  const zeroQuaternion = new THREE.Quaternion();

  let npcElement = null;
  const elementListener = elements.makeListener(NPC_PLUGIN);
  elementListener.on('add', entityElement => {
    npcElement = entityElement;
  });
  elementListener.on('remove', () => {
    npcElement = null;
  });

  return () => {
    const bowApi = {
      asset: 'ITEM.BOW',
      itemAddedCallback(grabbable) {
        let grabbed = false;
        const _grab = e => {
          grabbable.setLocalTransform(localPositionVector.toArray(), localRotationQuaterion.toArray(), oneVector.toArray());

          grabbed = true;
        };
        grabbable.on('grab', _grab);
        const _release = e => {
          grabbable.setLocalTransform(zeroVector.toArray(), zeroQuaternion.toArray(), oneVector.toArray());

          grabbed = false;
        };
        grabbable.on('release', _release);

        const ray = new THREE.Ray();
        const direction = new THREE.Vector3();
        const _update = () => {
          if (grabbed && npcElement) {
            // XXX
          }
        };
        render.on('update', _update);

        grabbable[dataSymbol] = {
          cleanup: () => {
            grabbable.removeListener('grab', _grab);
            grabbable.removeListener('release', _release);

            render.removeListener('update', _update);
          },
        };
      },
      itemRemovedCallback(grabbable) {
        const {[dataSymbol]: {cleanup}} = grabbable;
        cleanup();

        delete grabbable[dataSymbol];
      },
    };
    items.registerItem(this, bowApi);

    const bowRecipe = {
      output: 'ITEM.BOW',
      width: 2,
      height: 3,
      input: [
        null, 'ITEM.WOOD',
        'ITEM.WOOD', null,
        null, 'ITEM.WOOD',
      ],
    };
    items.registerRecipe(this, bowRecipe);

    return () => {
      elements.destroyListener(elementListener);

      items.unregisterItem(this, bowApi);
      items.unregisterRecipe(this, bowRecipe);
    };
  };
};

module.exports = bow;

/* const ARROW_SPEED = 0.05;
const ARROW_GRAVITY = -10 / 1000 * 0.001;
const ARROW_TERMINAL_VELOCITY = -10;
const ARROW_TTL = 5 * 1000;

const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];
const SIDES = ['left', 'right'];

class ZBow {
  mount() {
    return;
    const {three: {THREE, scene}, input, elements, render, pose, hands, player, utils: {geometry: geometryUtils}} = zeo;

    const zeroVector = new THREE.Vector3();
    const backVector = new THREE.Vector3(0, 0, -1);

    const bowGeometry = (() => {
      const coreGeometry = new THREE.TorusBufferGeometry(1, 0.02, 3, 3, Math.PI / 2)
        .applyMatrix(new THREE.Matrix4().makeRotationZ(-Math.PI / 4))
        .applyMatrix(new THREE.Matrix4().makeRotationY(Math.PI / 2))
        .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, 1 - 0.04, 0));
      const topGeometry = new THREE.BoxBufferGeometry(0.035, 0.1, 0.02)
        .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.7 + (0.1 / 2), 0.26 - (0.02 / 2)));
      const bottomGeometry = new THREE.BoxBufferGeometry(0.035, 0.1, 0.02)
        .applyMatrix(new THREE.Matrix4().makeTranslation(0, -0.7 - (0.1 / 2), 0.26 - (0.02 / 2)));

      return geometryUtils.concatBufferGeometry([coreGeometry, topGeometry, bottomGeometry])
        .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
    })();
    const weaponMaterial = new THREE.MeshPhongMaterial({
      color: 0x808080,
      shading: THREE.FlatShading,
    });
    const stringMaterial = new THREE.LineBasicMaterial({
      color: 0x000000,
      // transparent: true,
    });
    const arrowMaterial = new THREE.MeshPhongMaterial({
      color: 0xCCCCCC,
      shading: THREE.FlatShading,
    });

    const bowEntity = {
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0.5, 1.2, 0,
            0, 0, 0, 1,
            1, 1, 1,
          ],
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = entityElement.getEntityApi();
        const entityObject = entityElement.getObject();

        const mesh = (() => {
          const mesh = new THREE.Object3D();

          const coreMesh = (() => {
            const geometry = bowGeometry;
            const material = weaponMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
          })();
          mesh.add(coreMesh);

          const stringMesh = (() => {
            const geometry = new THREE.Geometry();
            geometry.vertices.push(
              new THREE.Vector3(0, 0, 0.7),
              zeroVector,
              zeroVector,
              new THREE.Vector3(0, 0, -0.7)
            );
            const material = stringMaterial;

            const mesh = new THREE.LineSegments(geometry, material);
            mesh.position.y = 0.26;
            mesh.frustumCulled = false;

            mesh.pullPosition = zeroVector;
            mesh.updatePull = (position = null) => {
              const pullPosition = position !== null ? position.clone().applyMatrix4(new THREE.Matrix4().getInverse(mesh.matrixWorld)) : zeroVector;
              for (let i = 1; i <= 2; i++) {
                geometry.vertices[i] = pullPosition;
              }
              geometry.verticesNeedUpdate = true;

              mesh.pullPosition = pullPosition;
            };

            return mesh;
          })();
          mesh.add(stringMesh);
          mesh.stringMesh = stringMesh;

          return mesh;
        })();
        entityObject.add(mesh);

        const arrows = [];

        const arrowGeometry = (() => {
          const coreGeometry = new THREE.BoxBufferGeometry(0.01, 0.01, 0.75);
          const tipGeometry = new THREE.CylinderBufferGeometry(0, 0.015, 0.04, 3, 1)
            .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(0.75 / 2) - (0.04 / 2)));
          const fletchingGeometry1 = new THREE.CylinderBufferGeometry(0, 0.015, 0.2, 2, 1)
            .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, (0.75 / 2) - (0.2 / 2) - 0.01));
          const fletchingGeometry2 = new THREE.CylinderBufferGeometry(0, 0.015, 0.2, 2, 1)
            .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
            .applyMatrix(new THREE.Matrix4().makeRotationZ(Math.PI / 2))
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, (0.75 / 2) - (0.2 / 2) - 0.01));

          return geometryUtils.concatBufferGeometry([coreGeometry, tipGeometry, fletchingGeometry1, fletchingGeometry2])
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -0.75 / 2));
        })();
        const _makeArrowMesh = () => {
          const geometry = arrowGeometry;
          const material = arrowMaterial;

          const arrowMesh = new THREE.Mesh(geometry, material);
          arrowMesh.startTime = 0;
          arrowMesh.lastTime = 0;
          arrowMesh.velocity = null;

          arrowMesh.updatePull = (position = null) => {
            const {stringMesh} = mesh;

            const pullPosition = position !== null ? position : stringMesh.getWorldPosition();
            arrowMesh.position.copy(pullPosition);

            const pullAngle = mesh.getWorldPosition()
              .sub(pullPosition)
              .normalize();
            arrowMesh.quaternion.setFromUnitVectors(
              new THREE.Vector3(0, 0, -1),
              pullAngle
            );

            arrowMesh.updateMatrixWorld();
          };

          return arrowMesh;
        };

        entityApi.position = DEFAULT_MATRIX;
        entityApi.align = () => {
          const {position} = entityApi;

          entityObject.position.set(position[0], position[1], position[2]);
          entityObject.quaternion.set(position[3], position[4], position[5], position[6]);
          entityObject.scale.set(position[7], position[8], position[9]);

          bowGrabbable.setState(
            [position[0], position[1], position[2]],
            [position[3], position[4], position[5], position[6]],
            [position[7], position[8], position[9]]
          );
        };

        const _makeArrowState = () => ({
          grabbed: false,
          pulling: false,
          drawnArrowMesh: null,
          nockedArrowMesh: null,
        });
        const bowStates = {
          left: _makeArrowState(),
          right: _makeArrowState(),
        };

        const _getOtherSide = side => side === 'left' ? 'right' : 'left';

        const bowGrabbable = hands.makeGrabbable('bow');
        const _grab = e => {
          const {userId} = e;

          if (userId) {
            const {side} = e;
            const bowState = bowStates[side];

            bowState.grabbed = true;
          }
        };
        bowGrabbable.on('grab', _grab);
        const _release = e => {
          const {userId} = e;

          if (userId === player.getId()) {
            const {side} = e;
            const bowState = bowStates[side];

            bowState.grabbed = false;

            SIDES.forEach(side => {
              const bowState = bowStates[side];
              const {pulling, drawnArrowMesh, nockedArrowMesh} = bowState;

              if (pulling) {
                bowState.pulling = false;
              }
              if (drawnArrowMesh) {
                drawnArrowMesh.parent.remove(drawnArrowMesh);
                bowState.drawnArrowMesh = null;
              }
              if (nockedArrowMesh) {
                scene.remove(nockedArrowMesh);
                bowState.nockedArrowMesh = null;
              }
            });
          }
        };
        bowGrabbable.on('release', _release);
        const _grabbableUpdate = e => {
          const {position, rotation, scale} = e;

          entityObject.position.fromArray(position);
          entityObject.quaternion.fromArray(rotation);
          entityObject.scale.fromArray(scale);
          entityObject.updateMatrixWorld();
        };
        bowGrabbable.on('update', _grabbableUpdate);

        const _gripdown = e => {
          const {side} = e;
          const otherSide = _getOtherSide(side);
          const otherBowState = bowStates[otherSide];
          const {grabbed: otherGrabbed} = otherBowState;

          if (otherGrabbed) {
            const {gamepads} = pose.getStatus();
            const gamepad = gamepads[side];

            if (gamepad) {
              const {worldPosition: controllerPosition} = gamepad;
              const {stringMesh} = mesh;
              const stringMeshPosition = stringMesh.getWorldPosition();
              const bowState = bowStates[side];

              if (controllerPosition.distanceTo(stringMeshPosition) < 0.1) {
                bowState.pulling = true;
              } else {
                const controllerMeshes = player.getControllerMeshes();
                const controllerMesh = controllerMeshes[side];

                const arrow = _makeArrowMesh();
                controllerMesh.add(arrow);
                bowState.drawnArrowMesh = arrow;

                // input.vibrate(side, 1, 20);
              }

              e.stopImmediatePropagation();
            }
          }
        };
        input.on('gripdown', _gripdown, {
          priority: 1,
        });
        const _gripup = e => {
          const {side} = e;
          const bowState = bowStates[side];
          const {pulling, drawnArrowMesh} = bowState;

          if (pulling) {
            bowState.pulling = false;

            const otherSide = _getOtherSide(side);
            const otherBowState = bowStates[otherSide];
            const {nockedArrowMesh} = otherBowState;
            if (nockedArrowMesh) {
              const arrow = nockedArrowMesh;
              arrows.push(arrow);

              const now = Date.now();
              arrow.startTime = now;
              arrow.lastTime = now;
              const {stringMesh} = mesh;
              const {pullPosition} = stringMesh;
              arrow.velocity = new THREE.Vector3(0, 0, -ARROW_SPEED * pullPosition.length()).applyQuaternion(arrow.quaternion);

              otherBowState.nockedArrowMesh = null;
            }
          }
          if (drawnArrowMesh) {
            drawnArrowMesh.parent.remove(drawnArrowMesh);
            bowState.drawnArrowMesh = null;
          }
        };
        input.on('gripup', _gripup, {
          priority: 1,
        });

        const _update = () => {
          const {gamepads} = pose.getStatus();

          const _updateNock = () => {
            SIDES.forEach(side => {
              const bowState = bowStates[side];
              const {drawnArrowMesh} = bowState;
              const otherSide = _getOtherSide(side);
              const otherBowState = bowStates[otherSide];
              const {nockedArrowMesh} = otherBowState;

              if (drawnArrowMesh) {
                if (!nockedArrowMesh) {
                  const {stringMesh} = mesh;
                  const stringPosition = stringMesh.getWorldPosition();
                  const drawnArrowPosition = drawnArrowMesh.getWorldPosition();

                  if (drawnArrowPosition.distanceTo(stringPosition) < 0.1) {
                    bowState.drawnArrowMesh = null;

                    const nockedArrowMesh = drawnArrowMesh;
                    scene.add(nockedArrowMesh);
                    otherBowState.nockedArrowMesh = nockedArrowMesh;
                  }
                } else {
                  drawnArrowMesh.parent.remove(drawnArrowMesh);

                  bowState.drawnArrowMesh = null;
                }
              }
            });
          };
          const _updateString = () => {
            const _updatePull = (position = null) => {
              const {stringMesh} = mesh;
              stringMesh.updatePull(position);

              const nockedArrowMesh = (() => {
                for (let s = 0; s < SIDES.length; s++) {
                  const side = SIDES[s];
                  const bowState = bowStates[side];
                  const {nockedArrowMesh} = bowState;

                  if (nockedArrowMesh) {
                    return nockedArrowMesh;
                  }
                }

                return null;
              })();
              if (nockedArrowMesh) {
                nockedArrowMesh.updatePull(position);
              }
            };

            const somePulling = SIDES.some(side => {
              const bowState = bowStates[side];
              const {pulling} = bowState;

              if (pulling) {
                const gamepad = gamepads[side];

                if (gamepad) {
                  const {worldPosition: controllerPosition} = gamepad;
                  _updatePull(controllerPosition);
                } else {
                  _updatePull();
                }

                return true;
              } else {
                return false;
              }
            });
            if (!somePulling) {
              _updatePull();
            }
          };
          const _updateArrows = () => {
            const now = Date.now();

            const oldArrows = arrows.slice();
            for (let i = 0; i < oldArrows.length; i++) {
              const arrow = oldArrows[i];
              const {startTime} = arrow;
              const timeSinceStart = now - startTime;

              if (timeSinceStart < ARROW_TTL) {
                const {lastTime} = arrow;
                const timeDiff = now - lastTime;

                const {velocity} = arrow;
                arrow.position.add(velocity.clone().multiplyScalar(timeDiff))
                arrow.quaternion.setFromUnitVectors(
                  backVector,
                  velocity.clone().normalize()
                );
                arrow.updateMatrixWorld();

                velocity.y = Math.max(velocity.y + (ARROW_GRAVITY * timeDiff), ARROW_TERMINAL_VELOCITY);

                arrow.lastTime = now;
              } else {
                scene.remove(arrow);
                arrows.splice(arrows.indexOf(arrow), 1);
              }
            }
          };

          _updateNock();
          _updateString();
          _updateArrows();
        };
        render.on('update', _update);

        entityApi._cleanup = () => {
          entityObject.remove(mesh);

          hands.destroyGrabbable(bowGrabbable);

          input.removeListener('gripdown', _gripdown);
          input.removeListener('gripup', _gripup);

          render.removeListener('update', _update);
        };
      },
      entityRemovedCallback(entityElement) {
        const entityApi = entityElement.getEntityApi();
        entityApi._cleanup();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getEntityApi();

        switch (name) {
          case 'position': {
            entityApi.position = newValue;

            entityApi.align();

            break;
          }
        }
      },
    };
    elements.registerEntity(this, bowEntity);

    this._cleanup = () => {
      elements.unregisterEntity(this, bowEntity);
    };
  }

  unmount() {
    this._cleanup();
  }
} */
