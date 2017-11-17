const repl = require('repl');

const getIP = require('external-ip')();

class Admin {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {
      metadata: {
        server: {
          url: serverUrl,
          enabled: serverEnabled,
        },
        protocolString,
        port,
        password,
        noTty,
      },
    } = archae;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/world',
    ])
      .then(([
        world,
      ]) => {
        const _log = () => new Promise((accept, reject) => {
          if (serverEnabled) {
            if (password !== null) {
              console.log(`Reminder: server password is ${JSON.stringify(password)}`);
            }

            console.log('Local URL: ' + serverUrl);

            getIP((err, ip) => {
              console.log('Remote URL: ' + (!err ? (protocolString + '://' + ip + ':' + port) : 'firewalled'));

              accept();
            });
          } else {
            accept();
          }
        });

        return _log()
          .then(() => {
            if (serverEnabled && !noTty) {
              const r = repl.start({ prompt: 'zeo> ' });
              r.context.status = () => {
                console.log('STATUS');
              };
              r.context.addMod = mod => {
                world.addMod(mod);
              };
              r.context.removeMod = mod => {
                if (!world.removeMod(mod)) {
                  console.warn('no such mod:', JSON.stringify(mod));
                }
              };
              r.on('exit', () => {
                process.exit();
              });
            }
          });
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Admin;
