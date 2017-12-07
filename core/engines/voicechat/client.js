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
      '/core/engines/three',
      '/core/engines/webvr',
      '/core/engines/input',
      '/core/engines/somnifer',
      '/core/engines/multiplayer',
      '/core/utils/js-utils',
      '/core/utils/network-utils',
    ])
      .then(([
        three,
        webvr,
        input,
        somnifer,
        multiplayer,
        jsUtils,
        networkUtils,
      ]) => {
        if (live) {
          const {THREE} = three;
          const {events} = jsUtils;
          const {EventEmitter} = events;
          const {AutoWs} = networkUtils;

          const _makeSoundBody = (id, remoteMediaStream) => {
            const soundBody = somnifer.makeBody();
            soundBody.setInputMediaStream(remoteMediaStream);
            soundBody.setObject(multiplayer.getRemotePlayerMesh(id).children[0]);
            return soundBody;
          };
          class VoicechatConnection extends EventEmitter {
            constructor(id) {
              super();

              this.id = id;
            }

            createOffer(mediaStream) {
              return new Promise((accept, reject) => {
                const connection = new RTCPeerConnection();

                connection.onicecandidate = e => {
                  if (e.candidate) {
                    this.emit('icecandidate', e.candidate);
                  }
                };
                connection.onclose = () => {
                  this.emit('close');
                };

                connection.addStream(mediaStream);
                connection.createOffer()
                  .then(offer => {
                    connection.setLocalDescription(offer);

                    this.emit('description', offer);
                  });

                this.connection = connection;
              });
            }

            createAnswer(offer) {
              const connection = new RTCPeerConnection();

              connection.onicecandidate = e => {
                if (e.candidate) {
                  this.emit('icecandidate', e.candidate);
                }
              };
              let soundBody = null;
              connection.onaddstream = e => {
                const audio = document.createElement('audio');
                audio.srcObject = e.stream;

                soundBody = _makeSoundBody(this.id, e.stream);
              };
              connection.onclose = () => {
                soundBody.destroy();

                this.emit('close');
              };

              connection.setRemoteDescription(offer);
              connection.createAnswer()
                .then(answer => {
                  connection.setLocalDescription(answer);

                  this.emit('description', answer);
                });

              this.connection = connection;
            }

            createAcc(answer) {
              this.connection.setRemoteDescription(answer);
            }

            addIceCandidate(candidate) {
              this.connection.addIceCandidate(candidate)
                .catch(err => {
                  // console.warn(err);
                });
            }

            destroy() {
              this.connection.close();
            }
          }
          const connections = {};

          const _requestSignalConnection = () => new Promise((accept, reject) => {
            const signalConnection = new AutoWs(_relativeWsUrl('archae/voicechatWs?id=' + multiplayer.getId()));
            signalConnection.once('connect', () => {
              accept(signalConnection);
            });
            signalConnection.on('message', e => {
              const m = JSON.parse(e.data) ;
              const {type} = m;

              if (type === 'offer') {
                const {source: id, offer} = m;

                const connection = new VoicechatConnection(id);
                connection.on('description', description => {
                  signalConnection.send(JSON.stringify({
                    type: 'answer',
                    target: id,
                    source: multiplayer.getId(),
                    answer: description,
                  }));
                });
                connection.on('icecandidate', candidate => {
                  signalConnection.send(JSON.stringify({
                    type: 'icecandidate',
                    target: id,
                    source: multiplayer.getId(),
                    candidate,
                  }));
                });
                connection.on('close', () => {
                  connections[id] = null;
                });
                connections[id] = connection;

                connection.createAnswer(offer);
              } else if (type === 'answer') {
                const {source: id, answer} = m;

                connections[id].createAcc(answer);
              } else if (type === 'icecandidate') {
                const {source: id, candidate} = m;

                connections[id].addIceCandidate(candidate);
              } else {
                console.warn('signal connection got unknown message type', JSON.stringify(type));
              }
            });
          });

          return _requestSignalConnection()
            .then(signalConnection => {
              if (live) {
                const _defaultCleanup = () => {
                  for (const id in connections) {
                    connections[id].destroy();
                  }
                };
                this._cleanup = _defaultCleanup;

                const _requestMicrophoneMediaStream = () => navigator.mediaDevices.getUserMedia({
                  audio: true,
                });

                let enabled = false;
                return {
                  isEnabled: () => enabled,
                  enable: () => {
                    enabled = true;

                    return _requestMicrophoneMediaStream()
                      .then(mediaStream => {
                        const cleanups = [];
                        cleanups.push(() => {
                          _closeMediaStream(mediaStream);
                        });

                        const _connect = id => {
                          const connection = new VoicechatConnection(id);
                          connection.on('description', description => {
                            signalConnection.send(JSON.stringify({
                              type: 'offer',
                              target: id,
                              source: multiplayer.getId(),
                              offer: description,
                            }));
                          });
                          connection.on('icecandidate', candidate => {
                            signalConnection.send(JSON.stringify({
                              type: 'icecandidate',
                              target: id,
                              source: multiplayer.getId(),
                              candidate,
                            }));
                          });
                          connection.on('close', () => {
                            connections[id] = null;
                          });
                          connections[id] = connection;

                          connection.createOffer(mediaStream);
                        };

                        const playerStatuses = multiplayer.getPlayerStatuses();
                        for (let i = 0; i < playerStatuses.length; i++) {
                          _connect(playerStatuses[i].playerId);
                        }

                        const _playerEnter = ({id}) => {
                          _connect(id);
                        };
                        multiplayer.on('playerEnter', _playerEnter);
                        cleanups.push(() => {
                          multiplayer.removeListener('playerEnter', _playerEnter);
                        });

                        const _playerLeave = ({id}) => {
                          const connection = connections[id];
                          if (connection) {
                            connection.destroy();
                          }
                        };
                        multiplayer.on('playerLeave', _playerLeave);
                        cleanups.push(() => {
                          multiplayer.removeListener('playerLeave', _playerLeave);
                        });

                        this._cleanup = () => {
                          for (let i = 0; i < cleanups.length; i++) {
                            cleanups[i]();
                          }

                          _defaultCleanup();
                        };
                      });
                  },
                  disable: () => {
                    this._cleanup();
                    this._cleanup = _defaultCleanup;

                    enabled = false;

                    return Promise.resolve();
                  },
                };
              }
            });
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
const _closeMediaStream = mediaStream => {
  mediaStream.getTracks()[0].stop();
};
