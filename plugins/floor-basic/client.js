const FLOOR_SIZE = 20;

class Floor {
  mount() {
    const {three: {THREE, scene}, elements, utils: {geometry: geometryUtils}} = zeo;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _requestImage = src => new Promise((accept, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(err);
      };
    });

    return _requestImage('/archae/plugins/floor-basic/serve/graphy.png')
      .then(graphImg => {
        if (live) {
          const floorMesh = (() => {
            const geometry = new THREE.PlaneBufferGeometry(FLOOR_SIZE, FLOOR_SIZE)
              .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(
                new THREE.Quaternion().setFromUnitVectors(
                  new THREE.Vector3(0, 0, 1),
                  new THREE.Vector3(0, 1, 0)
                )
              ));
            const uvs = geometry.attributes.uv.array;
            const numUvs = uvs.length / 2;
            for (let i = 0; i < numUvs; i++) {
              uvs[i * 2 + 0] *= FLOOR_SIZE / 10 * 2;
              uvs[i * 2 + 1] *= FLOOR_SIZE / 10;
            }
            const texture = new THREE.Texture(
              graphImg,
              THREE.UVMapping,
              THREE.RepeatWrapping,
              THREE.RepeatWrapping,
              THREE.NearestFilter,
              THREE.NearestFilter,
              THREE.RGBAFormat,
              THREE.UnsignedByteType,
              1
            );
            texture.needsUpdate = true;
            const material = new THREE.MeshBasicMaterial({
              map: texture,
              side: THREE.DoubleSide,
            });
            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
          })();
          scene.add(floorMesh);

          this._cleanup = () => {
            scene.remove(floorMesh);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Floor;
