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
import protocolUtils from './lib/utils/protocol-utils';
import sfxr from 'sfxr';

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
  'drop',
];
const NUM_POSITIONS_CHUNK = 200 * 1024;

class Assets {
  mount() {
    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const worker = new Worker('archae/plugins/_core_engines_resource/build/worker.js');
    const queue = [];
    worker.requestSpriteGeometry = (imageData, size) => new Promise((accept, reject) => {
      const {width, height, data: {buffer: imageDataBuffer}} = imageData;
      const buffer = new ArrayBuffer(NUM_POSITIONS_CHUNK);
      worker.postMessage({
        width,
        height,
        size,
        imageDataBuffer,
        buffer,
      }, [imageDataBuffer, buffer]);
      queue.push(buffer => {
        accept(protocolUtils.parseGeometry(buffer));
      });
    });
    worker.onmessage = e => {
      const {data: buffer} = e;
      const cb = queue.shift();
      cb(buffer);
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
    const _requestSpritesheet = () => Promise.all([
      _requestImage(imgPath + '/spritesheet.png'),
      _requestJson(imgPath + '/sprites.json'),
      _requestJson(imgPath + '/assets.json'),
    ])
      .then(([
        img,
        spriteCoords,
        assetSprites,
      ]) => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const spriteSize = 16;
        canvas.getSpriteImageData = (x, y, w, h) => ctx.getImageData(x, y, spriteSize, spriteSize);

        const spriteNames = Object.keys(spriteCoords);

        return {
          canvas,
          spriteNames,
          spriteCoords,
          assetSprites,
        };
      });
    const _requestSfx = () => Promise.all(SFX.map(sfx => sfxr.requestSfx(sfxPath + '/' + sfx + '.ogg')))
      .then(audios => {
        const result = {};
        for (let i = 0; i < SFX.length; i++) {
          result[SFX[i]] = audios[i];
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
        plugins,
        hmdModelJson,
        controllerModelJson,
        spritesheet,
        sfx,
      ]) => {
        if (live) {
          const [
            three,
            biolumi,
            hashUtils,
            creatureUtils,
          ] = plugins;
          const {THREE, camera} = three;

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
            Promise.resolve(plugins),
            _requestHmdMesh(),
            _requestControllerMesh(),
            Promise.resolve(spritesheet),
            Promise.resolve(sfx),
          ]);
        }
      })
      .then(([
        [
          three,
          biolumi,
          hashUtils,
          creatureUtils,
        ],
        hmdModelMesh,
        controllerModelMesh,
        spritesheet,
        sfx,
      ]) => {
        if (live) {
          const {THREE, camera} = three;
          const {murmur} = hashUtils;
          const menuRenderer = menuRender.makeRenderer({
            creatureUtils,
          });

          const _getSpriteImageData = s => {
            const spriteName = spritesheet.assetSprites[s] ||
              spritesheet.spriteNames[Math.floor((murmur(s) / 0xFFFFFFFF) * spritesheet.spriteNames.length)];
            const spriteCoods = spritesheet.spriteCoords[spriteName];
            const [x, y] = spriteCoods;
            const imageData = spritesheet.canvas.getSpriteImageData(x, y);
            return imageData;
          };
          const _requestSpriteGeometry = (imageData, size) => worker.requestSpriteGeometry(imageData, size);
          /* const _makePlayerLabelMesh = ({username}) => {
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
          }; */
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

            const {page} = mesh;
            page.update();

            mesh.update = menuStatus => {
              if (menuStatus.open) {
                if (!menuStatus.position.equals(mesh.position) || !menuStatus.rotation.equals(mesh.rotation) || !menuStatus.scale.equals(mesh.scale)) {
                  mesh.position.copy(menuStatus.position);
                  mesh.quaternion.copy(menuStatus.rotation);
                  mesh.scale.copy(menuStatus.scale);
                  mesh.updateMatrixWorld();
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
            requestSpriteGeometry: _requestSpriteGeometry,
            // makePlayerLabelMesh: _makePlayerLabelMesh,
            makePlayerMenuMesh: _makePlayerMenuMesh,
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Assets;
