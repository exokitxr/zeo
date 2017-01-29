const WatsonSpeech = require('./lib/watson-speech/watson-speech.js');

const SIDES = ['left', 'right'];

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
      [
        zeo,
        jsUtils,
      ],
      {tokens},
    ]) => {
      if (live) {
        const {THREE, scene, camera, sound} = zeo;
        const {events} = jsUtils;
        const {EventEmitter} = events;
        const {tts: ttsToken, stt: sttToken} = tokens;

        const COLORS = {
          GRAY: new THREE.Color(0x9E9E9E),
          GREEN: new THREE.Color(0x4CAF50),
          BLUE: new THREE.Color(0x2196F3),
          RED: new THREE.Color(0xF44336),
          ORANGE: new THREE.Color(0xFF9800),
        };

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
            if (live) {
              const s = d.results.map(({alternatives}) => alternatives[0].transcript).join(' ');
              result.emit('data', s);
            }
          });
          stream.on('end', () => {
            if (live) {
              result.emit('end');
            }
          });
          stream.on('error', err => {
            if (live) {
              result.emit('error', err);
            }
          });

          let live = true;

          const result = new EventEmitter();
          result.stop = () => {
            stream.stop();
          };
          result.cancel = () => {
            live = false;
            
            stream.stop();
          };
          return result;
        };

        class AgentElement extends HTMLElement {
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

            const _makeHoverState = () => ({
              target: null,
            });
            const hoverStates = {
              left: _makeHoverState(),
              right: _makeHoverState(),
            };
            const streamState = {
              sttStream: null,
              ttsStream: null,
            };

            const box = (() => {
              const mesh = new THREE.Mesh(
                new THREE.BoxBufferGeometry(0.2, 0.2, 0.2),
                new THREE.MeshBasicMaterial({
                  color: 0x808080,
                  wireframe: true,
                  // opacity: 0.5,
                  // transparent: true,
                })
              );
              mesh.visible = false;
              return mesh;
            })();
            scene.add(box);
            this.box = box;

            const mesh = (() => {
              const geometry = new THREE.OctahedronBufferGeometry(0.1, 0);
              const material = new THREE.MeshPhongMaterial({
                color: COLORS.GRAY,
                // shininess: 0,
              });

              const mesh = new THREE.Mesh(geometry, material);

              const wireframeMesh = (() => {
                const geometry = new THREE.OctahedronBufferGeometry(0.1, 0);
                const material = new THREE.MeshBasicMaterial({
                  color: 0x000000,
                  wireframe: true,
                });

                return new THREE.Mesh(geometry, material);
              })();
              mesh.add(wireframeMesh);

              return mesh;
            })();
            scene.add(mesh);
            this.mesh = mesh;

            const soundBody = (() => {
              const result = new sound.Body();
              // result.setInputElement(audio);
              result.setObject(mesh);
              return result;
            })();
            this.soundBody = soundBody;

            this.text = null;

            const update = () => {
              const status = zeo.getStatus();
              const {gamepads: gamepadsStatus} = status;

              const _getSelected = side => {
                const gamepadStatus = gamepadsStatus[side];

                if (gamepadStatus) {
                  const {position: controllerPosition} = gamepadStatus;
                  return controllerPosition.distanceTo(mesh.position) <= 0.1;
                } else {
                  return false;
                }
              };

              const {sttStream, ttsStream, audio} = streamState;
              const recording = Boolean(sttStream);
              const loading = Boolean(ttsStream);
              const loaded = Boolean(audio);
              let selected = false;
              SIDES.forEach(side => {
                const sideSelected = _getSelected(side);

                const hoverState = hoverStates[side];
                hoverState.target = sideSelected ? 'agent' : null;

                if (sideSelected) {
                  selected = true;
                }
              });

              mesh.material.color = (() => {
                if (recording) {
                  return COLORS.RED;
                } else if (loading) {
                  return COLORS.ORANGE;
                } else if (loaded) {
                  const {soundBody} = this;
                  return COLORS.GREEN.clone().addScalar(soundBody.getAmplitude() * 0.5);
                } else if (selected) {
                  return COLORS.BLUE;
                } else {
                  return COLORS.GRAY;
                }
              })();
              box.position.copy(mesh.position);
              box.visible = selected;
            };
            updates.push(update);

            const trigger = e => {
              const {side} = e;
              const hoverState = hoverStates[side];
              const {target} = hoverState;

              if (target) {
                const {sttStream} = streamState;

                if (sttStream) {
                  sttStream.stop();
                } else {
                  const {audio} = streamState;

                  if (audio) {
                    if (audio.paused) {
                      audio.play();
                    } else {
                      audio.currentTime = 0;
                    }
                  } else {
                    const {ttsStream} = streamState;

                    if (!ttsStream) {
                      const stream = _requestSpeechToText();
         
                      let speechText = '';
                      stream.on('data', s => {
                        speechText = s;
                      });
                      stream.on('end', () => {
                        let live = true;
                        const _cancel = () => {
                          live = false;
                        };

                        _requestTextToSpeech(speechText)
                          .then(audio => {
                            if (live) {
                              const {soundBody} = this;
                              soundBody.setInputElement(audio);

                              streamState.ttsStream = null;
                              streamState.audio = audio;
                            }
                          })
                          .catch(err => {
                            console.warn(err);

                            streamState.ttsStream = null;
                          });

                        streamState.sttStream = null;
                        streamState.ttsStream = {
                          cancel: _cancel,
                        };
                      });
                      stream.on('error', err => {
                        console.warn(err);

                        streamState.sttStream = null;
                      });

                      streamState.sttStream = stream;
                    }
                  }
                }
              }
            };
            zeo.on('trigger', trigger);
            const grip = e => {
              const {side} = e;

              const hoverState = hoverStates[side];
              const {target} = hoverState;
              if (target) {
                const {sttStream, ttsStream, audio} = streamState;

                if (sttStream) {
                  sttStream.cancel();
                  streamState.sttStream = null;
                }
                if (ttsStream) {
                  ttsStream.cancel();
                  streamState.ttsStream = null;
                }
                if (audio) {
                  if (!audio.paused) {
                    audio.pause();
                  }
                  streamState.audio = null;
                }
              }
            };
            zeo.on('grip', grip);

            this._cleanup = () => {
              updates.splice(updates.indexOf(update), 1);

              zeo.removeListener('trigger', trigger);
              zeo.removeListener('grip', grip);
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
        }
        zeo.registerElement(this, AgentElement);

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

          zeo.unregisterElement(this);
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
