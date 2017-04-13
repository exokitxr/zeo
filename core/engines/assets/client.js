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
      ]),
      _requestJson(hmdModelPath),
      _requestJson(controllerModelPath),
    ])
      .then(([
        [
          three,
        ],
        hmdModelJson,
        controllerModelJson,
      ]) => {
        if (live) {
          const {THREE, scene, camera} = three;

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
          ]) => ({
            hmdModelMesh,
            controllerModelMesh,
          }));
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Assets;
