const sfxr = require('sfxr');
const skinLib = require('./lib/skin');

const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';

class Npc {
  mount() {
    const {three, pose, elements, render, utils: {network: networkUtils, random: randomUtils}} = zeo;
    const {THREE, scene} = three;
    const {AutoWs} = networkUtils;
    const {chnkr} = randomUtils;

    const skin = skinLib(THREE);

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _requestImage = url => new Promise((accept, reject) => {
      const img = new Image();

      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(img);
      };

      img.crossOrigin = 'Anonymous';
      img.src = url;
    });

    return Promise.all([
      _requestImage('/archae/npc/img/0'),
      sfxr.requestSfx('archae/npc/sfx/hurt1.ogg'),
    ])
      .then(([
        skinImg,
        hurtSfx,
      ]) => {
        if (live) {
          const meshes = {};

          const _makeMesh = () => {
            const mesh = skin(skinImg);

            const {head, leftArm, rightArm, leftLeg, rightLeg} = mesh;
            mesh.update = (now, heightfieldElement) => {
              const _updateAnimation = () => {
                const {animation} = mesh;

                // mesh.material.uniforms.theta.value = Math.sin((now % 4000) / 4000 * Math.PI * 2) * 0.01 * Math.PI * 2;

                if (animation) {
                  const {mode, positionStart, positionEnd, rotationStart, rotationEnd, duration, startTime} = animation;
                  const positionFactor = Math.min((now - startTime) / duration, 1);
                  const rotationFactor = Math.pow(Math.min((now - startTime) / (duration / 4), 1), 0.5);

                  mesh.position.copy(positionStart).lerp(positionEnd, positionFactor);
                  mesh.quaternion.copy(rotationStart).slerp(rotationEnd, rotationFactor);
                  mesh.updateMatrixWorld();

                  const velocity = positionStart.distanceTo(positionEnd) / duration;
                  const angleRate = 1.5 / velocity;
                  mesh.material.uniforms.theta.value =
                    Math.sin((now % angleRate) / angleRate * Math.PI * 2) * 0.75 *
                    Math.pow(Math.sin(positionFactor * Math.PI), 0.5);

                  if (positionFactor >= 1) {
                    mesh.animation = null;
                  }
                }
              };
              const _updateElevation = () => {
                if (heightfieldElement && heightfieldElement.getElevation) {
                  const elevation = heightfieldElement.getElevation(mesh.position.x, mesh.position.z);
                  
                  if (mesh.position.y !== elevation) {
                    mesh.position.y = elevation;
                    mesh.updateMatrixWorld();
                  }
                }
              };

              _updateAnimation();
              _updateElevation();
            };

            return mesh;
          };

          const connection = new AutoWs(_relativeWsUrl('archae/npcWs'));
          connection.on('message', msg => {
            const e = JSON.parse(msg.data);
            const {type} = e;

            if (type === 'npcStatus') {
              const {id, status} = e;

              if (status) {
                const {position} = status;
                let mesh = meshes[id];
                if (!mesh) {
                  mesh = _makeMesh();
                  scene.add(mesh);
                  meshes[id] = mesh;
                }
                mesh.position.fromArray(position);
                mesh.updateMatrixWorld();
              } else {
                const mesh = meshes[id];
                scene.remove(mesh);
                mesh.destroy();
                delete meshes[id];
              }
            } else if (type === 'npcAnimation') {
              const {id, animation} = e;
              const {mode, positionStart, positionEnd, rotationStart, rotationEnd, duration} = animation;

              const mesh = meshes[id];
              mesh.animation = {
                mode: mode,
                positionStart: new THREE.Vector3().fromArray(positionStart),
                positionEnd: new THREE.Vector3().fromArray(positionEnd),
                rotationStart: new THREE.Quaternion().fromArray(rotationStart),
                rotationEnd: new THREE.Quaternion().fromArray(rotationEnd),
                duration: duration,
                startTime: Date.now(),
              };
            } else {
              console.warn('npc unknown message type', JSON.stringify(type));
            }
          });

          const chunker = chnkr.makeChunker({
            resolution: 32,
            range: 1,
          });

          const _update = () => {
            const _updateMeshes = () => {
              const now = Date.now();
              const heightfieldElement = elements.getEntitiesElement().querySelector(HEIGHTFIELD_PLUGIN);

              for (const id in meshes) {
                const mesh = meshes[id];
                mesh.update(now, heightfieldElement);
              }
            };
            const _updateNpcChunks = () => {
              const {hmd} = pose.getStatus();
              const {worldPosition: hmdPosition} = hmd;
              const {added, removed} = chunker.update(hmdPosition.x, hmdPosition.z);

              for (let i = 0; i < added.length; i++) {
                const chunk = added[i];
                const {x, z} = chunk;
                const e = {
                  method: 'addChunk',
                  args: [x, z],
                };
                const es = JSON.stringify(e);
                connection.send(es);
              }

              for (let i = 0; i < removed.length; i++) {
                const chunk = removed[i];
                const {x, z} = chunk;
                const e = {
                  method: 'removeChunk',
                  args: [x, z],
                };
                const es = JSON.stringify(e);
                connection.send(es);
              }
            };

            _updateMeshes();
            _updateNpcChunks();
          };
          render.on('update', _update);

          this._cleanup = () => {
            for (const id in meshes) {
              const mesh = meshes[id];
              scene.remove(mesh);
              mesh.destroy();
            }

            render.removeListener('update', _update);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}
const _relativeWsUrl = s => {
  const l = window.location;
  return ((l.protocol === 'https:') ? 'wss://' : 'ws://') + l.host + l.pathname + (!/\/$/.test(l.pathname) ? '/' : '') + s;
};

module.exports = Npc;
