const geometryutils = require('geometryutils');

const geometryUtils = archae => ({
  mount() {
    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/three',
    ]).then(([
      three,
    ]) => {
      if (live) {
        const {THREE} = three;

        const result = geometryutils({
          THREE,
        });
        return Promise.resolve(result);
      }
    });
  },
  unmount() {
    this._cleanup();
  },
});

module.exports = geometryUtils;
