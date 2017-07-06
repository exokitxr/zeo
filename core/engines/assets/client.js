import {
  LABEL_WIDTH,
  LABEL_HEIGHT,
  WORLD_LABEL_WIDTH,
  WORLD_LABEL_HEIGHT,

  MENU_WIDTH,
  MENU_HEIGHT,
  WORLD_MENU_WIDTH,
  WORLD_MENU_HEIGHT,
} from './lib/constants/menu';
import menuRender from './lib/render/menu';

const hmdModelPath = 'archae/assets/models/hmd/hmd.json';
const controllerModelPath = 'archae/assets/models/controller/controller.json';
const imgPath = 'archae/assets/img';
const sfxPath = 'archae/assets/sfx';
const SFX = [
  'digi_click',
  'digi_cluck',
  'digi_drop',
  'digi_error_short',
  'digi_ping_down',
  'digi_pip',
  'digi_plink_glass',
  'digi_plink_off',
  'digi_plink',
  'digi_powerdown',
  'digi_select',
  'digi_slide',
];

class Assets {
  mount() {
    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _requestJson = url => fetch(url)
      .then(res => res.json());
    const _requestImage = url => new Promise((accept, reject) => {
      const img = new Image();

      img.onload = () => {
        _cleanup();

        accept(img);
      };
      img.onerror = err => {
        reject(err);
      };

      img.crossOrigin = true;
      img.src = url;

      const _cleanup = () => {
        img.oncanplay = null;
        img.onerror = null;
      };
    });
    const _requestAudio = url => new Promise((accept, reject) => {
      const audio = document.createElement('audio');

      audio.oncanplay = () => {
        _cleanup();

        accept(audio);
      };
      audio.onerror = err => {
        reject(err);
      };

      audio.crossOrigin = true;
      audio.src = url;

      document.body.appendChild(audio);

      const _cleanup = () => {
        audio.oncanplay = null;
        audio.onerror = null;

        document.body.removeChild(audio);
      };
    });
    const _requestSpritesheet = () => Promise.all([
      _requestImage(imgPath + '/spritesheet.png'),
      _requestJson(imgPath + '/spritesheet.json'),
    ])
      .then(([
        img,
        json,
      ]) => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const spriteSize = 16;
        canvas.getSpriteImageData = (x, y, w, h) => ctx.getImageData(x, y, spriteSize, spriteSize);

        const names = Object.keys(json);

        return {
          canvas,
          names,
          json,
        };
      });
    const _requestSfx = () => Promise.all(SFX.map(sfx => _requestAudio(sfxPath + '/' + sfx + '.ogg')))
      .then(audios => {
        const result = {};
        for (let i = 0; i < SFX.length; i++) {
          const sfx = SFX[i];
          const audio = audios[i];

          audio.trigger = () => {
            audio.currentTime = 0;

            if (audio.paused) {
              audio.play();
            }
          };

          result[sfx] = audio;
        }
        return result;
      });

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/three',
        '/core/engines/biolumi',
        '/core/utils/hash-utils',
        '/core/utils/creature-utils',
      ]),
      _requestJson(hmdModelPath),
      _requestJson(controllerModelPath),
      _requestSpritesheet(),
      _requestSfx(),
    ])
      .then(([
        [
          three,
          biolumi,
          hashUtils,
          creatureUtils,
        ],
        hmdModelJson,
        controllerModelJson,
        spritesheet,
        sfx,
      ]) => {
        if (live) {
          const {THREE, scene, camera} = three;
          const {murmur} = hashUtils;

          const menuRenderer = menuRender.makeRenderer({
            creatureUtils,
          });

          const _requestJsonMesh = (modelJson, modelTexturePath) => new Promise((accept, reject) => {
            const loader = new THREE.ObjectLoader();
            loader.setTexturePath(modelTexturePath);
            loader.parse(modelJson, accept);
          });
          const _requestHmdMesh = () => _requestJsonMesh(hmdModelJson, hmdModelPath.replace(/[^\/]+$/, ''))
            .then(mesh => {
              const object = new THREE.Object3D();

              mesh.scale.set(0.045, 0.045, 0.045);
              mesh.rotation.order = camera.rotation.order;
              mesh.rotation.y = Math.PI;

              object.add(mesh);

              return object;
            });
          const _requestControllerMesh = () => _requestJsonMesh(controllerModelJson, controllerModelPath.replace(/[^\/]+$/, ''));

          return Promise.all([
            _requestHmdMesh(),
            _requestControllerMesh(),
          ]).then(([
            hmdModelMesh,
            controllerModelMesh,
          ]) => {
            const _getSpriteImageData = s => {
              const spriteName = spritesheet.names[Math.floor((murmur(s) / 0xFFFFFFFF) * spritesheet.names.length)];
              const spriteCoods = spritesheet.json[spriteName];
              const [x, y] = spriteCoods;
              const imageData = spritesheet.canvas.getSpriteImageData(x, y);
              return imageData;
            };
            const _makePlayerLabelMesh = ({username}) => {
              const labelState = {
                username: username,
              };

              const menuUi = biolumi.makeUi({
                width: LABEL_WIDTH,
                height: LABEL_HEIGHT,
                color: [1, 1, 1, 0],
              });
              const mesh = menuUi.makePage(({
                label: labelState,
              }) => ({
                type: 'html',
                src: menuRenderer.getLabelSrc({
                  label: labelState,
                }),
                x: 0,
                y: 0,
                w: LABEL_WIDTH,
                h: LABEL_HEIGHT,
              }), {
                type: 'label',
                state: {
                  label: labelState,
                },
                worldWidth: WORLD_LABEL_WIDTH,
                worldHeight: WORLD_LABEL_HEIGHT,
              });
              mesh.geometry.applyMatrix(new THREE.Matrix4().makeRotationY(Math.PI));
              mesh.rotation.order = camera.rotation.order;

              const {page} = mesh;
              page.initialUpdate();

              mesh.update = ({hmdStatus, username}) => {
                const {position: hmdPosition, rotation: hmdRotation, scale: hmdScale} = hmdStatus;
                const labelPosition = new THREE.Vector3().fromArray(hmdPosition);
                const labelRotation = (() => {
                  const labelEuler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().fromArray(hmdRotation), camera.rotation.order);
                  labelEuler.x = 0;
                  labelEuler.z = 0;
                  return new THREE.Quaternion().setFromEuler(labelEuler);
                })();
                const labelScale = new THREE.Vector3().fromArray(hmdScale);
                labelPosition.add(new THREE.Vector3(0, WORLD_LABEL_HEIGHT, 0).multiply(labelScale));

                mesh.position.copy(labelPosition);
                mesh.quaternion.copy(labelRotation);
                mesh.scale.copy(labelScale);
                mesh.updateMatrixWorld();

                if (username !== labelState.username) {
                  labelState.username = username;

                  const {page} = mesh;
                  page.update();
                }
              };

              return mesh;
            };
            const _makePlayerMenuMesh = ({username}) => {
              const menuState = {
                username: username,
              };

              const menuUi = biolumi.makeUi({
                width: MENU_WIDTH,
                height: MENU_HEIGHT,
                // color: [1, 1, 1, 0],
              });
              const mesh = menuUi.makePage(({
                menu: menuState,
              }) => ({
                type: 'html',
                src: menuRenderer.getMenuSrc({
                  menu: menuState,
                }),
                x: 0,
                y: 0,
                w: MENU_WIDTH,
                h: MENU_HEIGHT,
              }), {
                type: 'menu',
                state: {
                  menu: menuState,
                },
                worldWidth: WORLD_MENU_WIDTH,
                worldHeight: WORLD_MENU_HEIGHT,
              });
              mesh.rotation.order = camera.rotation.order;

              mesh.update = ({menuStatus, username}) => {
                const {open} = menuStatus;

                if (open) {
                  const {position, rotation, scale} = menuStatus;

                  mesh.position.fromArray(position);
                  mesh.quaternion.fromArray(rotation);
                  mesh.scale.fromArray(scale);
                  mesh.updateMatrixWorld();

                  if (username !== menuState.username) {
                    menuState.username = username;

                    const {page} = mesh;
                    page.update();
                  }

                  if (!mesh.visible) {
                    mesh.visible = true;
                  }
                } else {
                  if (mesh.visible) {
                    mesh.visible = false;
                  }
                }
              };

              return mesh;
            };

            return {
              models: {
                hmdModelMesh,
                controllerModelMesh,
              },
              sfx: sfx,
              getSpriteImageData: _getSpriteImageData,
              makePlayerLabelMesh: _makePlayerLabelMesh,
              makePlayerMenuMesh: _makePlayerMenuMesh,
            };
          });
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Assets;
