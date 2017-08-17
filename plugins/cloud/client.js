const {
  NUM_CELLS,

  RANGE,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS_CHUNK = 200 * 1024;
const CLOUD_SPEED = 1;
const DAY_NIGHT_SKYBOX_PLUGIN = 'plugins-day-night-skybox';

const CLOUD_SHADER = {
  uniforms: {
    /* worldTime: {
      type: 'f',
      value: 0,
    }, */
    sunIntensity: {
      type: 'f',
      value: 0,
    },
  },
  vertexShader: `\
// uniform float worldTime;
varying vec3 vN;
varying vec3 vP;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, position.y, position.z, 1.0);
  vN = normal;
  vP = normalize(vec3(position.x, 0.0, position.z));
}
`,
  fragmentShader: `\
uniform float sunIntensity;
varying vec3 vN;
varying vec3 vP;

void main() {
  gl_FragColor = vec4(vec3(0.2 + (1.0 * sunIntensity) + (0.1 + (0.4 * sunIntensity)) * dot(vN, vP)), 0.8);
}
`
};

class Cloud {
  mount() {
    const {three, elements, render, pose, stage, utils: {js: {mod, bffr}, geometry: geometryUtils, random: {alea, chnkr}}} = zeo;
    const {THREE, camera} = three;

    const _getChunkIndex = (x, z) => (mod(x, 0xFFFF) << 16) | mod(z, 0xFFFF);

    const cloudsMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(CLOUD_SHADER.uniforms),
      vertexShader: CLOUD_SHADER.vertexShader,
      fragmentShader: CLOUD_SHADER.fragmentShader,
      transparent: true,
      // depthWrite: false,
    });
    /* const cloudsMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
    }); */

    const buffers = bffr(NUM_POSITIONS_CHUNK * 3, (RANGE + 1) * (RANGE + 1) * 2);

    const worker = new Worker('archae/plugins/_plugins_cloud/build/worker.js');
    const queue = [];
    worker.requestGenerate = (x, y) => new Promise((accept, reject) => {
      const buffer = buffers.alloc();
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

    const _requestCloudGenerate = (x, y) => worker.requestGenerate(x, y)
      .then(cloudChunkBuffer => protocolUtils.parseCloudGeometry(cloudChunkBuffer));

    const updates = [];

    const cloudEntity = { // XXX make this a non-entity
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
        const chunker = chnkr.makeChunker({
          resolution: NUM_CELLS,
          range: RANGE,
        });

        const cloudChunkMeshes = {};
        const _makeCloudChunkMesh = (cloudChunkData, x, z) => {
          const mesh = (() => {
            const {positions, normals, indices, boundingSphere} = cloudChunkData;

            const geometry = new THREE.BufferGeometry();
            geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
            geometry.setIndex(new THREE.BufferAttribute(indices, 1));
            geometry.boundingSphere = new THREE.Sphere(
              new THREE.Vector3().fromArray(boundingSphere, 0),
              boundingSphere[3]
            );
            /* mesh.position.x = dx;
            mesh.updateMatrixWorld();
            mesh.frustumCulled = false; */
            const material = cloudsMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
          })();

          mesh.destroy = () => {
            mesh.geometry.dispose();

            const {buffer} = cloudChunkData;
            buffers.free(buffer);
          };

          return mesh;
        };
        const _requestRefreshCloudChunks = () => {
          const {hmd} = pose.getStatus();
          const {worldPosition: hmdPosition} = hmd;
          // const dx = (world.getWorldTime() / 1000) * CLOUD_SPEED;
          const {added, removed} = chunker.update(hmdPosition.x/* + dx*/, hmdPosition.z);

          const addedPromises = added.map(chunk => {
            const {x, z} = chunk;
            return _requestCloudGenerate(x, z)
              .then(cloudChunkData => {
                const cloudChunkMesh = _makeCloudChunkMesh(cloudChunkData, x, z);
                stage.add('main', cloudChunkMesh);

                cloudChunkMeshes[_getChunkIndex(x, z)] = cloudChunkMesh;

                chunk.data = cloudChunkMesh;
              })
          });
          return Promise.all(addedPromises)
            .then(() => {
              removed.forEach(chunk => {
                const {data: cloudChunkMesh} = chunk;
                stage.remove('main', cloudChunkMesh);

                cloudChunkMeshes[_getChunkIndex(chunk.x, chunk.z)] = null;

                cloudChunkMesh.destroy();
              });
            })
        }

        let live = true;
        const _recurse = () => {
          _requestRefreshCloudChunks()
            .then(() => {
              if (live) {
                setTimeout(_recurse, 1000);
              }
            })
            .catch(err => {
              if (live) {
                console.warn(err);

                setTimeout(_recurse, 1000);
              }
            });
        };
        _recurse();

        const update = () => {
          const dayNightSkyboxEntity = elements.getEntitiesElement().querySelector(DAY_NIGHT_SKYBOX_PLUGIN);
          const sunIntensity = (dayNightSkyboxEntity && dayNightSkyboxEntity.getSunIntensity) ? dayNightSkyboxEntity.getSunIntensity() : 0;

          // cloudsMaterial.uniforms.worldTime.value = world.getWorldTime();
          cloudsMaterial.uniforms.sunIntensity.value = sunIntensity;
        };
        updates.push(update);

        entityElement._cleanup = () => {
          live = false;

          for (const index in cloudChunkMeshes) {
            const cloudChunkMesh = cloudChunkMeshes[index];
            if (cloudChunkMesh) {
              stage.remove('main', cloudChunkMesh);
            }
          }

          updates.splice(updates.indexOf(update), 1);
        };
      },
      entityRemovedCallback(entityElement) {
        entityElement._cleanup();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        switch (name) {
          case 'position': {
            const {cloudsMesh} = entityElement;

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
