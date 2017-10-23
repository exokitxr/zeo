class Admin {
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
      '/core/engines/bootstrap',
      '/core/engines/input',
      '/core/engines/notification',
    ])
      .then(([
        bootstrap,
        input,
        notification,
      ]) => {
        if (live) {
          const _keydown = e => {
            if ((e.event.keyCode === 192 || e.event.keyCode === 222) && bootstrap.getVrMode() === 'keyboard') { // tilde or quote
              bootstrap.toggleRoamMode();

              const newNotification = notification.addNotification(`Noclip ${bootstrap.getRoamMode() === 'free' ? 'enabled' : 'disabled'}.`);
              setTimeout(() => {
                notification.removeNotification(newNotification);
              }, 3000);

              e.stopImmediatePropagation();
            }
          };
          input.on('keydown', _keydown);

          this._cleanup = () => {
            input.removeListener('keydown', _keydown);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Admin;
