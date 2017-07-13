const skin = require('./lib/skin');

class Npc {
  mount() {
    const {three, elements, render, utils: {network: networkUtils}} = zeo;
    const {THREE, scene} = three;
    const {AutoWs} = networkUtils;

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

    return _requestImage('/archae/npc/img/0')
      .then(skinImg => {
        if (live) {
          const meshes = {};

          const _makeMesh = () => {
            const mesh = skin(THREE, skinImg);

            const {head, leftArm, rightArm, leftLeg, rightLeg} = mesh;
            mesh.update = now => {
              const angle = Math.sin((now % 2000) / 2000 * Math.PI * 2) * Math.PI/4;

              head.rotation.y = angle;
              head.updateMatrixWorld();

              leftArm.rotation.x = angle;
              leftArm.updateMatrixWorld();

              rightArm.rotation.x = -angle;
              rightArm.updateMatrixWorld();

              leftLeg.rotation.x = -angle;
              leftLeg.updateMatrixWorld();

              rightLeg.rotation.x = angle;
              rightLeg.updateMatrixWorld();
            };
            mesh.destroy = () => {
              // XXX
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
                const {position: [x, z]} = status;
                let mesh = meshes[id];
                if (!mesh) {
                  mesh = _makeMesh();
                  scene.add(mesh);
                  meshes[id] = mesh;
                }
                mesh.position.set(x, 30, z);
                mesh.updateMatrixWorld();
              } else {
                const mesh = meshes[id];
                scene.remove(mesh);
                mesh.destroy();
              }
            } else {
              console.warn('npc unknown message type', JSON.stringify(type));
            }
          });

          const _update = () => {
            const now = Date.now();

            for (const id in meshes) {
              const mesh = meshes[id];
              mesh.update(now);
            }
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
