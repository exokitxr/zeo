class Bus {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    return archae.requestPlugins([
      '/core/plugins/js-utils',
    ]).then(([
      jsUtils,
    ]) => {
      const {events} = jsUtils;
      const {EventEmitter} = events;

      return new EventEmitter();
    });
  }

  unmount() {
  }
}

module.exports = Bus;
