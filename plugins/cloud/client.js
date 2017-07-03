const {
  NUM_CELLS,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS_CHUNK = 200 * 1024;
const CLOUD_SPEED = 1;

const CLOUD_SHADER = {
  uniforms: {
    worldTime: {
      type: 'f',
      value: 0,
    },
  },
  vertexShader: [
    "uniform float worldTime;",
    "void main() {",
    `  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x - ((worldTime / 1000.0) * ${CLOUD_SPEED.toFixed(8)}), position.y, position.z, 1.0);`,
    "}"
  ].join("\n"),
  fragmentShader: [
    "void main() {",
    "  gl_FragColor = vec4(1.0, 1.0, 1.0, 0.5);",
    "}"
  ].join("\n")
};

class Cloud {
  mount() {
    const {three, elements, render, pose, world, utils: {geometry: geometryUtils, random: {alea, chnkr}}} = zeo;
    const {THREE, scene, camera} = three;

    const _resArrayBuffer = res => {
      if (res.status >= 200 && res.status < 300) {
        return res.arrayBuffer();
      } else {
        const err = new Error('invalid status code: ' + res.status);
        return Promise.reject(err);
      }
    };
    const _requestCloudGenerate = (x, y) => worker.requestGenerate(x, y)
      .then(cloudChunkBuffer => protocolUtils.parseCloudGeometry(cloudChunkBuffer));

    const cloudsMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(CLOUD_SHADER.uniforms),
      vertexShader: CLOUD_SHADER.vertexShader,
      fragmentShader: CLOUD_SHADER.fragmentShader,
      transparent: true,
      // depthTest: false,
    });
    /* const cloudsMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
    }); */

    const worker = new Worker('archae/plugins/_plugins_cloud/build/worker.js');
    const queue = [];
    worker.requestGenerate = (x, y) => new Promise((accept, reject) => {
      const buffer = new ArrayBuffer(NUM_POSITIONS_CHUNK * 3);
      worker.postMessage({
        x,
        y,
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

    const updates = [];

    const cloudEntity = {
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0, 0, 0,
            0, 0, 0, 1,
            1, 1, 1,
          ],
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = entityElement.getEntityApi();
        const entityObject = entityElement.getObject();

        const chunker = chnkr.makeChunker({
          resolution: NUM_CELLS,
          range: 3,
        });

        const cloudChunkMeshes = [];
        const _makeCloudChunkMesh = (cloudChunkData, dx) => {
          const {positions, indices} = cloudChunkData;

          const geometry = new THREE.BufferGeometry();
          geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
          const numPositions = positions.length / 3;
          geometry.setIndex(new THREE.BufferAttribute(indices, 1));

          const material = cloudsMaterial;

          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.x = dx;
          mesh.updateMatrixWorld();
          mesh.frustumCulled = false;

          mesh.destroy = () => {
            geometry.dispose();
          };

          return mesh;
        };
        const _requestRefreshCloudChunks = () => {
          const {hmd} = pose.getStatus();
          const {worldPosition: hmdPosition} = hmd;
          const dx = (world.getWorldTime() / 1000) * CLOUD_SPEED;
          const {added, removed} = chunker.update(hmdPosition.x + dx, hmdPosition.z);

          const addedPromises = added.map(chunk => {
            const {x, z} = chunk;
            const ax = Math.floor(((x * NUM_CELLS) - dx) / NUM_CELLS);
            const az = z;

            return _requestCloudGenerate(ax, az)
              .then(cloudChunkData => {
                const cloudChunkMesh = _makeCloudChunkMesh(cloudChunkData, dx);
                scene.add(cloudChunkMesh);
                cloudChunkMeshes.push(cloudChunkMesh);
                chunk.data = cloudChunkMesh;
              });
          });
          return Promise.all(addedPromises)
            .then(() => {
              removed.forEach(chunk => {
                const {data: cloudChunkMesh} = chunk;
                scene.remove(cloudChunkMesh);
                cloudChunkMeshes.splice(cloudChunkMeshes.indexOf(cloudChunkMesh), 1);
                cloudChunkMesh.destroy();
              });
            })
        };
        let updating = false;
        let updateQueued = false;
        const tryCloudChunkUpdate = () => {
          if (!updating) {
            updating = true;

            const done = () => {
              updating = false;

              if (updateQueued) {
                updateQueued = false;

                tryCloudChunkUpdate();
              }
            };

            _requestRefreshCloudChunks()
              .then(done)
              .catch(err => {
                console.warn(err);

                done();
              });
          } else {
            updateQueued = true;
          }
        };

        const update = () => {
          tryCloudChunkUpdate();

          cloudsMaterial.uniforms.worldTime.value = world.getWorldTime();
        };
        updates.push(update);

        entityApi._cleanup = () => {
          for (let i = 0; i < cloudChunkMeshes.length; i++) {
            const cloudChunkMesh = cloudChunkMeshes[i];
            scene.remove(cloudChunkMesh);
          }

          updates.splice(updates.indexOf(update), 1);
        };
      },
      entityRemovedCallback(entityElement) {
        const entityApi = entityElement.getEntityApi();

        entityApi._cleanup();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getEntityApi();

        switch (name) {
          case 'position': {
            const {cloudsMesh} = entityApi;

            cloudsMesh.position.set(newValue[0], newValue[1], newValue[2]);
            cloudsMesh.quaternion.set(newValue[3], newValue[4], newValue[5], newValue[6]);
            cloudsMesh.scale.set(newValue[7], newValue[8], newValue[9]);

            break;
          }
        }
      },
    };
    elements.registerEntity(this, cloudEntity);

    const _update = () => {
      for (let i = 0; i < updates.length; i++) {
        const update = updates[i];
        update();
      }
    };
    render.on('update', _update);

    this._cleanup = () => {
      elements.unregisterEntity(this, cloudEntity);

      render.removeListener('update', _update);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Cloud;
