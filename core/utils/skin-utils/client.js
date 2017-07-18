const skinJs = require('skin-js');

const skinUtils = archae => ({
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
        const skin = skinJs(THREE);

        return {
          skin,
        };
      }
    });
  },
  unmount() {
    this._cleanup();
  },
});

module.exports = skinUtils;
