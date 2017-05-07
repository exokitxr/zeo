const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];
const SIDES = ['left', 'right'];

class ZFighter {
  mount() {
    const {three: {THREE, scene}, elements, input, pose, world, render, player, utils: {geometry: geometryUtils}} = zeo;

    let live = true;
    this.cleanup = () => {
      live = false;
    };

    const _requestAudio = src => new Promise((accept, reject) => {
      const audio = document.createElement('audio');

      const _cleanup = () => {
        audio.oncanplaythrough = null;
        audio.onerror = null;
      };

      audio.oncanplaythrough = () => {
        _cleanup();

        accept(audio);
      };
      audio.onerror = () => {
        _cleanup();

        reject(audio);
      };
      audio.crossOrigin = 'Anonymous';
      audio.src = src;
    });

    return Promise.all([
      _requestAudio('archae/z-fighter/audio/kylo1.ogg'),
      _requestAudio('archae/z-fighter/audio/kylo2.ogg'),
      _requestAudio('archae/z-fighter/audio/kylo3.ogg'),
    ])
      .then(([
        kylo1Audio,
        kylo2Audio,
        kylo3Audio,
      ]) => {
        if (live) {
          const fighterComponent = {
            selector: 'fighter[position]',
            attributes: {
              position: {
                type: 'matrix',
                value: [
                  0, 1.2, 0,
                  0, 0, 0, 1,
                  1, 1, 1,
                ],
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

              const lightsaberMesh = (() => {
                const object = new THREE.Object3D();

                const handleMesh = (() => {
                  const geometry = (() => {
                    const sq = n => Math.sqrt((n * n) + (n * n));

                    const handleGeometry = new THREE.BoxBufferGeometry(0.02, 0.02, 0.05);
                    const crossguardGeometry = new THREE.BoxBufferGeometry(0.05, 0.02, 0.02)
                      .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(0.05 / 2) - (0.02 / 2)));

                    return geometryUtils.concatBufferGeometry([handleGeometry, crossguardGeometry]);
                  })();
                  const material = new THREE.MeshPhongMaterial({
                    color: 0x808080,
                  });

                  const mesh = new THREE.Mesh(geometry, material);
                  return mesh;
                })();
                object.add(handleMesh);
                object.handleMesh = handleMesh;

                const bladeMesh = (() => {
                  const geometry = (() => {
                    const sq = n => Math.sqrt((n * n) + (n * n));

                    const coreGeometry = new THREE.BoxBufferGeometry(0.02, 0.02, 1)
                      .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(0.05 / 2) - (1 / 2)));
                    const leftGeometry = new THREE.BoxBufferGeometry(0.1, 0.02, 0.02)
                      .applyMatrix(new THREE.Matrix4().makeTranslation(-0.1 / 2, 0, -(0.05 / 2) - (0.02 / 2)));;
                    const rightGeometry = new THREE.BoxBufferGeometry(0.1, 0.02, 0.02)
                      .applyMatrix(new THREE.Matrix4().makeTranslation(0.1 / 2, 0, -(0.05 / 2) - (0.02 / 2)));;

                    return geometryUtils.concatBufferGeometry([coreGeometry, leftGeometry, rightGeometry]);
                  })();
                  const material = new THREE.MeshPhongMaterial({
                    color: 0xF44336,
                    shading: THREE.FlatShading,
                    transparent: true,
                    opacity: 0.9,
                  });

                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.visible = false;
                  return mesh;
                })();
                object.add(bladeMesh);
                object.bladeMesh = bladeMesh;

                return object;
              })();
              entityObject.add(lightsaberMesh);

              entityApi.color = new THREE.Color(0x000000);
              entityApi.render = () => {
                const {color} = entityApi;
                const {bladeMesh} = lightsaberMesh;

                bladeMesh.material.color.copy(color);
              };

              const _makeLightsaberState = () => ({
                grabbed: false,
                ignited: false,
              });
              const lightsaberStates = {
                left: _makeLightsaberState(),
                right: _makeLightsaberState(),
              };

              const _grab = e => {
                const {detail: {side}} = e;
                const lightsaberState = lightsaberStates[side];

                lightsaberState.grabbed = true;
              };
              entityElement.addEventListener('grab', _grab);
              const _release = e => {
                const {detail: {side}} = e;
                const lightsaberState = lightsaberStates[side];

                lightsaberState.grabbed = false;
                lightsaberState.ignited = false;
              };
              entityElement.addEventListener('release', _release);
              const _triggerdown = e => {
                const {side} = e;
                const lightsaberState = lightsaberStates[side];
                const {grabbed} = lightsaberState;

                if (grabbed) {
                  lightsaberState.ignited = true;

                  const {bladeMesh} = lightsaberMesh;
                  bladeMesh.visible = true;
                }
              };
              input.on('triggerdown', _triggerdown);
              const _triggerup = e => {
                const {side} = e;
                const lightsaberState = lightsaberStates[side];
                const {grabbed} = lightsaberState;

                if (grabbed) {
                  lightsaberState.ignited = false;

                  const {bladeMesh} = lightsaberMesh;
                  bladeMesh.visible = false;
                }
              };
              input.on('triggerup', _triggerup);

              const _update = () => {
                // XXX
              };
              render.on('update', _update);

              entityApi._cleanup = () => {
                entityObject.remove(lightsaberMesh);

                entityElement.removeEventListener('grab', _grab);
                entityElement.removeEventListener('release', _release);

                input.removeListener('triggerdown', _triggerdown);
                input.removeListener('triggerup', _triggerup);

                render.removeListener('update', _update);
              };
            },
            entityRemovedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();

              entityApi._cleanup();
            },
            entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
              const entityApi = entityElement.getComponentApi();
              const entityObject = entityElement.getObject();

              switch (name) {
                case 'position': {
                  const position = newValue;

                  if (position) {
                    entityObject.position.set(position[0], position[1], position[2]);
                    entityObject.quaternion.set(position[3], position[4], position[5], position[6]);
                    entityObject.scale.set(position[7], position[8], position[9]);
                  }

                  break;
                }
                case 'color': {
                  entityApi.color = new THREE.Color(newValue);

                  entityApi.render();

                  break;
                }
              }
            },
          };
          elements.registerComponent(this, fighterComponent);

          this._cleanup = () => {
            elements.unregisterComponent(this, fighterComponent);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = ZFighter;
