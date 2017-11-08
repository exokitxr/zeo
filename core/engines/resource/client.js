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
import WebFont from 'webfontloader';
import sfxr from 'sfxr';

const hmdModelPath = 'archae/assets/models/hmd/hmd.json';
const controllerModelPath = 'archae/assets/models/controller/controller.json';
const imgPath = 'archae/assets/img';
const sfxPath = 'archae/assets/sfx';
const API_PREFIX = 'https://my-site.zeovr.io/';
const ASSET_SHADER = {
  uniforms: {
    theta: {
      type: 'f',
      value: 0,
    },
  },
  vertexShader: [
    "uniform float theta;",
    "attribute vec3 color;",
    "attribute vec2 dy;",
    "varying vec3 vcolor;",
    "void main() {",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x - dy.x + (dy.x*cos(theta) - dy.y*sin(theta)), position.y, position.z - dy.y + (dy.y*cos(theta) + dy.x*sin(theta)), 1.0);",
    "  vcolor = color;",
    "}"
  ].join("\n"),
  fragmentShader: [
    "varying vec3 vcolor;",
    "void main() {",
    "  gl_FragColor = vec4(vcolor, 1.0);",
    "}"
  ].join("\n")
};
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

class Assets {
  mount() {
    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _requestJson = url => fetch(url, {
      credentials: 'include',
    })
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
    const _requestFonts = () => new Promise((accept, reject) => {
      WebFont.load({
        google: {
          families: ['Open Sans']
        },
        active: () => {
          accept();
        },
        inactive: () => {
          const err = new Error('fonts failed to load');
          reject(err);
        },
      });
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
      ]),
      _requestJson(hmdModelPath),
      _requestJson(controllerModelPath),
      _requestImage(imgPath + '/cursor.svg'),
      _requestFonts(),
      _requestSfx(),
    ])
      .then(([
        plugins,
        hmdModelJson,
        controllerModelJson,
        cursorImg,
        fonts,
        sfx,
      ]) => {
        if (live) {
          const [
            three,
            biolumi,
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
            Promise.resolve(cursorImg),
            Promise.resolve(sfx),
          ]);
        }
      })
      .then(([
        [
          three,
          biolumi,
        ],
        hmdModelMesh,
        controllerModelMesh,
        cursorImg,
        sfx,
      ]) => {
        if (live) {
          const {THREE, camera} = three;
          /* const menuRenderer = menuRender.makeRenderer({
            creatureUtils,
          }); */

          const assetsMaterial = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(ASSET_SHADER.uniforms),
            vertexShader: ASSET_SHADER.vertexShader,
            fragmentShader: ASSET_SHADER.fragmentShader,
            // transparent: true,
            // depthTest: false,
          });

          const _resArrayBuffer = res => {
            if (res.status >= 200 && res.status < 300) {
              return res.arrayBuffer();
            } else if (res.status === 404) {
              return Promise.resolve(null);
            } else {
              return Promise.reject({
                status: res.status,
                stack: 'API returned invalid status code: ' + res.status,
              });
            }
          };

          const _getItemImageData = name => fetch(API_PREFIX + 'imgData/items/' + name)
            .then(_resArrayBuffer);
          const _getModImageData = name => fetch(API_PREFIX + 'imgData/mods/' + name)
            .then(_resArrayBuffer);
          const _getFileImageData = name => fetch(API_PREFIX + 'imgData/files/' + name)
            .then(_resArrayBuffer);
          const _getSkinImageData = name => fetch(API_PREFIX + 'imgData/skins/' + name)
            .then(_resArrayBuffer);
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
            materials: {
              assets: assetsMaterial,
            },
            cursorImg,
            sfx: sfx,
            getItemImageData: _getItemImageData,
            getModImageData: _getModImageData,
            getFileImageData: _getFileImageData,
            getSkinImageData: _getSkinImageData,
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
