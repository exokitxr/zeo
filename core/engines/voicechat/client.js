import WebAudioBufferQueue from './lib/web-audio-buffer-queue/web-audio-buffer-queue.js';

const DATA_RATE = 50;

export default class VoiceChat {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {server: {enabled: serverEnabled}}} = archae;

    const cleanups = [];
    this._cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };

    let live = true;
    cleanups.push(() => {
      live = false;
    });

    if (serverEnabled) {
      archae.requestPlugins([
        '/core/engines/three',
        '/core/engines/somnifer',
        '/core/engines/config',
        '/core/engines/multiplayer',
        '/core/utils/js-utils',
        '/core/utils/network-utils',
      ])
        .then(([
          three,
          somnifer,
          config,
          multiplayer,
          jsUtils,
          networkUtils,
        ]) => {
          if (live) {
            const {THREE} = three;
            const {events} = jsUtils;
            const {EventEmitter} = events;
            const {AutoWs} = networkUtils;

            const callInterface = (() => {
              let currentRemotePeerId = null;

              const connection = new AutoWs(_relativeWsUrl('archae/voicechatWs?id=' + multiplayer.getId()));
              connection.on('message', msg => {
                if (typeof msg.data === 'string') {
                  const e = JSON.parse(msg.data) ;
                  const {type} = e;

                  if (type === 'id') {
                    const {id: messageId} = e;
                    currentRemotePeerId = messageId;
                  } else {
                    console.warn('unknown message type', JSON.stringify(type));
                  }
                } else {
                  if (currentRemotePeerId !== null) {
                    callInterface.emit('buffer', {
                      id: currentRemotePeerId,
                      data: new Float32Array(msg.data),
                    });
                  } else {
                    console.warn('buffer data before remote peer id', msg);
                  }
                }
              });
              connection.on('disconnect', () => {
                currentRemotePeerId = null;
              });

              class CallInterface extends EventEmitter {
                write(d) {
                  connection.sendUnbuffered(d);
                }

                destroy() {
                  connection.destroy();
                }
              }
              const callInterface = new CallInterface();
              return callInterface;
            })();

            const _init = () => {
              const _makeSoundBody = id => {
                const result = somnifer.makeBody();

                const inputNode = new WebAudioBufferQueue({
                  audioContext: result.sound.context,
                  // channels: 2,
                  channels: 1,
                  // bufferSize: 16384,
                  objectMode: true,
                });
                result.setInputSource(inputNode);
                result.inputNode = inputNode;

                const remotePlayerMesh = multiplayer.getRemotePlayerMesh(id).children[0];
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
                  const {inputNode} = soundBody;
                  inputNode.write(data);
                }
              });
            };
            _init();

            const localCleanups = [];
            const _localCleanup = () => {
              for (let i = 0; i < localCleanups.length; i++) {
                const localCleanup = localCleanups[i];
                localCleanup();
              }
              localCleanups.length = 0;
            };

            let srcAudioContext = null;
            let enabled = false;
            const _enable = () => {
              enabled = true;
              localCleanups.push(() => {
                enabled = false;
              });

              const _requestMicrophoneMediaStream = () => navigator.mediaDevices.getUserMedia({
                audio: true,
              }).then(mediaStream => {
                localCleanups.push(() => {
                  _closeMediaStream(mediaStream);
                });

                return mediaStream;
              });
              /* const _requestCameraMediaStream = () => navigator.mediaDevices.getUserMedia({
                audio: true,
              }).then(mediaStream => {
                localCleanups.push(() => {
                  _closeMediaStream(mediaStream);
                });

                return mediaStream;
              }); */

              _requestMicrophoneMediaStream()
                .then(mediaStream => {
                  if (!srcAudioContext) {
                    srcAudioContext = new AudioContext();
                  }
                  const source = srcAudioContext.createMediaStreamSource(mediaStream);
                  const scriptNode = srcAudioContext.createScriptProcessor(4096, 1, 1);
                  scriptNode.onaudioprocess = e => {
                    const {inputBuffer} = e;

                    for (let channel = 0; channel < inputBuffer.numberOfChannels; channel++) {
                      const inputData = inputBuffer.getChannelData(channel);
                      callInterface.write(inputData);
                    }
                  };
                  source.connect(scriptNode);
                  scriptNode.connect(srcAudioContext.destination);

                  localCleanups.push(() => {
                    source.disconnect(scriptNode);
                    scriptNode.disconnect(srcAudioContext.destination);
                    scriptNode.onaudioprocess = null;

                    _closeMediaStream(mediaStream);
                  });
                });
            };
            const _disable = () => {
              _localCleanup();
            };

            const _updateEnabled = () => {
              const {voiceChat} = config.getConfig();
              const shouldBeEnabled = voiceChat;

              if (shouldBeEnabled && !enabled) {
                _enable();
              } else if (!shouldBeEnabled && enabled) {
                _disable();
              };
            };
            const _config = _updateEnabled;
            config.on('config', _config);

            _updateEnabled();

            cleanups.push(() => {
              _localCleanup();

              callInterface.destroy();

              config.removeListener('config', _config);
            });
          }
        });
    }
  }

  unmount() {
    this._cleanup();
  }
}

const _relativeWsUrl = s => {
  const l = window.location;
  return ((l.protocol === 'https:') ? 'wss://' : 'ws://') + l.host + l.pathname + (!/\/$/.test(l.pathname) ? '/' : '') + s;
};

const _closeMediaStream = mediaStream => {
  mediaStream.getTracks()[0].stop();
};
