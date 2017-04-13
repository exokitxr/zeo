const WatsonSpeech = require('./lib/watson-speech/watson-speech.js');

const SIDES = ['left', 'right'];

class Agent {
  mount() {
    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _requestTokens = () => fetch('archae/agent/tokens')
      .then(res => res.json());

    return _requestTokens()
      .then(({tokens}) => {
        if (live) {
          const {three: {THREE}, elements, pose, input, render, world, sound, utils: {js: {events: {EventEmitter}}}} = zeo;
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

          const agentComponent = {
            selector: 'agent',
            attributes: {
              position: {
                type: 'matrix',
                value: [
                  1, 1, 0,
                  0, 0, 0, 1,
                  1, 1, 1,
                ],
              },
            },
            entityAddedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();
              const entityObject = entityElement.getObject();

              entityApi.position = null;
              entityApi.text = null;

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
              entityObject.add(box);

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
              entityObject.add(mesh);

              const soundBody = (() => {
                const result = sound.makeBody();
                // result.setInputElement(audio);
                result.setObject(mesh);
                return result;
              })();

              const update = () => {
                const {gamepads: gamepadsStatus} = pose.getStatus();

                const _getSelected = side => {
                  const gamepadStatus = gamepadsStatus[side];

                  if (gamepadStatus) {
                    const {position: controllerPosition, scale: controllerScale} = gamepadStatus;
                    const absPosition = controllerPosition.clone().multiply(controllerScale);

                    return absPosition.distanceTo(mesh.position) <= 0.1;
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
              input.on('trigger', trigger);
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
              input.on('grip', grip);

              entityApi._updateMesh = () => {
                const {position} = entityApi;

                if (position) {
                  mesh.position.set(position[0], position[1], position[2]);
                  mesh.quaternion.set(position[3], position[4], position[5], position[6]);
                  mesh.scale.set(position[7], position[8], position[9]);
                }
              };
              entityApi._cleanup = () => {
                entityObject.remove(box);
                entityObject.remove(mesh);

                updates.splice(updates.indexOf(update), 1);

                input.removeListener('trigger', trigger);
                input.removeListener('grip', grip);
              };
            },
            entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
              const entityApi = entityElement.getComponentApi();

              switch (name) {
                case 'position': {
                  entityApi.position = newValue;
                  entityApi._updateMesh();

                  break;
                }
              }
            },
          };
          elements.registerComponent(this, agentComponent);

          const updates = [];
          const _update = () => {
            for (let i = 0; i < updates.length; i++) {
              const update = updates[i];
              update();
            }
          };
          render.on('update', _update);

          this._cleanup = () => {
            elements.unregisterComponent(this, agentComponent);

            render.removeListener('update', _update);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Agent;
