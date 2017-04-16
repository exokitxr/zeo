import {
  WIDTH,
  HEIGHT,

  WORLD_WIDTH,
  WORLD_HEIGHT,
} from './lib/constants/menu';
import menuRender from './lib/render/menu';

const hmdModelPath = 'archae/assets/models/hmd/hmd.json';
const controllerModelPath = 'archae/assets/models/controller/controller.json';

class Assets {
  mount() {
    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _requestJson = url => fetch(url)
      .then(res => res.json());

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/three',
        '/core/engines/biolumi',
        '/core/utils/creature-utils',
      ]),
      _requestJson(hmdModelPath),
      _requestJson(controllerModelPath),
    ])
      .then(([
        [
          three,
          biolumi,
          creatureUtils,
        ],
        hmdModelJson,
        controllerModelJson,
      ]) => {
        if (live) {
          const {THREE, scene, camera} = three;

          const menuRenderer = menuRender.makeRenderer({
            creatureUtils,
          });

          const _requestModelMesh = modelJson => new Promise((accept, reject) => {
            const loader = new THREE.ObjectLoader();
            loader.parse(modelJson, accept);
          });
          const _requestHmdMesh = () => _requestModelMesh(hmdModelJson)
            .then(mesh => {
              const object = new THREE.Object3D();

              mesh.scale.set(0.045, 0.045, 0.045);
              mesh.rotation.order = camera.rotation.order;
              mesh.rotation.y = Math.PI;

              object.add(mesh);

              return object;
            });
          const _requestControllerMesh = () => _requestModelMesh(controllerModelJson);

          return Promise.all([
            _requestHmdMesh(),
            _requestControllerMesh(),
          ]).then(([
            hmdModelMesh,
            controllerModelMesh,
          ]) => {
            const _makePlayerLabelMesh = ({username}) => {
              const labelState = {
                username: username,
              };

              const menuUi = biolumi.makeUi({
                width: WIDTH,
                height: HEIGHT,
                color: [1, 1, 1, 0],
              });
              const mesh = menuUi.addPage(({
                label: labelState,
              }) => ({
                type: 'html',
                src: menuRenderer.getLabelSrc({
                  label: labelState,
                }),
                x: 0,
                y: 0,
                w: WIDTH,
                h: HEIGHT,
              }), {
                type: 'label',
                state: {
                  label: labelState,
                },
                worldWidth: WORLD_WIDTH,
                worldHeight: WORLD_HEIGHT,
              });
              mesh.geometry.applyMatrix(new THREE.Matrix4().makeRotationY(Math.PI));
              mesh.rotation.order = camera.rotation.order;

              mesh.update = ({hmdStatus, username}) => {
                const labelPosition = new THREE.Vector3().fromArray(hmdStatus.position).add(new THREE.Vector3(0, WORLD_HEIGHT, 0));
                mesh.position.copy(labelPosition);
                const labelRotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().fromArray(hmdStatus.rotation), camera.rotation.order);
                labelRotation.x = 0;
                labelRotation.z = 0;
                const labelQuaternion = new THREE.Quaternion().setFromEuler(labelRotation);
                mesh.quaternion.copy(labelQuaternion);
                // mesh.scale.copy(gamepadStatus.scale);

                if (username !== labelState.username) {
                  labelState.username = username;

                  menuUi.update();
                }
              };

              return mesh;
            };

            return {
              models: {
                hmdModelMesh,
                controllerModelMesh,
              },
              makePlayerLabelMesh: _makePlayerLabelMesh,
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
