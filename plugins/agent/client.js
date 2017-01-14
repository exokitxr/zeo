const WatsonSpeech = require('./lib/watson-speech/watson-speech.js');

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

    const _requestTokens = () => fetch('/archae/agent/tokens')
      .then(res => res.json());

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/zeo',
        '/core/plugins/js-utils',
      ]),
      _requestTokens(),
    ]).then(([
      [zeo, jsUtils],
      {tokens},
    ]) => {
      if (live) {
        const {THREE, scene, camera, sound} = zeo;
        const {events} = jsUtils;
        const {EventEmitter} = events;
        const {tts: ttsToken, stt: sttToken} = tokens;

        const green = new THREE.Color(0x4CAF50);
        const red = new THREE.Color(0xE91E63);

        const _requestTextToSpeech = s => new Promise((accept, reject) => {
          const audio = WatsonSpeech.TextToSpeech.synthesize({
            text: '<voice-transformation type="Custom" glottal_tension="-100%" pitch="100%">' +
              s.replace(/[<>]+/g, '') +
              '</voice-transformation>',
            voice: 'en-US_AllisonVoice',
            autoPlay: false,
            token: ttsToken,
          });
          audio.oncanplay = () => {
            audio.oncanplay = null;

            accept(audio);
          };
          audio.onerror = err => {
            reject(err);
          };
        });
        const _requestSpeechToText = () => {
          const stream = WatsonSpeech.SpeechToText.recognizeMicrophone({
            token: sttToken,
            model: 'en-US_BroadbandModel',
            smart_formatting: true,
            objectMode: true,
            interim_results: true,
            continuous: true,
          });
          stream.on('data', d => {
            const s = d.results.map(({alternatives}) => alternatives[0].transcript).join(' ');
            result.emit('data', s);
          });
          stream.on('end', () => {
            result.emit('end');
          });
          stream.on('error', err => {
            result.emit('error', err);
          });

          const result = new EventEmitter();
          result.stop = () => {
            stream.stop();
          };
          return result;
        };

let stream = null; // XXX integrate this into the actual agent
window.lol = () => {
  stream = _requestSpeechToText();
  stream.on('data', d => {
    console.log(d);
  });
  stream.on('end', () => {
    console.log('end');
  });
  stream.on('error', err => {
    console.warn(err);
  });
};
window.zol = () => {
  stream.stop();
};

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
              const {mesh, _cancelRequest: cancelRequest} = this;
              if (mesh) {
                scene.remove(mesh);
              }
              if (cancelRequest) {
                cancelRequest();
              }
            };

            const box = (() => {
              const mesh = new THREE.Mesh(
                new THREE.BoxBufferGeometry(0.2, 0.2, 0.2),
                new THREE.MeshBasicMaterial({
                  color: 0x333333,
                  wireframe: true,
                  opacity: 0.5,
                  transparent: true,
                })
              );
              mesh.visible = false;
              return mesh;
            })();
            scene.add(box);
            this.box = box;

            const mesh = (() => {
              const geometry = new THREE.BoxBufferGeometry(0.1, 0.1, 0.1);
              const material = new THREE.MeshPhongMaterial({
                color: green,
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

            const update = () => {
              const status = zeo.getStatus();
              const {gamepads: gamepadsStatus} = status;
              const select = ['left', 'right'].some(side => {
                const gamepadStatus = gamepadsStatus[side];

                if (gamepadStatus) {
                  const {position: controllerPosition} = gamepadStatus;
                  return controllerPosition.distanceTo(mesh.position) <= 0.1;
                } else {
                  return false;
                }
              });

              mesh.material.color = select ? red : green;

              box.position.copy(mesh.position);
              box.visible = select;
            };
            updates.push(update);

            this._cleanup = () => {
              updates.splice(updates.indexOf(update), 1);
            };
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

                    soundBody.setInput(newAudio);
                    this.audio = newAudio;

                    this._cancelRequest = null;
                  }
                });
            }
          }
        }
        zeo.registerElement(AgentElement);

        const updates = [];
        const _update = () => {
          for (let i = 0; i < updates.length; i++) {
            const update = updates[i];
            update();
          }
        };
        zeo.on('update', _update);

        this._cleanup = () => {
          zeo.removeListener('update', _update);

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
