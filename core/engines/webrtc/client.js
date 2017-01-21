require('./lib/peerjs/peer');

class WebRtc {
  /* constructor(archae) {
    this._archae = archae;
  } */

  mount() {
    // const {_archae: archae} = this;

    const _requestMicrophoneMediaStream = () => navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    let pending = 2;
    const pend = () => {
      if (--pending === 0) {
        done();
      }
    };
    const done = () => {
      _requestMicrophoneMediaStream()
        .then(mediaStream => {
          const c = peer.call('lol2', mediaStream);
          c.on('stream', remoteMediaStream => {
            console.log('peer1 got remote media stream', remoteMediaStream); // XXX

            setTimeout(() => {
              console.log('closing...'); // XXX
              c.close();
              _closeMediaStream(mediaStream);
            }, 2000);
          });
          c.on('error', err => {
            console.log('stream error', err);
          });
        })
        .catch(err => {
          console.warn(err);
        });
    };

    const peer = new Peer('lol', {
      host: window.location.hostname,
      port: parseInt(window.location.port, 10),
      path: '/archae/webrtc',
      secure: true,
      debug: 2,
    });
    peer.on('open', () => {
      pend();
    });
    peer.on('error', err => {
      console.warn('peer1 error', err);
    });

    const peer2 = new Peer('lol2', {
      host: window.location.hostname,
      port: parseInt(window.location.port, 10),
      path: '/archae/webrtc',
      secure: true,
      debug: 2,
    });
    peer2.on('open', () => {
      pend();
    });
    peer2.on('error', err => {
      console.warn('peer2 error', err);
    });
    peer2.on('call', call => {
      _requestMicrophoneMediaStream()
        .then(mediaStream => {
          if (open) {
            call.answer(mediaStream);
            call.on('close', () => {
              _closeMediaStream(mediaStream);
            });
          } else {
            _closeMediaStream(mediaStream);
          }
        })
        .catch(err => {
          console.warn(err);
        });

      const audios = [];
      const _addStream = stream => {
        const audio = document.createElement('audio');
        audio.src = URL.createObjectURL(stream);
        audio.play();

        audios.push(audio);
      };

      call.on('stream', remoteMediaStream => {
        console.log('peer2 got remote media stream', remoteMediaStream); // XXX

        _addStream(remoteMediaStream);
      });
      let open = true;
      call.on('close', () => {
        console.log('got close'); // XXX

        for (let i = 0; i < audios.length; i++) {
          const audio = audios[i];

          audio.pause();
          URL.revokeObjectURL(audio.src);
        }

        open = false;
      });
    });

    this._cleanup = () => {};
  }

  unmount() {
    this._cleanup();
  }
}

const _closeMediaStream = mediaStream => {
  mediaStream.getTracks()[0].stop();
};

module.exports = WebRtc;
