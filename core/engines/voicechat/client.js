export default class VoiceChat {
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
      '/core/engines/hub',
      '/core/engines/three',
      '/core/engines/somnifer',
      '/core/engines/rend',
      '/core/engines/config',
      '/core/engines/multiplayer',
      '/core/plugins/js-utils',
    ])
      .then(([
        hub,
        three,
        somnifer,
        rend,
        config,
        multiplayer,
        jsUtils,
      ]) => {
        if (live) {
          const {THREE} = three;
          const {sound} = somnifer;
          const {events} = jsUtils;
          const {EventEmitter} = events;

          const peerId = multiplayer.getId();

          const cleanups = [];
          const cleanup = () => {
            for (let i = 0; i < cleanups.length; i++) {
              const cleanup = cleanups[i];
              cleanup();
            }
            cleanups.length = 0;
          };

          let live = false;

          const _enable = () => {
            live = true;
            cleanups.push(() => {
              live = false;
            });

            const _requestCallInterface = () => new Promise((accept, reject) => {
              const connection = new WebSocket('wss://' + hub.getCurrentServer().url + '/archae/voicechat');
              connection.binaryType = 'blob';
              connection.onopen = () => {
                const e = {
                  type: 'init',
                  id: peerId,
                };
                const es = JSON.stringify(e);
                connection.send(es);

                accept(callInterface);
              };
              connection.onerror = err => {
                reject(err);
              };
              connection.onmessage = msg => {
                console.warn('got unexpected voice chat connection message', msg);
              };
              connection.onclose = () => {
                callInterface.close();
              };

              class CallInterface extends EventEmitter {
                constructor() {
                  super();

                  this.open = true;
                }

                write(d) {
                  if (connection.readyState === WebSocket.OPEN) {
                    connection.send(d);
                  }
                }

                close() {
                  this.open = false;

                  this.emit('close');
                }

                destroy() {
                  connection.close();
                }
              }

              const callInterface = new CallInterface();

              cleanups.push(() => {
                callInterface.destroy();
              });

              return callInterface;
            });
            const _requestMicrophoneMediaStream = () => navigator.mediaDevices.getUserMedia({
              audio: true,
            }).then(mediaStream => {
              cleanups.push(() => {
                _closeMediaStream(mediaStream);
              });

              return mediaStream;
            });
            /* const _requestCameraMediaStream = () => navigator.mediaDevices.getUserMedia({
              audio: true,
            }).then(mediaStream => {
              cleanups.push(() => {
                _closeMediaStream(mediaStream);
              });

              return mediaStream;
            }); */

            Promise.all([
              _requestCallInterface(),
              _requestMicrophoneMediaStream(),
            ])
              .then(([
                callInterface,
                mediaStream,
              ]) => {
                if (callInterface.open) {
                  const _makeSoundBody = id => {
                    const audio = document.createElement('audio');
                    audio.src = 'https://' + hub.getCurrentServer().url + '/archae/voicechat/' + id;
                    audio.type = 'audio/ogg';
                    audio.autoplay = true;
                    const remotePlayerMesh = multiplayer.getRemotePlayerMesh(id).children[0];

                    const result = new sound.Body();
                    result.setInputElement(audio);
                    result.setObject(remotePlayerMesh);
                    return result;
                  };
                  const soundBodies = (() => {
                    const playerStatuses = multiplayer.getPlayerStatuses();

                    const result = new Map();
                    playerStatuses.forEach((status, id) => {
                      result.set(id, _makeSoundBody(id));
                    });
                    return result;
                  })();

                  const _playerEnter = ({id}) => {
                    soundBodies.set(id, _makeSoundBody(id));
                  };
                  multiplayer.on('playerEnter', _playerEnter);
                  const _playerLeave = ({id}) => {
                    const soundBody = soundBodies.get(id);
                    soundBody.destroy();

                    soundBodies.delete(id);
                  };
                  multiplayer.on('playerLeave', _playerLeave);
                  cleanups.push(() => {
                    multiplayer.removeListener('playerEnter', _playerEnter);
                    multiplayer.removeListener('playerLeave', _playerLeave);
                  });

                  callInterface.on('close', () => {
                    mediaStreamRecorder.stop();
                  });

                  const mediaStreamRecorder = new MediaRecorder(mediaStream, {
                    mimeType: 'audio/webm;codecs=vorbis',
                  });
                  mediaStreamRecorder.start();
                  mediaStreamRecorder.ondataavailable = e => {
                    const {data: blob} = e;
                    callInterface.write(blob);
                  };

                  cleanups.push(() => {
                    mediaStreamRecorder.stop();
                  });
                } else {
                  _closeMediaStream(mediaStream);
                }
              });
          };
          const _disable = () => {
            cleanup();
          };

          const _updateEnabled = () => {
            const connected = hub.getCurrentServer().type === 'server';
            const {voiceChat} = config.getConfig();
            const shouldBeLive = connected && voiceChat;

            if (shouldBeLive && !live) {
              _enable();
            } else if (!shouldBeLive && live) {
              _disable();
            };
          };
          const _connectServer = _updateEnabled;
          rend.on('connectServer', _connectServer);
          const _disconnectServer = _updateEnabled;
          rend.on('disconnectServer', _disconnectServer);
          const _config = _updateEnabled;
          config.on('config', _config);

          this._cleanup = () => {
            cleanup();

            rend.removeListener('connectServer', _connectServer);
            rend.removeListener('disconnectServer', _disconnectServer);
            config.removeListener('config', _config);
          };

          return {};
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

const _closeMediaStream = mediaStream => {
  mediaStream.getTracks()[0].stop();
};
