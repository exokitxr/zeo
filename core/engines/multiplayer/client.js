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

    return archae.requestPlugins([
      '/core/engines/three',
      '/core/engines/rend',
      '/core/engines/cyborg',
    ]).then(([
      three,
      rend,
      cyborg,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        const world = rend.getCurrentWorld();
        const {player} = world;

        const _requestMesh = modelPath => new Promise((accept, reject) => {
          fetch(modelPath)
            .then(res =>
              res.text()
                .then(s => _asyncJsonParse(s))
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
            const object = new THREE.Object3D();

            mesh.scale.set(0.045, 0.045, 0.045);
            mesh.rotation.order = camera.rotation.order;
            mesh.rotation.y = Math.PI;

            object.add(mesh);

            return object;
          });
        const _requestControllerMesh = () => _requestMesh(controllerModelPath);

        return Promise.all([
          _requestHmdMesh(),
          _requestControllerMesh(),
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
            object.controllers = controllers;

            _updateRemotePlayerMesh(object, status);

            return object;
          };
          const _updateRemotePlayerMesh = (remotePlayerMesh, status) => {
            const {hmd, controllers} = remotePlayerMesh;
            const {left: leftController, right: rightController} = controllers;

            const {hmd: hmdStatus, controllers: controllersStatus} = status;
            const {left: leftControllerStatus, right: rightControllerStatus} = controllersStatus;

            hmd.position.fromArray(hmdStatus.position);
            hmd.quaternion.fromArray(hmdStatus.rotation);

            leftController.position.fromArray(leftControllerStatus.position);
            leftController.quaternion.fromArray(leftControllerStatus.rotation);

            rightController.position.fromArray(rightControllerStatus.position);
            rightController.quaternion.fromArray(rightControllerStatus.rotation);
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

          const singlePlayerInstance = cyborg.getPlayer();
          const initialLocalStatus = singlePlayerInstance.getStatus();
          const localStatus = {
            hmd: {
              position: initialLocalStatus.hmd.position.toArray(),
              rotation: initialLocalStatus.hmd.rotation.toArray(),
            },
            controllers: {
              left: {
                position: initialLocalStatus.controllers.left.position.toArray(),
                rotation: initialLocalStatus.controllers.left.rotation.toArray(),
              },
              right: {
                position: initialLocalStatus.controllers.right.position.toArray(),
                rotation: initialLocalStatus.controllers.right.rotation.toArray(),
              },
            },
          };
          const hmdUpdate = update => {
            const {position, rotation} = update;

            localStatus.hmd.position = position.toArray();
            localStatus.hmd.rotation = rotation.toArray();

            player.updateStatus(localStatus);
          };
          const controllerUpdate = update => {
            const {side, position, rotation} = update;

            localStatus.controllers[side].position = position.toArray();
            localStatus.controllers[side].rotation = rotation.toArray();

            player.updateStatus(localStatus);
          };
          singlePlayerInstance.on('hmdUpdate', hmdUpdate);
          singlePlayerInstance.on('controllerUpdate', controllerUpdate);

          this._cleanup = () => {
            remotePlayerMeshes.forEach(remotePlayerMesh => {
              scene.remove(remotePlayerMesh);
            });

            player.removeListener('playerStatusUpdate', playerStatusUpdate);
            player.removeListener('playerEnter', playerEnter);
            player.removeListener('playerLeave', playerLeave);

            singlePlayerInstance.removeListener('hmdUpdate', hmdUpdate);
            singlePlayerInstance.removeListener('controllerUpdate', controllerUpdate);
          };
        });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _asyncJsonParse = s => new Response(s).json();

module.exports = Multiplayer;
