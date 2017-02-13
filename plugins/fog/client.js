const FOG_DENSITY = 0.05;

class Fog {
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
      '/core/engines/zeo',
    ]).then(([
      zeo,
    ]) => {
      if (live) {
        const {scene} = zeo;

        const updates = [];
        const _update = () => {
          for (let i = 0; i < updates.length; i++) {
            const update = updates[i];
            update();
          }
        };

        class FogElement extends HTMLElement {
          createdCallback() {
            const update = () => {
              const skybox = (() => {
                for (let {parentNode: node} = this; node; node = node.parentNode) {
                  if (/^z-i-skybox$/i.test(node.tagName)) {
                    return node;
                  }
                }
                return null;
              })();

              if (skybox) {
                const sunSphere = skybox.getSunSphere();
                const sunFactor = Math.max(sunSphere.position.y / sunSphere.distance, 0);
                scene.fog.density = sunFactor * FOG_DENSITY;
              } else {
                scene.fog.density = 0;
              }
            };
            updates.push(update);

            this._cleanup = () => {
              updates.splice(updates.indexOf(update), 1);

              scene.fog.density = 0;
            };
          }

          destructor() {
            this._cleanup();
          }
        }
        zeo.registerElement(this, FogElement);

        zeo.on('update', _update);

        this._cleanup = () => {
          zeo.unregisterElement(this);

          zeo.removeListener('update', _update);
        };

        return {};
      }
    });
  }

  unmount() {
    this._cleanup();
  }
};

module.exports = Fog;
