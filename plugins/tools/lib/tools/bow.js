const NPC_PLUGIN = 'plugins-npc';
const OTHER_SIDES = {
  left: 'right',
  right: 'left',
};
const ARROW_SPEED = 0.05;
const ARROW_GRAVITY = -10 / 1000 * 0.001;
const ARROW_TERMINAL_VELOCITY = -10;
const ARROW_TTL = 5 * 1000;
const ARROW_LENGTH = 0.5;

const dataSymbol = Symbol();

const bow = ({recipes, data}) => {
  const {three, pose, input, render, elements, items, player, teleport, utils: {geometry: geometryUtils, sprite: spriteUtils}} = zeo;
  const {THREE, scene} = three;
  const {arrowGeometrySpec} = data;

  const localTransformPositionVector = new THREE.Vector3(0.015 * 1.5, 0, 0.015/2 + 0.015 * 3 * 3);
  const localTransformRotationQuaterion = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    Math.PI / 4
  ).premultiply(new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(1, 0, 0)
  ));
  const localTransformScaleVector = new THREE.Vector3(3, 3, 3);
  const localVector = new THREE.Vector3();
  const localVector2 = new THREE.Vector3();
  const localQuaternion = new THREE.Quaternion();
  const localMatrix = new THREE.Matrix4();
  const localRay = new THREE.Ray();
  const zeroVector = new THREE.Vector3();
  const oneVector = new THREE.Vector3(1, 1, 1);
  const forwardVector = new THREE.Vector3(0, 0, -1);
  const upVector = new THREE.Vector3(0, 1, 0);
  const zeroQuaternion = new THREE.Quaternion();
  const forwardQuaternion = new THREE.Quaternion().setFromUnitVectors(upVector, forwardVector);
  const stringGeometry = (() => {
    const geometry = new THREE.BoxBufferGeometry(0.015, 1, 0.015, 1, 2, 1)
      .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, -1)
      )))
      .applyMatrix(new THREE.Matrix4().makeScale(3, 3, 3 * 0.275));
    geometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').array.length), 3));
    return geometry;
  })();
  const stringGeometryPositions = stringGeometry.getAttribute('position').array;
  const numPositions = stringGeometryPositions.length / 3;
  const centerPositionIndexes = [];
  const centerPositions = [];
  for (let i = 0; i < numPositions; i++) {
    const baseIndex = i * 3;
    if (Math.abs(stringGeometryPositions[baseIndex + 2]) < 0.001) {
      centerPositionIndexes.push(baseIndex);
      centerPositions.push(
        stringGeometryPositions[baseIndex + 0],
        stringGeometryPositions[baseIndex + 1],
        stringGeometryPositions[baseIndex + 2]
      );
    }
  }
  const arrowGeometry = (() => {
    const {positions, normals, colors, dys} = arrowGeometrySpec;
    const geometry = new THREE.BufferGeometry();
    geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.addAttribute('dy', new THREE.BufferAttribute(dys, 2));
    geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(),
      1
    );
    return geometry;
  })();
  const stringMaterial = new THREE.MeshBasicMaterial({
    vertexColors: THREE.VertexColors,
  });

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
        const arrows = [];

        const stringMesh = (() => {
          const geometry = stringGeometry.clone();
          const material = stringMaterial;

          const stringMesh = new THREE.Mesh(geometry, material);
          stringMesh.frustumCulled = false;
          stringMesh.pullPosition = new THREE.Vector3();
          stringMesh.updatePull = position => {
            const pullPosition = position !== null ?
              localVector.copy(position)
                .applyMatrix4(localMatrix.getInverse(stringMesh.matrixWorld))
            :
              zeroVector;
            const positionAttribute = geometry.getAttribute('position');
            const positions = positionAttribute.array;
            for (let i = 0; i < centerPositionIndexes.length; i++) {
              const index = centerPositionIndexes[i];
              positions[index + 0] = centerPositions[i * 3 + 0] + pullPosition.x;
              positions[index + 1] = centerPositions[i * 3 + 1] + pullPosition.y;
              positions[index + 2] = centerPositions[i * 3 + 2] + pullPosition.z;
            }
            positionAttribute.needsUpdate = true;

            stringMesh.pullPosition.copy(pullPosition);
          };
          return stringMesh;
        })();
        scene.add(stringMesh);

        const _makeArrowMesh = () => {
          const geometry = arrowGeometry;
          const material = stringMaterial;

          const arrowMesh = new THREE.Mesh(geometry, material);
          arrowMesh.startTime = 0;
          arrowMesh.lastTime = 0;
          arrowMesh.velocity = new THREE.Vector3();
          arrowMesh.updatePull = position => {
            if (position !== null) {
              arrowMesh.position.copy(position);
              arrowMesh.quaternion.setFromRotationMatrix(localMatrix.lookAt(
                position,
                grabbable.position,
                localVector.copy(upVector)
                  .applyQuaternion(
                    localQuaternion.copy(stringMesh.quaternion)
                      .multiply(forwardQuaternion)
                  )
              ));
            } else {
              arrowMesh.position.copy(stringMesh.position);
              arrowMesh.quaternion.copy(stringMesh.quaternion)
                .multiply(forwardQuaternion);
            }
            arrowMesh.updateMatrixWorld();
          };

          return arrowMesh;
        };

        const _grab = e => {
          grabbable.setLocalTransform(localTransformPositionVector, localTransformRotationQuaterion, localTransformScaleVector);
          stringMesh.visible = true;
        };
        grabbable.on('grab', _grab);
        const _release = e => {
          grabbable.setLocalTransform(zeroVector, zeroQuaternion, oneVector);
          stringMesh.visible = false;
        };
        grabbable.on('release', _release);

        let pulling = false;
        let nockedArrowMesh = null;
        let drawnArrowMesh = null;
        const _gripdown = e => {
          const {side} = e;
          const otherSide = OTHER_SIDES[side];

          if (grabbable.isGrabbed() && grabbable.getGrabberSide() === otherSide) {
            const {gamepads} = pose.getStatus();
            const gamepad = gamepads[side];
            const {worldPosition: controllerPosition} = gamepad;
            stringMesh.getWorldPosition(localVector);

            if (controllerPosition.distanceTo(localVector) < 0.1) {
              pulling = true;
            } else {
              drawnArrowMesh = _makeArrowMesh();
              scene.add(drawnArrowMesh);

              // input.vibrate(side, 1, 20);
            }

            e.stopImmediatePropagation();
          }
        };
        input.on('gripdown', _gripdown, {
          priority: 1,
        });
        const _gripup = e => {
          const {side} = e;
          const otherSide = OTHER_SIDES[side];

          if (pulling && grabbable.getGrabberSide() === otherSide) {
            pulling = false;

            if (nockedArrowMesh) {
              const arrow = nockedArrowMesh;
              arrows.push(arrow);

              const now = Date.now();
              arrow.startTime = now;
              arrow.lastTime = now;
              arrow.velocity.set(0, 0, -ARROW_SPEED * stringMesh.pullPosition.length())
                .applyQuaternion(arrow.quaternion);

              nockedArrowMesh = null;
            }
          }
          if (drawnArrowMesh) {
            scene.remove(drawnArrowMesh);
            drawnArrowMesh = null;
          }
        };
        input.on('gripup', _gripup, {
          priority: 1,
        });

        let lastPulling = false;
        const _update = () => {
          const {gamepads} = pose.getStatus();

          const _updateStringPosition = () => {
            if (grabbable.isGrabbed()) {
              const side = grabbable.getGrabberSide();
              const gamepad = gamepads[side];
              const {worldPosition: controllerPosition, worldRotation: controllerRotation} = gamepad;
              stringMesh.position.copy(controllerPosition)
                .add(localVector.set(0, 0.015 * 4.6 * 3, 0).applyQuaternion(controllerRotation));
              stringMesh.quaternion.copy(controllerRotation);
              stringMesh.updateMatrixWorld();
            }
          };
          const _updateDrawnArrow = () => {
            if (drawnArrowMesh) {
              const _updateTransform = () => {
                const side = grabbable.getGrabberSide();
                const otherSide = OTHER_SIDES[side];
                const gamepad = gamepads[otherSide];
                const {worldPosition: controllerPosition, worldRotation: controllerRottion, worldScale: controllerScale} = gamepad;
                drawnArrowMesh.position.copy(controllerPosition);
                drawnArrowMesh.quaternion.copy(controllerRottion);
                drawnArrowMesh.scale.copy(controllerScale);
                drawnArrowMesh.updateMatrixWorld();
              };

              if (!nockedArrowMesh) {
                if (stringMesh.getWorldPosition(localVector).distanceTo(drawnArrowMesh.getWorldPosition(localVector2)) < 0.1) {
                  nockedArrowMesh = drawnArrowMesh;
                  drawnArrowMesh = null;
                } else {
                  _updateTransform();
                }
              } else {
                _updateTransform();
              }
            }
          };
          const _updatePull = () => {
            const position = pulling ? gamepads[OTHER_SIDES[grabbable.getGrabberSide()]].worldPosition : null;

            if (pulling || lastPulling) {
              stringMesh.updatePull(position);
            }
            if (nockedArrowMesh) {
              nockedArrowMesh.updatePull(position);
            }

            lastPulling = pulling;
          };
          const _updateArrows = () => {
            if (arrows.length > 0) {
              const now = Date.now();

              const removedArrows = [];
              for (let i = 0; i < arrows.length; i++) {
                const arrow = arrows[i];
                const timeSinceStart = now - arrow.startTime;

                if (timeSinceStart < ARROW_TTL) {
                  const _hitNpc = () => {
                    if (npcElement) {
                      localVector.copy(arrow.velocity).normalize();
                      localRay.set(arrow.position, arrow.velocity);
                      const hitNpc = npcElement.getHitNpc(localRay, ARROW_LENGTH);

                      if (hitNpc) {
                        hitNpc.attack();

                        removedArrows.push(arrow);

                        return true;
                      } else {
                        return false;
                      }
                    } else {
                      return false;
                    }
                  };
                  const _advanceArrow = () => {
                    const {velocity} = arrow;
                    const timeDiff = now - arrow.lastTime;
                    arrow.position.add(localVector.copy(velocity).multiplyScalar(timeDiff));
                    arrow.quaternion.setFromRotationMatrix(localMatrix.lookAt(
                      arrow.position,
                      localVector.copy(arrow.position)
                        .add(velocity),
                      upVector
                    ));
                    arrow.updateMatrixWorld();

                    velocity.y = Math.max(velocity.y + (ARROW_GRAVITY * timeDiff), ARROW_TERMINAL_VELOCITY);

                    arrow.lastTime = now;

                    return true;
                  };

                  _hitNpc() || _advanceArrow();
                } else {
                  removedArrows.push(arrow);
                }
              }
              for (let i = 0; i < removedArrows.length; i++) {
                const arrow = removedArrows[i];
                scene.remove(arrow);
                arrows.splice(arrows.indexOf(arrow), 1);
              }
            }
          };

          _updateStringPosition();
          _updateDrawnArrow();
          _updatePull();
          _updateArrows();
        };
        render.on('update', _update);

        grabbable[dataSymbol] = {
          cleanup: () => {
            scene.remove(stringMesh);

            grabbable.removeListener('grab', _grab);
            grabbable.removeListener('release', _release);

            input.removeListener('gripdown', _gripdown);
            input.removeListener('gripup', _gripup);

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
    recipes.register(bowRecipe);

    return () => {
      stringMaterial.dispose();

      elements.destroyListener(elementListener);

      items.unregisterItem(this, bowApi);
      recipes.unregister(bowRecipe);
    };
  };
};

module.exports = bow;
