const {
  NUM_CELLS,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS_CHUNK = 500 * 1024;

class Chest {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render, pose} = zeo;
    const {THREE, scene, camera} = three;

    const chestMaterial = new THREE.MeshBasicMaterial({
      // color: 0xFFFFFF,
      // shininess: 0,
      // shading: THREE.FlatShading,
      vertexColors: THREE.VertexColors,
      // side: THREE.DoubleSide,
    });

    const worker = new Worker('archae/plugins/_plugins_chest/build/worker.js');
    const queue = [];
    worker.requestGeometry = () => new Promise((accept, reject) => {
      const buffer = new ArrayBuffer(NUM_POSITIONS_CHUNK * 3);
      worker.postMessage({
        buffer,
      }, [buffer]);
      queue.push(buffer => {
        accept(buffer);
      });
    });
    worker.onmessage = e => {
      const {data: buffer} = e;
      const cb = queue.shift();
      cb(buffer);
    };

    const _requestChestGeometry = () => worker.requestGeometry()
      .then(chestChunkBuffer => protocolUtils.parseChestChunk(chestChunkBuffer));
    const _makeChestMesh = chestGeometry => {
      const {positions, normals, colors, indices/*, heightRange*/} = chestGeometry;

      const geometry = (() => {
        let geometry = new THREE.BufferGeometry();
        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        // geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
        geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        // const [minY, maxY] = heightRange;
        geometry.boundingSphere = new THREE.Sphere(
          new THREE.Vector3(
            0,
            0,
            0
          ),
          10
        );

        return geometry;
      })();
      const material = chestMaterial;

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(0, 31, 0);
      mesh.updateMatrixWorld();
      // mesh.frustumCulled = false;

      mesh.destroy = () => {
        geometry.dispose();
      };

      return mesh;
    };

    return _requestChestGeometry()
      .then(chestGeometry => {
        const chestMesh = _makeChestMesh(chestGeometry);
        scene.add(chestMesh);

        worker.terminate();

        const _update = () => {
          // XXX
        };
        render.on('update', _update);

        this._cleanup = () => {
          scene.remove(chestMesh);
          chestMesh.destroy();

          chestMaterial.dispose();

          render.removeListener('update', _update);
        };
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Chest;
