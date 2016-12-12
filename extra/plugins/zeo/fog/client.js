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

    return archae.requestEngines([
      '/core/engines/zeo',
      '/core/engines/rend',
    ]).then(([
      zeo,
      rend,
    ]) => {
      if (live) {
        const {scene} = zeo;
        const world = rend.getCurrentWorld();

        return world.requestMods([
          '/extra/plugins/zeo/skybox',
        ]).then(([
          skybox,
        ]) => {
          if (live) {
            const _update = () => {
              const sunSphere = skybox.getSunSphere();
              const sunFactor = Math.max(sunSphere.position.y / sunSphere.distance, 0);
              scene.fog.density = sunFactor * FOG_DENSITY;
            };

            this._cleanup = () => {
              scene.fog.density = 0;
            };

            return {
              update: _update,
            };
          }
        });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
};

module.exports = Fog;
