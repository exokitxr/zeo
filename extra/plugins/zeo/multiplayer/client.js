const asyncJsonParse = require('async-json-parse');

const hmdModelPath = '/archae/models/hmd/hmd.json';
const controllerModelPath = '/archae/models/controller/controller.json';

class Multiplayer {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestEngines([
      '/core/engines/zeo',
    ]).then(([
      zeo,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = zeo;
        const world = zeo.getCurrentWorld();
        const {player} = world;

        const _requestMesh = modelPath => new Promise((accept, reject) => {
          fetch(modelPath)
            .then(res =>
              res.text()
                .then(s => asyncJsonParse(s))
                .then(modelJson => new Promise((accept, reject) => {
                  const loader = new THREE.ObjectLoader();
                  loader.parse(modelJson, accept);
                }))
            )
            .then(accept)
            .catch(reject);
        });
        const _requestHmdMesh = () => _requestMesh(hmdModelPath)
          .then(mesh => {
            mesh.scale.set(0.045, 0.045, 0.045);
            mesh.rotation.order = camera.rotation.order;
            mesh.rotation.y = Math.PI;

            return mesh;
          });
        const _requestControllerMesh = () => _requestMesh(controllerModelPath);

        return Promise.all([
          requestHmdMesh(),
          requestControllerMesh(),
        ]).then(([
          hmdMesh,
          controllerMesh,
        ]) => {
          const remotePlayerMeshes = new Map();

          const _makeRemotePlayerMesh = status => {
            const object = new THREE.Object3D();

            const hmd = hmdMesh.clone();
            object.add(hmd);
            object.hmd = hmd;

            const controllers = (() => {
              const result = [controllerMesh.clone(), controllerMesh.clone()];
              result.left = result[0];
              result.right = result[1];
              return result;
            })();
            controllers.forEach(controller => {
              object.add(controller);
            });
            object.controllers = controller;

            _updateRemotePlayerMesh(object, status);

            return object;
          };
          const _updateRemotePlayerMesh = (remotePlayerMesh, status) => {
            const {hmd, controllers} = remotePlayerMesh;
            const {left: leftController, right: rightController} = controllers;

            const {hmd: hmdStatus, controllers: controllersStatus} = status;
            const {left: leftControllerStatus, right: rightControllerStatus} = controllersStatus;

            hmd.position.fromArray(hmdStatus.position);
            hmd.rotation.fromArray(hmdStatus.rotation);

            leftController.position.fromArray(leftControllerStatus.position);
            leftController.rotation.fromArray(leftControllerStatus.rotation);

            rightController.position.fromArray(rightControllerStatus.position);
            rightController.rotation.fromArray(rightControllerStatus.rotation);
          };

          const playerStatuses = player.getPlayerStatuses();
          playerStatuses.forEach((status, id) => {
            const remotePlayerMesh = _makeRemotePlayerMesh(status);
            scene.add(remotePlayerMesh);
            remotePlayerMeshes.set(id, remotePlayerMesh);
          });

          const playerStatusUpdate = update => {
            const {id, status} = update;
            const remotePlayerMesh = remotePlayerMeshes.get(id);
            _updateRemotePlayerMesh(remotePlayerMesh, status);
          };
          const playerEnter = update => {
            const {id, status} = update;
            const remotePlayerMesh = _makeRemotePlayerMesh(status);
            scene.add(remotePlayerMesh);
            remotePlayerMeshes.set(id, remotePlayerMesh);
          };
          const playerLeave = update => {
            const {id} = update;
            const remotePlayerMesh = remotePlayerMeshes.get(id);
            scene.remove(remotePlayerMesh);
            remotePlayerMeshes.delete(id);
          };
          player.on('playerStatusUpdate', playerStatusUpdate);
          player.on('playerEnter', playerEnter);
          player.on('playerLeave', playerLeave);

          // XXX push status updates with player.updateStatus when controller/camera position changes

          this._cleanup = () => {
            remotePlayerMeshes.forEach(remotePlayerMesh => {
              scene.remove(remotePlayerMesh);
            });
          };
        });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Multiplayer;
