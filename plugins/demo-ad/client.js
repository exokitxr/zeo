const PIXEL_SIZE = 0.005;

const IMG_URL = 'https://cdn.rawgit.com/modulesio/zeo-data/3460cf1fcea059862343e95c8797c3b1d7418fe2/img/icons/nyancat.png';
const AUDIO_URL = 'https://cdn.rawgit.com/modulesio/zeo-data/3460cf1fcea059862343e95c8797c3b1d7418fe2/audio/nyancat-loop.ogg';

const SIDES = ['left', 'right'];

module.exports = archae => ({
  mount() {
    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _requestImg = () => new Promise((accept, reject) => {
      const img = new Image();
      img.src = IMG_URL;
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(err);
      };
    });
    const _requestAudio = () => new Promise((accept, reject) => {
      const audio = document.createElement('audio');
      audio.src = AUDIO_URL;
      audio.loop = true;
      audio.crossOrigin = 'Anonymous';
      audio.oncanplay = () => {
        accept(audio);
      };
      audio.onerror = err => {
        reject(err);
      };
    });
    const _requestResources = () => Promise.all([
      _requestImg(),
      _requestAudio(),
    ]).then(([
      img,
      audio,
    ]) => ({
      img,
      audio
    }));

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/zeo',
        '/core/plugins/sprite-utils',
      ]),
      _requestResources(),
    ])
      .then(([
        [
          zeo,
          spriteUtils,
        ],
        {
          img,
          audio,
        },
      ]) => {
        if (live) {
          const {THREE, scene, sound} = zeo;
          const world = zeo.getCurrentWorld();

          const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x808080,
            wireframe: true,
          });
          const pixelMaterial = new THREE.MeshPhongMaterial({
            color: 0xFFFFFF,
            shininess: 10,
            vertexColors: THREE.FaceColors,
          });

          const mesh = (() => {
            const object = new THREE.Object3D();
            object.position.y = 1;

            const boxMesh = (() => {
              const geometry = new THREE.BoxBufferGeometry(50 * PIXEL_SIZE, 50 * PIXEL_SIZE, PIXEL_SIZE);
              const material = wireframeMaterial;

              return new THREE.Mesh(geometry, material);
            })();
            object.add(boxMesh);

            const nyancatMesh = (() => {
              const geometry = spriteUtils.makeImageGeometry(img, PIXEL_SIZE);
              const material = pixelMaterial;

              const mesh = new THREE.Mesh(geometry, material);
              mesh.castShadow = true;
              return mesh;
            })();
            object.add(nyancatMesh);

            return object;
          })();
          scene.add(mesh);

          const soundBody = (() => {
            const result = new sound.Body();
            result.setInput(audio);
            result.setObject(mesh);
            return result;
          })();

          const _update = () => {
            const status = zeo.getStatus();
            const {gamepads} = zeo.getStatus();
            const touchingNyancat = SIDES.some(side => {
              const gamepad = gamepads[side];

              if (gamepad) {
                const {position: controllerPosition} = gamepad;
                return controllerPosition.distanceTo(mesh.position) < 0.1;
              } else {
                return false;
              }
            });
            if (touchingNyancat && audio.paused) {
              audio.play();
            } else if (!touchingNyancat && !audio.paused) {
              audio.pause();
            }
          };

          zeo.on('update', _update);

          this._cleanup = () => {
            scene.remove(mesh);

            zeo.removeListener('update', _update);
          };
        }
      });
  },
  unmount() {
    this._cleanup();
  },
});
