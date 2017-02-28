const DEFAULT_USER_HEIGHT = 1.6;

class Trash {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    const cleanups = [];
    this._cleanup = () => {
      live = false;

      const oldCleanups = cleanups.slice();
      for (let i = 0; i < oldCleanups.length; i++) {
        const cleanup = oldCleanups[i];
        cleanup();
      }
    };

    return archae.requestPlugins([
      '/core/engines/input',
      '/core/engines/three',
      '/core/engines/rend',
      '/core/plugins/geometry-utils',
    ]).then(([
      input,
      three,
      rend,
      geometryUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera, renderer} = three;

        const trashGeometry = (() => {
          const geometry = geometryUtils.unindexBufferGeometry(new THREE.BoxBufferGeometry(0.5, 1, 0.5));

          const positionsAttrbiute = geometry.getAttribute('position');
          const positions = positionsAttrbiute.array;
          const numFaces = positions.length / 3 / 3;
          for (let i = 0; i < numFaces; i++) {
            const baseIndex = i * 3 * 3;
            const points = [
              positions.slice(baseIndex, baseIndex + 3),
              positions.slice(baseIndex + 3, baseIndex + 6),
              positions.slice(baseIndex + 6, baseIndex + 9),
            ];
            if (points[0][1] >= 0.5 && points[1][1] >= 0.5 && points[0][1] >= 0.5) {
              for (let j = 0; j < 9; j++) {
                positions[baseIndex + j] = 0;
              }
            }
          }

          return geometry;
        })();
        const solidMaterial = new THREE.MeshPhongMaterial({
          color: 0x808080,
          side: THREE.DoubleSide,
        });

        const trashMesh = (() => {
          const geometry = trashGeometry;
          const material = solidMaterial;

          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.y = -DEFAULT_USER_HEIGHT + 0.5;
          mesh.position.z = -1;
          return mesh;
        })();
        rend.registerMenuMesh('trashMesh', trashMesh);

        this._cleanup = () => {
          scene.remove(mesh);
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Trash;
