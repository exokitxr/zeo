import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,

  DEFAULT_USER_HEIGHT,
} from './lib/constants/menu';
import menuRenderer from './lib/render/menu';

const VIDEOS = [
  {
    name: 'Introduction 1: Controls',
    video: 'https://raw.githubusercontent.com/modulesio/zeo-data/c6e33eedbbd7cabe3b3d18a8e7219048114ee722/video/sample1.webm',
    thumbnail: 'https://raw.githubusercontent.com/modulesio/zeo-data/c6e33eedbbd7cabe3b3d18a8e7219048114ee722/video/sample1.png',
  },
  {
    name: 'Introduction 2: Modules',
    video: 'https://raw.githubusercontent.com/modulesio/zeo-data/c6e33eedbbd7cabe3b3d18a8e7219048114ee722/video/sample2.webm',
    thumbnail: 'https://raw.githubusercontent.com/modulesio/zeo-data/c6e33eedbbd7cabe3b3d18a8e7219048114ee722/video/sample2.png',
  },
  {
    name: 'Introduction 3: Multiplayer',
    video: 'https://raw.githubusercontent.com/modulesio/zeo-data/c6e33eedbbd7cabe3b3d18a8e7219048114ee722/video/sample1.webm',
    thumbnail: 'https://raw.githubusercontent.com/modulesio/zeo-data/c6e33eedbbd7cabe3b3d18a8e7219048114ee722/video/sample1.png',
  },
  {
    name: 'Introduction 4: Host your own',
    video: 'https://raw.githubusercontent.com/modulesio/zeo-data/c6e33eedbbd7cabe3b3d18a8e7219048114ee722/video/sample2.webm',
    thumbnail: 'https://raw.githubusercontent.com/modulesio/zeo-data/c6e33eedbbd7cabe3b3d18a8e7219048114ee722/video/sample2.png',
  },
  {
    name: 'Introduction 5: Host your own',
    video: 'https://raw.githubusercontent.com/modulesio/zeo-data/c6e33eedbbd7cabe3b3d18a8e7219048114ee722/video/sample1.webm',
    thumbnail: 'https://raw.githubusercontent.com/modulesio/zeo-data/c6e33eedbbd7cabe3b3d18a8e7219048114ee722/video/sample1.png',
  },
];

const SIDES = ['left', 'right'];

class Home {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {hub: {url: hubUrl}}} = archae;

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

    const _requestBlobBase64 = blob => new Promise((accept, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        accept(reader.result);
      };
      reader.onerror = err => {
        reject(err);
      };
    });
    const _requestVideoSpecs = () => Promise.all(VIDEOS.map(videoSpec =>
      fetch(videoSpec.thumbnail)
        .then(res => res.blob()
          .then(blob => _requestBlobBase64(blob))
          .then(thumbnailImgData => {
            const {name, video, thumbnail} = videoSpec;

            return {
              name,
              video,
              thumbnail,
              thumbnailImgData,
            };
          })
        )
    ));

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/bootstrap',
        '/core/engines/input',
        '/core/engines/three',
        '/core/engines/webvr',
        '/core/engines/biolumi',
        '/core/engines/cyborg',
        '/core/engines/somnifer',
        '/core/engines/rend',
        '/core/engines/tags',
      ]),
      _requestVideoSpecs(),
    ])
      .then(([
        [
          bootstrap,
          input,
          three,
          webvr,
          biolumi,
          cyborg,
          somnifer,
          rend,
          tags,
        ],
        videos,
      ]) => {
        if (live) {
          const {THREE, scene, renderer} = three;

          const transparentMaterial = biolumi.getTransparentMaterial();
          const transparentImg = biolumi.getTransparentImg();

          const _makeTransparentMaterial = color => new THREE.MeshPhongMaterial({
            color: color,
            // shininess: 0,
            shading: THREE.FlatShading,
            transparent: true,
            opacity: 0.5,
          });
          const transparentMaterials = {
            red: _makeTransparentMaterial(0xF44336),
          };

          const homeState = {
            page: '',
            username: '',
            vrMode: bootstrap.getVrMode(),
          };
          const mediaState = {
            paused: true,
            value: 0,
          };

          const tutorialMesh = (() => {
            const object = new THREE.Object3D();
            object.position.set(0, DEFAULT_USER_HEIGHT, -1.5);
            object.visible = bootstrap.getTutorialFlag();

            const planeMesh = (() => {
              const menuUi = biolumi.makeUi({
                width: WIDTH,
                height: HEIGHT,
              });
              const mesh = menuUi.makePage(({
                home: {
                  page,
                  vrMode,
                },
                videos,
              }) => {
                return {
                  type: 'html',
                  src: menuRenderer.getHomeMenuSrc({
                    page,
                    vrMode,
                    videos,
                  }),
                  x: 0,
                  y: 0,
                  w: WIDTH,
                  h: HEIGHT,
                };
              }, {
                type: 'home',
                state: {
                  home: homeState,
                  videos: videos,
                },
                worldWidth: WORLD_WIDTH,
                worldHeight: WORLD_HEIGHT,
              });
              mesh.receiveShadow = true;

              const {page} = mesh;
              rend.addPage(page);

              cleanups.push(() => {
                rend.removePage(page);
              });

              return mesh;
            })();
            object.add(planeMesh);
            object.planeMesh = planeMesh;

            const videoMesh = (() => {
              const object = new THREE.Object3D();
              object.visible = false;

              const viewportMesh = (() => {
                const worldWidth = WORLD_WIDTH;
                const worldHeight = WORLD_HEIGHT * ((HEIGHT - 300) / HEIGHT);
                const geometry = new THREE.PlaneBufferGeometry(worldWidth, worldHeight);
                const texture = new THREE.Texture(
                  transparentImg,
                  THREE.UVMapping,
                  THREE.ClampToEdgeWrapping,
                  THREE.ClampToEdgeWrapping,
                  THREE.NearestFilter,
                  THREE.NearestFilter,
                  THREE.RGBFormat,
                  THREE.UnsignedByteType,
                  16
                );
                texture.needsUpdate = true;
                const material = new THREE.MeshBasicMaterial({
                  map: texture,
                  side: THREE.DoubleSide,
                });

                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.y = (WORLD_HEIGHT / 2) - (worldHeight / 2) - (WORLD_HEIGHT * (100 / HEIGHT));
                mesh.position.z = 0.001;

                return mesh;
              })();
              object.add(viewportMesh);
              object.viewportMesh = viewportMesh;

              const playMesh = (() => {
                const worldWidth = WORLD_WIDTH;
                const worldHeight = WORLD_HEIGHT * ((HEIGHT - 300) / HEIGHT);
                const menuUi = biolumi.makeUi({
                  width: WIDTH,
                  height: HEIGHT - 300,
                  color: [1, 1, 1, 0],
                });
                const mesh = menuUi.makePage(({
                  media: {
                    paused,
                    value,
                  },
                }) => ({
                  type: 'html',
                  src: menuRenderer.getMediaPlaySrc({
                    paused,
                    value,
                  }),
                  x: 0,
                  y: 0,
                  w: WIDTH,
                  h: HEIGHT - 300,
                }), {
                  type: 'videoPlay',
                  state: {
                    media: mediaState,
                  },
                  worldWidth: worldWidth,
                  worldHeight: worldHeight,
                });
                mesh.position.y = (WORLD_HEIGHT / 2) - (worldHeight / 2) - (WORLD_HEIGHT * (100 / HEIGHT));
                mesh.position.z = 0.002;

                const {page} = mesh;
                rend.addPage(page);
                page.update();

                cleanups.push(() => {
                  rend.removePage(page);
                });

                return mesh;
              })();
              object.add(playMesh);
              object.playMesh = playMesh;

              const barMesh = (() => {
                const worldWidth = WORLD_WIDTH;
                const worldHeight = WORLD_HEIGHT * (100 / HEIGHT);
                const menuUi = biolumi.makeUi({
                  width: WIDTH,
                  height: 100,
                  color: [1, 1, 1, 0],
                });
                const mesh = menuUi.makePage(({
                  media: {
                    paused,
                    value,
                  },
                }) => ({
                  type: 'html',
                  src: menuRenderer.getMediaBarSrc({
                    paused,
                    value,
                  }),
                  x: 0,
                  y: 0,
                  w: WIDTH,
                  h: 100,
                }), {
                  type: 'videoBar',
                  state: {
                    media: mediaState,
                  },
                  worldWidth: worldWidth,
                  worldHeight: worldHeight,
                });
                mesh.position.y = -(WORLD_HEIGHT / 2) + (worldHeight / 2) + (WORLD_HEIGHT * (100 / HEIGHT));
                mesh.position.z = 0.002;

                const {page} = mesh;
                rend.addPage(page);
                page.update();

                cleanups.push(() => {
                  rend.removePage(page);
                });

                return mesh;
              })();
              object.add(barMesh);
              object.barMesh = barMesh;

              const soundBody = somnifer.makeBody();
              soundBody.setObject(object);
              object.soundBody = soundBody;

              return object;
            })();
            object.add(videoMesh);
            object.videoMesh = videoMesh;

            const shadowMesh = (() => {
              const geometry = new THREE.BoxBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT, 0.01);
              const material = transparentMaterial.clone();
              material.depthWrite = false;

              const mesh = new THREE.Mesh(geometry, material);
              mesh.castShadow = true;
              return mesh;
            })();
            object.add(shadowMesh);

            return object;
          })();
          scene.add(tutorialMesh);

          const _updatePages = () => {
            const {planeMesh} = tutorialMesh;
            const {page} = planeMesh;
            page.update();
          };
          _updatePages();

          const _parsePage = page => {
            const split = page.split(':');
            const name = split[0];
            const args = split.slice(1);
            return {
              name,
              args,
            };
          };
          const _setPage = page => {
            const isTutorialPage = /^(?:videos|video:[0-9]+)$/.test(page);
            if (isTutorialPage && !bootstrap.getTutorialFlag()) {
              bootstrap.setTutorialFlag(true);
            } else if (!isTutorialPage && bootstrap.getTutorialFlag()) {
              bootstrap.setTutorialFlag(false);
            }

            const {videoMesh} = tutorialMesh;
            const {viewportMesh: {material: {map: texture}}} = videoMesh;
            const {image: media} = texture;
            if (media.tagName === 'VIDEO' && !media.paused) {
              media.pause();
            }
            let match;
            if (match = page.match(/^video:([0-9]+)$/)) {
              const id = parseInt(match[1], 10);

              videoMesh.visible = true;
              const video = (() => {
                const video = document.createElement('video');
                video.crossOrigin = 'Anonymous';
                video.oncanplaythrough = () => {
                  texture.image = video;
                  texture.needsUpdate = true;

                  const {soundBody} = videoMesh;
                  soundBody.setInputElement(video);

                  video.oncanplaythrough = null;
                  video.onerror = null;
                };
                video.onerror = err => {
                  console.warn(err);
                };
                video.src = videos[id].video;
                return video;
              })();
              texture.image = transparentImg;
              texture.needsUpdate = true;
            } else {
              videoMesh.visible = false;
            }

            mediaState.paused = true;
            mediaState.value = 0;
            const {playMesh, barMesh} = videoMesh;
            const {page: playPage} = playMesh;
            playPage.update();
            const {page: barPage} = barMesh;
            barPage.update();

            if (page !== 'done') {
              homeState.page = page;

              _updatePages();
            } else {
              tutorialMesh.visible = false;
            }
          };
          _setPage(bootstrap.getTutorialFlag() ? 'videos' : 'done');

          const _trigger = e => {
            const {side} = e;

            const _doMenuMeshClick = () => {
              const hoverState = rend.getHoverState(side);
              const {anchor} = hoverState;
              const onclick = (anchor && anchor.onclick) || '';

              let match;
              if (onclick === 'home:next') {
                const {page} = homeState;
                const pageSpec = _parsePage(page);
                const {name} = pageSpec;

                if (name === 'videos') {
                  _setPage('video:' + 0);
                } else if (name === 'video') {
                  const n = parseInt(pageSpec.args[0], 10);

                  if (n < 4) {
                    _setPage([pageSpec.name, n + 1].join(':'));
                  } else {
                    _setPage('done');
                  }                    
                }

                return true;
              } else if (onclick === 'home:back') {
                const {page} = homeState;
                const pageSpec = _parsePage(page);
                const {name} = pageSpec;

                if (name === 'video') {
                  const n = parseInt(pageSpec.args[0], 10);

                  if (n > 0) {
                    _setPage([pageSpec.name, n - 1].join(':'));
                  } else {
                    _setPage('videos');
                  }
                } else if (name === 'done') {
                  _setPage('videos');
                }

                return true;
              } else if (match = onclick.match(/^home:video:([0-9]+)$/)) {
                const n = parseInt(match[1], 10);

                _setPage('video:' + n);

                return true;
              } else if (onclick === 'home:skipAll') {
                _setPage('done');

                return true;
              } else if (match = onclick.match(/^media:(play|pause|seek)$/)) {
                const action = match[1];

                const {videoMesh} = tutorialMesh;
                const {viewportMesh: {material: {map: {image: media}}}} = videoMesh;
                if (action === 'play') {
                  if (media.paused) {
                    media.play();

                    mediaState.paused = false;

                    const {playMesh} = videoMesh;
                    const {page} = playMesh;
                    page.update();
                  }
                } else if (action === 'pause') {
                  if (!media.paused) {
                    media.pause();

                    mediaState.paused = true;

                    const {playMesh} = videoMesh;
                    const {page} = playMesh;
                    page.update();
                  }
                } else if (action === 'seek') {
                  const {value} = hoverState;
                  media.currentTime = value * media.duration;

                  mediaState.value = value;
                  const {barMesh} = videoMesh;
                  const {page} = barMesh;
                  page.update();
                }

                return true;
              } else {
                return false;
              }
            };

            _doMenuMeshClick();
          };
          input.on('trigger', _trigger, {
            priority: 1,
          });

          const _update = () => {
            const {videoMesh} = tutorialMesh;
            const {viewportMesh: {material: {map: texture}}} = videoMesh;
            const {image: media} = texture;

            if (videoMesh.visible && media.tagName === 'VIDEO') {
              const {value: prevValue} = mediaState;
              const nextValue = media.currentTime / media.duration;

              if (Math.abs(nextValue - prevValue) >= (1 / 1000)) { // to reduce the frequency of texture updates
                mediaState.value = nextValue;

                const {barMesh} = videoMesh;
                const {page} = barMesh;
                page.update();
              }

              texture.needsUpdate = true;
            }
          };
          rend.on('update', _update);

          cleanups.push(() => {
            scene.remove(tutorialMesh);

            input.removeListener('trigger', _trigger);
            rend.removeListener('update', _update);
          });
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Home;
