import MediaStreamRecorder from './lib/msr/msr.js';
import WebAudioBufferQueue from './lib/web-audio-buffer-queue/web-audio-buffer-queue.js';

export default class WebRtc {
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
      '/core/engines/three',
      '/core/engines/somnifer',
      '/core/engines/config',
      '/core/engines/multiplayer',
      '/core/plugins/js-utils',
    ])
      .then(([
        three,
        somnifer,
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
              let remotePeerId = null;

              const connection = new WebSocket('wss://' + location.host + '/archae/webrtc');
              connection.binaryType = 'arraybuffer';
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
                      data: msg.data,
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
            const _requestCameraMediaStream = () => navigator.mediaDevices.getUserMedia({
              audio: true,
            }).then(mediaStream => {
              cleanups.push(() => {
                _closeMediaStream(mediaStream);
              });

              return mediaStream;
            });

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
                      channels: 2,
                      // bufferSize: 256,
                      objectMode: true,
                    });

                    const result = new sound.Body();
                    result.setInputSource(inputNode);
                    result.inputNode = inputNode;
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

                  callInterface.on('buffer', ({id, data}) => {
                    const soundBody = soundBodies.get(id);

                    if (soundBody) {
                      audioContext.decodeAudioData(data, decodedData => {
                        const {inputNode} = soundBody;
                        inputNode.write(decodedData);
                      }, err => {
                        console.warn(err);
                      });
                    }
                  });
                  callInterface.on('close', () => {
                    mediaStreamRecorder.stop();
                  });

                  const mediaStreamRecorder = new MediaStreamRecorder(mediaStream);
                  mediaStreamRecorder.mimeType = 'audio/wav';
                  mediaStreamRecorder.start(50);
                  mediaStreamRecorder.ondataavailable = blob => {
                    const fileReader = new FileReader();
                    fileReader.onload = () => {
                      const arrayBuffer = fileReader.result;

                      callInterface.write(arrayBuffer);
                    };
                    fileReader.readAsArrayBuffer(blob);
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

          const _init = () => {
            const {voiceChat} = config.getConfig();

            if (voiceChat) {
              _enable();
            }
          };
          _init();

          const _config = c => {
            const {voiceChat} = c;

            if (voiceChat && !live) {
              _enable();
            } else if (!voiceChat && live) {
              _disable();
            };
          };
          config.on('config', _config);

          this._cleanup = () => {
            cleanup();

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
