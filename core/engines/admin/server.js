const repl = require('repl');

const getIP = require('external-ip')();
const openurl = require('openurl');

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
        noOpen,
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

            if (!noOpen) {
              openurl.open(serverUrl, err => {
                console.warn('could not open ' + serverUrl + ' in a browser');
              });
            }

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
            if (!noTty) {
              const r = repl.start({ prompt: 'zeo> ' });
              r.context.status = () => {
                console.log('status');
              };
              r.context.addMod = mod => {
                console.log('add mod', mod);
              };
              r.context.removeMod = mod => {
                console.log('remove mod', mod);
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
