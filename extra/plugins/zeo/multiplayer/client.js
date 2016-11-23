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

        const remotePlayerMeshes = new Map();

        const _makeRemotePlayerMesh = status => {
          // XXX
        };
        const _updateRemotePlayerMesh = (remotePlayerMesh, status) => {
          // XXX
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
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Multiplayer;
