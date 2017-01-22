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
      '/core/engines/somnifer',
      '/core/engines/multiplayer',
    ])
      .then(([
        somnifer,
        multiplayer,
      ]) => {
        if (live) {
          const {sound} = somnifer;
          const peerId = multiplayer.getId();

          const _requestMicrophoneMediaStream = () => navigator.mediaDevices.getUserMedia({
            audio: true,
          });

          _requestMicrophoneMediaStream()
            .then(mediaStream => {
              const mediaStreamRecorder = new MediaStreamRecorder(mediaStream);
              mediaStreamRecorder.mimeType = 'audio/wav';
              mediaStreamRecorder.start(50);
              mediaStreamRecorder.ondataavailable = blob => {
                const fileReader = new FileReader();
                fileReader.onload = () => {
                  const arrayBuffer = fileReader.result;

                  audioContext.decodeAudioData(arrayBuffer, decodedData => {
                    node.write(decodedData);
                  }, err => {
                    console.warn(err);
                  });
                };
                fileReader.readAsArrayBuffer(blob);
              };

              const audioContext = new AudioContext();
              const node = new WebAudioBufferQueue({
                audioContext,
                channels: 2,
                // bufferSize: 256,
                objectMode: true,
              });
              node.connect(audioContext.destination)
            })
            .catch(err => {
              console.warn(err);
            });

          /* const _handleRemoteMediaStream = (remotePeerId, remoteMediaStream) => {
            const audio = document.createElement('audio');
            audio.src = URL.createObjectURL(remoteMediaStream);
            audio.play();

            const soundBody = (() => {
              const remotePlayerMesh = multiplayer.getRemotePlayerMesh(remotePeerId).children[0];

              const result = new sound.Body();
              result.setInputElement(audio);
              result.setObject(remotePlayerMesh);
              return result;
            })();

            const _destroy = () => {
              audio.pause();
              URL.revokeObjectURL(audio.src);

              soundBody.destroy();

              _closeMediaStream(remoteMediaStream);
            };

            return {
              destroy: _destroy,
            };
          };

          const peer = new Peer(peerId, {
            host: window.location.hostname,
            port: parseInt(window.location.port, 10),
            path: '/archae/webrtc',
            secure: true,
            debug: 2,
          });
          peer.on('open', c => {
            console.log('local webrtc peer open', peerId); // XXX

            const remotePeerIds = (() => {
              const playerStatuses = multiplayer.getPlayerStatuses();

              const result = Array(playerStatuses.size);
              let i = 0;
              playerStatuses.forEach((status, id) => {
                result[i++] = id;
              });
              return result;
            })();
            remotePeerIds.forEach(remotePeerId => {
              _requestMicrophoneMediaStream()
                .then(mediaStream => {
                  console.log('local webrtc peer call', remotePeerId); // XXX

                  let streamHandler = null;

                  const call = peer.call(remotePeerId, mediaStream);
                  call.on('stream', remoteMediaStream => {
                    if (streamHandler) {
                      streamHandler.destroy();
                    }

                    streamHandler = _handleRemoteMediaStream(remotePeerId, remoteMediaStream);
                  });
                  call.on('error', err => {
                    console.log('stream error', err);
                  });
                  call.on('close', () => {
                    console.log('call request closed'); // XXX

                    if (streamHandler) {
                      streamHandler.destroy();
                    }
                  });
                })
                .catch(err => {
                  console.warn(err);
                });
            });
          });
          peer.on('error', err => {
            console.warn(err);
          });
          peer.on('call', call => {
            console.log('remote webrtc peer call', call); // XXX

            _requestMicrophoneMediaStream()
              .then(mediaStream => {
                if (open) {
                  call.answer(mediaStream);

                  const streamHandler = _handleRemoteMediaStream(call.peer, remoteMediaStream);

                  call.on('close', () => {
                    streamHandler.destroy();
                  });
                } else {
                  _closeMediaStream(mediaStream);
                }
              })
              .catch(err => {
                console.warn(err);
              });

              let open = true;
              call.on('close', () => {
                console.log('call response closed'); // XXX

                open = false;
              });
          }); */
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
