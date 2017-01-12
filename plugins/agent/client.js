class Agent {
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
      '/core/engines/zeo',
    ]).then(([
      zeo,
    ]) => {
      if (live) {
        const {THREE, scene, camera, sound} = zeo;

        const _requestTextToSpeech = s => fetch('/archae/agent/textToSpeech', {
          method: 'POST',
          body: s,
        })
          .then(res => res.blob()
            .then(blob => new Promise((accept, reject) => {
              const url = URL.createObjectURL(blob);
              const audio = document.createElement('audio');
              audio.src = url;
              audio.oncanplaythrough = () => {
                accept(audio);
              };
              audio.onerror = err => {
                reject(err);

                _cleanup();
              };
              audio.destroy = () => {
                _cleanup();
              };

              const _cleanup = () => {
                URL.revokeObjectURL(url);
              };
            }))
          );

        class AgentElement extends HTMLElement {
          static get tag() {
            return 'agent';
          }
          static get attributes() {
            return {
              position: {
                type: 'matrix',
                value: [
                  1, 1, 0,
                  0, 0, 0, 1,
                  1, 1, 1,
                ],
              },
              text: {
                type: 'text',
                value: 'Welcome to Zeo shell!',
              },
            };
          }

          createdCallback() {
            this.position = null;
            this.text = null;

            this._cancelRequest = null;

            this._cleanup = () => {
              const {mesh, audio, _cancelRequest: cancelRequest} = this;
              if (mesh) {
                scene.remove(mesh);
              }
              if (audio) {
                audio.destroy();
              }
              if (cancelRequest) {
                cancelRequest();
              }
            };

            const mesh = (() => {
              const geometry = new THREE.BoxBufferGeometry(0.1, 0.1, 0.1);
              const material = new THREE.MeshPhongMaterial({
                color: 0xFF0000,
                shininess: 0,
              });

              return new THREE.Mesh(geometry, material);
            })();
            scene.add(mesh);
            this.mesh = mesh;

            const soundBody = (() => {
              const result = new sound.Body();
              // result.setInput(audio);
              result.setObject(mesh);
              return result;
            })();
            this.soundBody = soundBody;

            this.text = null;

            this.audio = null;
            this._cancelRequest = null;
          }

          destructor() {
            this._cleanup();
          }

          attributeValueChangedCallback(name, oldValue, newValue) {
            switch (name) {
              case 'position': {
                this.position = newValue;

                this._updateMesh();

                break;
              }
              case 'text': {
                this.text = newValue;

                this._updateAudio();

                break;
              }
            }
          }

          _updateMesh() {
            const {mesh, position} = this;

            if (mesh && position) {
              mesh.position.set(position[0], position[1], position[2]);
              mesh.quaternion.set(position[3], position[4], position[5], position[6]);
              mesh.scale.set(position[7], position[8], position[9]);
            }
          }

          _updateAudio() {
            const {text, _cancelRequest: cancelRequest} = this;

            if (cancelRequest) {
              cancelRequest();
              this._cancelRequest = null;
            }

            if (text) {
              let live = true;
              this._cancelRequest = () => {
                live = false;
              };

              _requestTextToSpeech(text)
                .then(newAudio => {
                  if (live) {
                    const {soundBody, oldAudio} = this;

                    if (oldAudio) {
                      oldAudio.destroy();
                    }

                    soundBody.setInput(newAudio);
                    this.audio = newAudio;

                    this._cancelRequest = null;
                  }
                });
            }
          }
        }
        zeo.registerElement(AgentElement);

        this._cleanup = () => {
          zeo.unregisterElement(AgentElement);
        };

        return {};
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Agent;
