const path = require('path');
const https = require('https');
const repl = require('repl');

const semver = require('semver');
const htmlTagNames = require('html-tag-names');
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
                console.log('STATUS');
              };
              r.context.addMod = mod => {
                console.log('add mod', mod);

                _getModuleVersion(mod)
                  .then(version => {
                    const itemSpec = {
                      type: 'entity',
                      id: _makeId(),
                      name: mod,
                      displayName: mod,
                      module: mod,
                      version: version,
                      tagName: _makeTagName(mod),
                      attributes: {},
                      metadata: {},
                    };
                    world.addTag(itemSpec);
                  });
              };
              r.context.removeMod = mod => {
                const tags = world.getTags();
                for (const id in tags) {
                  const tag = tags[id];
                  if (tag.name === mod) {
                    world.removeTag(id);
                    return;
                  }
                }

                console.warn('no such mod:', JSON.stringify(mod));
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
const _jsonParse = s => {
  let error = null;
  let result;
  try {
    result = JSON.parse(s);
  } catch (err) {
    error = err;
  }
  if (!error) {
    return result;
  } else {
    return null;
  }
};
const _makeId = () => Math.random().toString(36).substring(7);
const _makeTagName = s => {
  s = s
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/--+/g, '-')
    .replace(/(?:^-|-$)/g, '');
  if (/^[0-9]/.test(s)) {
    s = 'e-' + s;
  }
  if (htmlTagNames.includes(s)) {
    s = 'e-' + s;
  }
  return s;
};
const _makeRejectApiError = reject => (statusCode = 500, message = 'API Error: ' + statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  reject(err);
};
const _getResponseString = (res, cb) => {
  const bs = [];
  res.on('data', d => {
    bs.push(d);
  });
  res.on('end', () => {
    const b = Buffer.concat(bs);
    const s = b.toString('utf8');

    cb(null, s);
  });
  res.on('error', err => {
    cb(err);
  });
};
const _getResponseJson = (res, cb) => {
  _getResponseString(res, (err, s) => {
    if (!err) {
      const j = _jsonParse(s);

      cb(null, j);
    } else {
      cb(err);
    }
  });
};
const _getModuleVersion = module => {
  if (path.isAbsolute(module)) {
    return Promise.resolve('0.0.1');
  } else {
    return _getNpmModuleVersions(module)
      .then(versions => versions[0]);
  }
};
const _getNpmModuleVersions = module => new Promise((accept, reject) => {
  const _rejectApiError = _makeRejectApiError(reject);

  https.get({
    hostname: 'registry.npmjs.org',
    path: '/' + module,
  }, proxyRes => {
    if (proxyRes.statusCode >= 200 && proxyRes.statusCode < 300) {
      _getResponseJson(proxyRes, (err, j) => {
        if (!err) {
          if (typeof j === 'object' && j !== null && typeof j.versions === 'object' && j.versions !== null) {
            const versions = Object.keys(j.versions)
              .sort((a, b) => semver.compare(a, b) * - 1); // newest to oldest
            accept(versions);
          } else {
            _rejectApiError();
          }
        } else {
          _rejectApiError(proxyRes.statusCode);
        }
      });
    } else {
      _rejectApiError(proxyRes.statusCode);
    }
  }).on('error', err => {
    _rejectApiError(500, err.stack);
  });
});

module.exports = Admin;
