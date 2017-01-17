const mod = require('mod-loop');

const PIXEL_SIZE = 0.008;

const ICON_IMG_URL = 'https://cdn.rawgit.com/modulesio/zeo-data/801e4d635292eb7c919e8ebfd625848202901145/img/icons/nyancat.png';
const STAR_IMG_URLS = (() => {
  const numUrls = 7;
  const result = Array(numUrls)
  for (let i = 0; i < numUrls; i++) {
    result[i] = `https://cdn.rawgit.com/modulesio/zeo-data/801e4d635292eb7c919e8ebfd625848202901145/img/icons/nyancat-star${i + 1}.png`;
  }
  return result;
})();
const AUDIO_URL = 'https://cdn.rawgit.com/modulesio/zeo-data/801e4d635292eb7c919e8ebfd625848202901145/audio/nyancat-loop.ogg';

const STARS_FRAME_INTERVAL = 50;
const STARS_FRAME_SKIP = 4;

const SIDES = ['left', 'right'];

module.exports = archae => ({
  mount() {
    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _requestIconImg = () => new Promise((accept, reject) => {
      const img = new Image();
      img.src = ICON_IMG_URL;
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(err);
      };
    });
    const _requestStarImgs = () => Promise.all(STAR_IMG_URLS.map(url => new Promise((accept, reject) => {
      const img = new Image();
      img.src = url;
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(err);
      };
    })));
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
      _requestIconImg(),
      _requestStarImgs(),
      _requestAudio(),
    ]).then(([
      iconImg,
      starImgs,
      audio,
    ]) => ({
      iconImg,
      starImgs,
      audio
    }));

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/zeo',
        '/core/plugins/sprite-utils',
        '/core/plugins/random-utils',
      ]),
      _requestResources(),
    ])
      .then(([
        [
          zeo,
          spriteUtils,
          randomUtils,
        ],
        {
          iconImg,
          starImgs,
          audio,
        },
      ]) => {
        if (live) {
          const {THREE, scene, camera, sound} = zeo;
          const world = zeo.getCurrentWorld();
          const {alea} = randomUtils;

          const starGeometries = starImgs.map(starImg => spriteUtils.makeImageGeometry(starImg, PIXEL_SIZE));
          const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x808080,
            wireframe: true,
          });
          const pixelMaterial = new THREE.MeshPhongMaterial({
            color: 0xFFFFFF,
            shininess: 10,
            vertexColors: THREE.FaceColors,
          });
          const backgroundMaterial = new THREE.MeshPhongMaterial({
            color: 0x003466,
            shininess: 10,
            side: THREE.DoubleSide,
            opacity: 0.5,
            transparent: true,
          });

          const mesh = (() => {
            const object = new THREE.Object3D();
            object.position.set(1, 1, 1);
            /* object.rotation.order = camera.rotation.order;
            object.rotation.y = -Math.PI / 2; */

            const rng = new alea('');

            const boxMesh = (() => {
              const geometry = new THREE.BoxBufferGeometry(1, 1, 1);
              const material = wireframeMaterial;

              return new THREE.Mesh(geometry, material);
            })();
            object.add(boxMesh);

            const nyancatMesh = (() => {
              const geometry = spriteUtils.makeImageGeometry(iconImg, PIXEL_SIZE);
              const material = pixelMaterial;

              const mesh = new THREE.Mesh(geometry, material);
              mesh.castShadow = true;
              return mesh;
            })();
            object.add(nyancatMesh);

            const backgroundMesh = (() => {
              const geometry = new THREE.PlaneBufferGeometry(1, 1, 1);
              const material = backgroundMaterial;

              const mesh = new THREE.Mesh(geometry, material);
              mesh.castShadow = true;
              return mesh;
            })();
            object.add(backgroundMesh);

            const starMeshes = (() => {
              const numStars = 32;
              const width = 125;
              const height = 125;
              const depth = 125;

              const result = Array(numStars);
              for (let i = 0; i < numStars; i++) {
                const starMesh = (() => {
                  const geometry = starGeometries[Math.floor(rng() * starGeometries.length)].clone();
                  const material = pixelMaterial;

                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.set(
                    Math.floor(-(width / 2) + (rng() * width)) * PIXEL_SIZE,
                    Math.floor(-(height / 2) + (rng() * height)) * PIXEL_SIZE,
                    Math.floor(-(depth / 2) + (rng() * depth)) * PIXEL_SIZE
                  );
                  mesh.castShadow = true;
                  return mesh;
                })();
                result[i] = starMesh;
              }
              return result;
            })();
            starMeshes.forEach(starMesh => {
              object.add(starMesh);
            });
            object.starMeshes = starMeshes;

            return object;
          })();
          scene.add(mesh);
          this.mesh = mesh;

          const soundBody = (() => {
            const result = new sound.Body();
            result.setInput(audio);
            result.setObject(mesh);
            return result;
          })();

          let lastTime = world.getWorldTime();
          const _update = () => {
            const _updateControllers = () => {
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
            const _updateAnimations = () => {
              const {mesh} = this;
              const {starMeshes} = mesh;

              const currentTime = world.getWorldTime();

              const lastFrame = Math.floor(lastTime / STARS_FRAME_INTERVAL);
              const currentFrame = Math.floor(currentTime / STARS_FRAME_INTERVAL);
              const frameDiff = currentFrame - lastFrame;
              if (frameDiff > 0) {
                for (let i = 0; i < starMeshes.length; i++) {
                  const starMesh = starMeshes[i];
                  starMesh.position.x -= PIXEL_SIZE * STARS_FRAME_SKIP * frameDiff;
                  if (starMesh.position.x < -0.5) {
                    starMesh.position.x = mod(starMesh.position.x, 1);
                  }
                }
              }

              lastTime = currentTime;
            };

            _updateControllers();
            _updateAnimations();
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
