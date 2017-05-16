import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,

  DEFAULT_USER_HEIGHT,
} from './lib/constants/menu';
import menuRenderer from './lib/render/menu';

const SIDES = ['left', 'right'];
const VIDEO_SRC = 'https://raw.githubusercontent.com/modulesio/zeo-data/5b770a8dda3003b69be7045af99da9ed9ed591e1/video/tutorial.mp4';

class Home {
  mount() {
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

    const _requestVideo = () => new Promise((accept, reject) => {
      const video = document.createElement('video');

      const _cleanup = () => {
        video.oncanplaythrough = null;
        video.onerror = null;
      };
      video.oncanplaythrough = () => {
        _cleanup();

        accept(video);
      };
      video.onerror = err => {
        _cleanup();

        reject(err);
      };

      video.crossOrigin = 'Anonymous';
      video.src = VIDEO_SRC;
    });

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/bootstrap',
        '/core/engines/input',
        '/core/engines/three',
        '/core/engines/webvr',
        '/core/engines/biolumi',
        '/core/engines/somnifer',
        '/core/engines/rend',
      ]),
      _requestVideo(),
    ])
      .then(([
        [
          bootstrap,
          input,
          three,
          webvr,
          biolumi,
          somnifer,
          rend,
        ],
        video,
      ]) => {
        if (live) {
          const {THREE, scene, renderer} = three;

          const transparentMaterial = biolumi.getTransparentMaterial();

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
                // nothing
              }) => {
                return {
                  type: 'html',
                  src: menuRenderer.getHomeSrc(),
                  x: 0,
                  y: 0,
                  w: WIDTH,
                  h: HEIGHT,
                };
              }, {
                type: 'home',
                state: {
                  // nothing
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

              const viewportMesh = (() => {
                const worldWidth = WORLD_WIDTH;
                const worldHeight = WORLD_HEIGHT * ((HEIGHT - 200) / HEIGHT);
                const geometry = new THREE.PlaneBufferGeometry(worldWidth, worldHeight);
                const texture = new THREE.Texture(
                  video,
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
                mesh.position.y = (WORLD_HEIGHT / 2) - (worldHeight / 2);
                mesh.position.z = 0.001;

                return mesh;
              })();
              object.add(viewportMesh);
              object.viewportMesh = viewportMesh;

              const playMesh = (() => {
                const worldWidth = WORLD_WIDTH;
                const worldHeight = WORLD_HEIGHT * ((HEIGHT - 200) / HEIGHT);
                const menuUi = biolumi.makeUi({
                  width: WIDTH,
                  height: HEIGHT - 200,
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
                  h: HEIGHT - 200,
                }), {
                  type: 'videoPlay',
                  state: {
                    media: mediaState,
                  },
                  worldWidth: worldWidth,
                  worldHeight: worldHeight,
                });
                mesh.position.y = (WORLD_HEIGHT / 2) - (worldHeight / 2);
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
              soundBody.setInputElement(video);
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
          const _finish = () => {
            bootstrap.setTutorialFlag(false);

            if (!video.paused) {
              video.pause();
            }

            mediaState.paused = true;
            mediaState.value = 0;
            const {playMesh, barMesh} = videoMesh;
            const {page: playPage} = playMesh;
            playPage.update();
            const {page: barPage} = barMesh;
            barPage.update();

            tutorialMesh.visible = false;
          };

          const _trigger = e => {
            const {side} = e;
            const hoverState = rend.getHoverState(side);
            const {anchor} = hoverState;
            const onclick = (anchor && anchor.onclick) || '';

            let match;
            if (onclick === 'home:done') {
              _finish();
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
            }
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
