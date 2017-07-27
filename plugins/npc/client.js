const sfxr = require('sfxr');
const animalLib = require('animal-js');

const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
const dataSymbol = Symbol();

class Mobs {
  mount() {
    const {three, pose, elements, input, render, stage, utils: {network: networkUtils, random: randomUtils, skin: skinUtils}} = zeo;
    const {THREE} = three;
    const {AutoWs} = networkUtils;
    const {chnkr} = randomUtils;
    const {skin} = skinUtils;
    const animal = animalLib(THREE);

    const upVector = new THREE.Vector3(0, 1, 0);
    const zeroQuaternion = new THREE.Quaternion();

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return sfxr.requestSfx('archae/mobs/sfx/hurt1.ogg')
      .then(hurtSfx => {
        if (live) {
          const npcEntity = {
            entityAddedCallback(entityElement) {
              const meshes = {};

              const headRotation = new THREE.Quaternion();
              const _updateMesh = (id, mesh, animation, hit, uniforms, now, heightfieldElement) => {
                _updateAnimation(id, mesh, animation, uniforms, now);
                _updateElevation(mesh, heightfieldElement);
                _updateHit(mesh, hit, uniforms, now);

                mesh.updateMatrixWorld();
              };
              const _updateAnimation = (id, mesh, animation, uniforms, now) => {
                if (animation) {
                  const {mode, positionStart, positionEnd, rotationStart, rotationEnd, headRotationStart, headRotationEnd, duration, startTime} = animation;

                  if (mode === 'walk') {
                    const positionFactor = Math.min((now - startTime) / duration, 1);
                    const rotationFactor = Math.pow(Math.min((now - startTime) / (duration / 4), 1), 0.5);
                    const headRotationFactor = Math.pow(Math.min((now - startTime) / (duration / 8), 1), 0.5);

                    mesh.position.copy(positionStart)
                      .lerp(positionEnd, positionFactor);
                    mesh.offset.set(0, 0, 0);
                    mesh.quaternion.copy(rotationStart)
                      .slerp(rotationEnd, rotationFactor);

                    headRotation.copy(headRotationStart).slerp(headRotationEnd, headRotationFactor);
                    uniforms.headRotation.value.set(headRotation.x, headRotation.y, headRotation.z, headRotation.w);
                    const velocity = positionStart.distanceTo(positionEnd) / duration;
                    const angleRate = 1.5 / velocity;
                    uniforms.theta.value =
                      Math.sin((now % angleRate) / angleRate * Math.PI * 2) * 0.75 *
                      Math.pow(Math.sin(positionFactor * Math.PI), 0.5);

                    if (positionFactor >= 1) {
                      mesh.animation = null;
                    }
                  } else if (mode === 'hit') {
                    const positionFactor = Math.min((now - startTime) / duration, 1);
                    const rotationFactor = Math.pow(Math.min((now - startTime) / (duration / 4), 1), 0.5);
                    const headRotationFactor = Math.pow(Math.min((now - startTime) / (duration / 8), 1), 0.5);

                    mesh.position.copy(positionStart)
                      .lerp(positionEnd, positionFactor);
                    mesh.offset
                      .set(0, 1, 0)
                      .multiplyScalar(
                        -Math.pow(((positionFactor - 0.5) * 2), 2) + 1
                      );
                    mesh.quaternion.copy(rotationStart)
                      .slerp(rotationEnd, rotationFactor);

                    uniforms.headRotation.value.set(zeroQuaternion.x, zeroQuaternion.y, zeroQuaternion.z, zeroQuaternion.w);
                    uniforms.theta.value = 0;

                    if (positionFactor >= 1) {
                      mesh.animation = null;
                    }
                  } else if (mode === 'die') {
                    const v = Math.min((now - startTime) / duration, 1);

                    if (v < 0.5) {
                      const positionFactor = v * 2;
                      const rotationFactor = Math.pow(v * 2, 0.5);

                      mesh.position.copy(positionStart)
                        .lerp(positionEnd, positionFactor);
                      mesh.offset
                        .set(0, 1, 0)
                        .multiplyScalar(
                          -Math.pow(((positionFactor - 0.5) * 2), 2) + 1
                        );
                      mesh.quaternion.copy(rotationStart)
                        .slerp(rotationEnd, rotationFactor);
                    } else {
                      mesh.position.copy(positionEnd);
                      mesh.offset.set(0, 0, 0);
                      mesh.quaternion.copy(rotationEnd);
                    }

                    uniforms.headRotation.value.set(zeroQuaternion.x, zeroQuaternion.y, zeroQuaternion.z, zeroQuaternion.w);
                    uniforms.theta.value = 0;

                    if (v >= 1) {
                      stage.remove('main', mesh);
                      mesh.destroy();
                      delete meshes[id];
                    }
                  }
                }
              };
              const _updateElevation = (mesh, heightfieldElement) => {
                if (heightfieldElement && heightfieldElement.getElevation) {
                  const elevation = heightfieldElement.getElevation(mesh.position.x, mesh.position.z);

                  if (mesh.position.y !== elevation) {
                    mesh.position.y = elevation;
                  }
                }

                mesh.position.add(mesh.offset);
              };
              const _updateHit = (mesh, hit, uniforms, now) => {
                if (hit) {
                  const {startTime} = hit;
                  const timeDiff = now - startTime;

                  if (timeDiff < 300) {
                    uniforms.hit.value = 1;
                  } else {
                    uniforms.hit.value = 0;
                    mesh.hit = null;
                  }
                }
              };
              const _makeNpcMesh = skinName => skin(`/archae/mobs/npc/img/${skinName}.png`);
              const _makeAnimalMesh = skinName => animal(
                `/archae/mobs/animal/img/${skinName}.png`,
                `/archae/mobs/animal/models/${skinName}.dat`
              );
              const _makeMesh = (id, type, skinName) => {
                const mesh = (() => {
                  if (type === 'npc') {
                    return _makeNpcMesh(skinName);
                  } else if (type === 'animal') {
                    return _makeAnimalMesh(skinName);
                  } else {
                    console.warn('invalid npc type', JSON.stringify(type));
                    return null;
                  }
                })();

                mesh.offset = new THREE.Vector3(0, 0, 0);
                mesh.lastHitTime = -Infinity;
                mesh.animation = null;
                mesh.hit = null;

                const direction = new THREE.Vector3();
                mesh.attack = () => {
                  const {hmd} = pose.getStatus();
                  const {worldPosition: hmdPosition} = hmd;
                  direction.copy(mesh.position)
                  direction.y += mesh.size.y / 2;
                  direction.sub(hmdPosition);
                  direction.y = 0;
                  direction.normalize();

                  const e = {
                    method: 'attackMob',
                    args: [
                      id,
                      mesh.position.toArray(),
                      direction.toArray(),
                      30,
                    ],
                  };
                  const es = JSON.stringify(e);
                  connection.send(es);

                  mesh.lastHitTime = Date.now();
                };

                const uniforms = (() => {
                  if (type === 'npc') {
                    const uniforms = THREE.UniformsUtils.clone(skin.SKIN_SHADER.uniforms);
                    uniforms.leftArmRotation.value.set(zeroQuaternion.x, zeroQuaternion.y, zeroQuaternion.z, zeroQuaternion.w);
                    uniforms.rightArmRotation.value.set(zeroQuaternion.x, zeroQuaternion.y, zeroQuaternion.z, zeroQuaternion.w);
                    uniforms.headVisible.value = 1;
                    return uniforms;
                  } else if (type === 'animal') {
                    const uniforms = THREE.UniformsUtils.clone(animal.ANIMAL_SHADER.uniforms);
                    return uniforms;
                  } else {
                    console.warn('invalid npc type', JSON.stringify(type));
                    return null;
                  }
                })();
                mesh.update = (now, heightfieldElement) => {
                  _updateMesh(id, mesh, mesh.animation, mesh.hit, uniforms, now, heightfieldElement);
                };

                mesh.onBeforeRender = (function(onBeforeRender) {
                  return function() {
                    mesh.material.uniforms.headRotation.value.copy(uniforms.headRotation.value);
                    mesh.material.uniforms.theta.value = uniforms.theta.value;
                    mesh.material.uniforms.hit.value = uniforms.hit.value;

                    if (type === 'npc') {
                      mesh.material.uniforms.leftArmRotation.value.copy(uniforms.leftArmRotation.value);
                      mesh.material.uniforms.rightArmRotation.value.copy(uniforms.rightArmRotation.value);
                      mesh.material.uniforms.headVisible.value = uniforms.headVisible.value;
                    }

                    onBeforeRender.apply(this, arguments);
                  };
                })(mesh.onBeforeRender);

                return mesh;
              };

              const connection = new AutoWs(_relativeWsUrl('archae/mobsWs'));
              connection.on('message', msg => {
                const e = JSON.parse(msg.data);
                const {type} = e;

                if (type === 'mobAdd') {
                  const {id, spec} = e;
                  const {type, skinName, position, rotation, health} = spec;

                  let mesh = meshes[id];
                  if (!mesh) {
                    mesh = _makeMesh(id, type, skinName);
                    stage.add('main', mesh);
                    meshes[id] = mesh;
                  }

                  mesh.position.fromArray(position);
                  mesh.quaternion.fromArray(rotation);
                  mesh.updateMatrixWorld();
                } else if (type === 'mobRemove') {
                  const {id} = e;

                  const mesh = meshes[id];
                  stage.remove('main', mesh);
                  mesh.destroy();
                  delete meshes[id];
                } else if (type === 'mobAnimation') {
                  const {id, animation} = e;
                  const {mode, positionStart, positionEnd, rotationStart, rotationEnd, headRotationStart, headRotationEnd, duration} = animation;

                  const now = Date.now();

                  const mesh = meshes[id];
                  mesh.animation = {
                    mode: mode,
                    positionStart: new THREE.Vector3().fromArray(positionStart),
                    positionEnd: new THREE.Vector3().fromArray(positionEnd),
                    rotationStart: new THREE.Quaternion().fromArray(rotationStart),
                    rotationEnd: new THREE.Quaternion().fromArray(rotationEnd),
                    headRotationStart: new THREE.Quaternion().fromArray(headRotationStart),
                    headRotationEnd: new THREE.Quaternion().fromArray(headRotationEnd),
                    duration: duration,
                    startTime: now,
                  };
                  if (mode === 'hit' || mode === 'die') {
                    mesh.hit = {
                      startTime: now,
                    };

                    hurtSfx.trigger();
                  }
                } else {
                  console.warn('mob unknown message type', JSON.stringify(type));
                }
              });

              const chunker = chnkr.makeChunker({
                resolution: 32,
                range: 1,
              });

              /* const _gripdown = e => {
                const {side} = e;
                const status = pose.getStatus();
                const {gamepads} = status;
                const gamepad = gamepads[side];
                const {worldPosition: controllerPosition} = gamepad;

                const position = new THREE.Vector3();
                const sphere = new THREE.Sphere();
                for (const id in meshes) {
                  const mesh = meshes[id];
                  position.copy(mesh.getWorldPosition());
                  position.y += mesh.size.y / 2;
                  sphere.set(
                    position,
                    Math.max(mesh.size.x, mesh.size.z) / 2
                  );

                  if (sphere.containsPoint(controllerPosition)) {
                    const {hmd} = status;
                    const {worldPosition: hmdPosition} = hmd;
                    const direction = position.copy(mesh.position)
                      .add(new THREE.Vector3(0, 1, 0))
                      .sub(hmdPosition);
                    direction.y = 0;
                    direction.normalize();
                    mesh.attack(direction);

                    e.stopImmediatePropagation();

                    break;
                  }
                }
              };
              input.on('gripdown', _gripdown); */

              const _update = () => {
                const _updateMeshes = () => {
                  const now = Date.now();
                  const heightfieldElement = elements.getEntitiesElement().querySelector(HEIGHTFIELD_PLUGIN);

                  for (const id in meshes) {
                    const mesh = meshes[id];
                    mesh.update(now, heightfieldElement);
                  }
                };
                const _updateMobChunks = () => {
                  const {hmd} = pose.getStatus();
                  const {worldPosition: hmdPosition} = hmd;
                  const {added, removed} = chunker.update(hmdPosition.x, hmdPosition.z);

                  for (let i = 0; i < added.length; i++) {
                    const chunk = added[i];
                    const {x, z} = chunk;
                    const e = {
                      method: 'addChunk',
                      args: [x, z],
                    };
                    const es = JSON.stringify(e);
                    connection.send(es);
                  }

                  for (let i = 0; i < removed.length; i++) {
                    const chunk = removed[i];
                    const {x, z} = chunk;
                    const e = {
                      method: 'removeChunk',
                      args: [x, z],
                    };
                    const es = JSON.stringify(e);
                    connection.send(es);
                  }
                };

                _updateMeshes();
                _updateMobChunks();
              };
              render.on('update', _update);

              const hitCenter = new THREE.Vector3();
              const hitSphere = new THREE.Sphere();
              const hitIntersectionPoint = new THREE.Vector3();
              entityElement.getHitNpc = (ray, length) => {
                const now = Date.now();

                for (const id in meshes) {
                  const mesh = meshes[id];
                  const {lastHitTime} = mesh;
                  const lastHitTimeDiff = now - lastHitTime;

                  if (lastHitTimeDiff > 500) {
                    hitCenter.copy(mesh.position);
                    hitCenter.y += mesh.size.y / 2;
                    hitSphere.set(
                      hitCenter,
                      Math.max(mesh.size.x, mesh.size.z) / 2
                    );

                    if (ray.intersectSphere(hitSphere, hitIntersectionPoint) && hitIntersectionPoint.distanceTo(ray.origin) < length) {
                      return mesh;
                    }
                  }
                }
                return null;
              };

              entityElement[dataSymbol] = {
                _cleanup: () => {
                  for (const id in meshes) {
                    const mesh = meshes[id];
                    stage.remove('main', mesh);
                    mesh.destroy();
                  }

                  // input.removeListener('gripdown', _gripdown);

                  render.removeListener('update', _update);
                },
              };
            },
            entityRemovedCallback(entityElement) {
              const {[dataSymbol]: {_cleanup}} = entityElement;
              _cleanup();
            },
          };
          elements.registerEntity(this, npcEntity);

          this._cleanup = () => {
            elements.unregisterEntity(this, npcEntity);
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

module.exports = Mobs;
