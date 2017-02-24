import WebAudioBufferQueue from './lib/web-audio-buffer-queue/web-audio-buffer-queue.js';

const DATA_RATE = 50;

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
      '/core/engines/login',
      '/core/engines/rend',
      '/core/engines/config',
      '/core/engines/multiplayer',
      '/core/plugins/js-utils',
    ])
      .then(([
        hub,
        three,
        somnifer,
        login,
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

          const cleanups = [];
          const cleanup = () => {
            for (let i = 0; i < cleanups.length; i++) {
              const cleanup = cleanups[i];
              cleanup();
            }
            cleanups.length = 0;
          };

          let enabled = false;
          const _enable = () => {
            enabled = true;
            cleanups.push(() => {
              enabled = false;
            });

            const _requestCallInterface = () => new Promise((accept, reject) => {
              let remotePeerId = null;

              const connection = new WebSocket('wss://' + hub.getCurrentServer().url + '/archae/voicechatWs?id=' + multiplayer.getId());
              connection.binaryType = 'arraybuffer';
              connection.onopen = () => {
                accept(callInterface);
              };
              connection.onerror = err => {
                reject(err);
              };
              connection.onmessage = msg => {
                if (typeof msg.data === 'string') {
                  const e = JSON.parse(msg.data) ;
                  const {type} = e;

                  if (type === 'id') {
                    const {id: messageId} = e;
                    remotePeerId = messageId;
                  } else {
                    console.warn('unknown message type', JSON.stringify(type));
                  }
                } else {
                  if (remotePeerId !== null) {
                    callInterface.emit('buffer', {
                      id: remotePeerId,
                      data: new Int16Array(msg.data),
                    });
                  } else {
                    console.warn('buffer data before remote peer id', msg);
                  }
                }
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
                  const audioContext = THREE.AudioContext.getContext();

                  const _makeSoundBody = id => {
                    const remotePlayerMesh = multiplayer.getRemotePlayerMesh(id).children[0];

                    const inputNode = new WebAudioBufferQueue({
                      audioContext,
                      // channels: 2,
                      channels: 1,
                      // bufferSize: 16384,
                      objectMode: true,
                    });

                    const result = new sound.Body();
                    result.setInputSource(inputNode);
                    result.inputNode = inputNode;
                    result.setObject(remotePlayerMesh);

                    inputNode.write(new Int16Array(64 * 1024));

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

                  callInterface.on('buffer', ({id, data}) => {
                    const soundBody = soundBodies.get(id);

                    if (soundBody) {
                      const {inputNode} = soundBody;
                      inputNode.write(data);
                    }
                  });

                  callInterface.on('close', () => {
                    mediaRecorder.stop();
                  });

                  const mediaRecorder = new MediaRecorder(mediaStream, {
                    mimeType: 'audio/webm;codecs=opus',
                  });
                  mediaRecorder.ondataavailable = e => {
                    const {data: blob} = e;
                    callInterface.write(blob);
                  };
                  const interval = setInterval(() => {
                    if (mediaRecorder.state === 'recording') {
                      mediaRecorder.requestData();
                    }
                  }, DATA_RATE);
                  mediaRecorder.onstop = () => {
                    clearInterval(interval);
                  };
                  mediaRecorder.start();
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
            const loggedIn = !login.isOpen();
            const {voiceChat} = config.getConfig();
            const shouldBeEnabled = connected && loggedIn && voiceChat;

            if (shouldBeEnabled && !enabled) {
              _enable();
            } else if (!shouldBeEnabled && enabled) {
              _disable();
            };
          };
          const _connectServer = _updateEnabled;
          rend.on('connectServer', _connectServer);
          const _disconnectServer = _updateEnabled;
          rend.on('disconnectServer', _disconnectServer);
          const _login = _updateEnabled;
          rend.on('login', _login);
          const _logout = _updateEnabled;
          rend.on('logout', _logout);
          const _config = _updateEnabled;
          config.on('config', _config);

          this._cleanup = () => {
            cleanup();

            rend.removeListener('connectServer', _connectServer);
            rend.removeListener('disconnectServer', _disconnectServer);
            rend.removeListener('login', _login);
            rend.removeListener('logout', _logout);

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
