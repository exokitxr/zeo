class Marker {
  mount() {
    const {three, player, elements} = zeo;
    const {THREE} = three;

    const markerMeshes = {};
    const _addPlayerMarker = id => {
      const geometry = new THREE.BoxBufferGeometry(0.1, 10, 0.1);
      const material = new THREE.MeshBasicMaterial({
        color: 0x03A9F4,
      });
      const markerMesh = new THREE.Mesh(geometry, material);
      player.getRemoteHmdMesh(id).add(markerMesh);
      markerMeshes[id] = markerMesh;
    };
    const _removePlayerMarker = id => {
      const markerMesh = markerMeshes[id];
      markerMesh.parent.remove(markerMesh);
      markerMeshes[id] = null;
    };

    player.getRemoteStatuses().forEach(status => {
      _addPlayerMarker(status.playerId);
    });

    player.on('playerEnter', ({id}) => {
      _addPlayerMarker(id);
    });
    player.on('playerLeave', ({id}) => {
      _removePlayerMarker(id);
    });

    this._cleanup = () => {
      for (const id in markerMeshes) {
        if (markerMeshes[id]) {
          _removePlayerMarker(id);
        }
      }
      elements.unregisterEntity(this, skinEntity);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Marker;
