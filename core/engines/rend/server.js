const path = require('path');
const fs = require('fs');

const mkdirp = require('mkdirp');
const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();
const marked = require('marked');

const DEFAULT_TAG_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

class Rend {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {site: {url: siteUrl}}} = archae;
    const {app, dirname} = archae.getCore();

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/npm',
    ])
      .then(([
        npm,
      ]) => {
        if (live) {
          const pluginsLocalPath = path.join(dirname, 'plugins');
          const _getPluginPackageJson = plugin => new Promise((accept, reject) => {
            if (path.isAbsolute(plugin)) {
              fs.readFile(path.join(dirname, plugin, 'package.json'), 'utf8', (err, s) => {
                if (!err) {
                  const j = _jsonParse(s);

                  if (j !== null) {
                    accept(j);
                  } else {
                    const err = new Error('Failed to parse package.json for ' + JSON.stringify(plugin));
                    reject(err);
                  }
                } else {
                  reject(err);
                }
              });
            } else {
              npm.requestPackageJson(plugin)
                .then(accept)
                .catch(reject);
            }
          });
          const _getPluginVersions = plugin => new Promise((accept, reject) => {
            if (path.isAbsolute(plugin)) {
              fs.readFile(path.join(dirname, plugin, 'package.json'), 'utf8', (err, s) => {
                if (!err) {
                  const j = _jsonParse(s);

                  if (j !== null) {
                    const {version = '0.0.1'} = j;
                    const versions = [version];

                    accept(versions);
                  } else {
                    const err = new Error('Failed to parse package.json for ' + JSON.stringify(plugin));
                    reject(err);
                  }
                } else {
                  reject(err);
                }
              });
            } else {
              npm.requestPackageVersions(plugin)
                .then(accept)
                .catch(reject);
            }
          });
          const _getPluginReadme = plugin => new Promise((accept, reject) => {
            if (path.isAbsolute(plugin)) {
              fs.readFile(path.join(dirname, plugin, 'README.md'), 'utf8', (err, s) => {
                if (!err) {
                  accept(s);
                } else if (err.code === 'ENOENT') {
                  accept(null);
                } else {
                  reject(err);
                }
              });
            } else {
              npm.requestReadme(plugin)
                .then(accept)
                .catch(reject);
            }
          });
          /* const _getPluginReadmeMd = plugin => new Promise((accept, reject) => {
            if (path.isAbsolute(plugin)) {
              fs.readFile(path.join(dirname, plugin, 'README.md'), 'utf8', (err, s) => {
                if (!err) {
                  accept(_renderMarkdown(s));
                } else if (err.code === 'ENOENT') {
                   accept('');
                } else {
                  reject(err);
                }
              });
            } else {
              npm.requestReadmeMd(plugin)
                .then(s => {
                  accept(_renderMarkdown(s));
                })
                .catch(reject);
            }
          }); */
          const _getLocalPlugins = () => new Promise((accept, reject) => {
            fs.readdir(pluginsLocalPath, (err, files) => {
              if (!err) {
                if (files.length > 0) {
                  const result = [];
                  let pending = files.length;
                  const pend = () => {
                    if (--pending === 0) {
                      accept(result.sort((a, b) => path.basename(a).localeCompare(path.basename(b))));
                    }
                  };

                  for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const filePath = path.join('/', 'plugins', file);

                    fs.lstat(path.join(dirname, filePath), (err, stats) => {
                      if (!err) {
                        if (stats.isDirectory()) {
                          result.push(filePath);
                        }
                      } else {
                        console.warn(err);
                      }

                      pend();
                    });
                  }
                } else {
                  accept([]);
                }
              } else {
                reject(err);
              }
            });
          });
          /* const _getModSpec = mod => Promise.all([
            _getPluginPackageJson(mod),
            _getPluginReadmeMd(mod),
          ])
            .then(([
              packageJson,
              readmeMd,
            ]) => ({
              type: 'element',
              id: mod,
              name: mod,
              displayName: packageJson.name,
              version: packageJson.version,
              description: packageJson.description || null,
              readme: readmeMd || '',
              hasClient: Boolean(packageJson.client),
              hasServer: Boolean(packageJson.server),
              hasWorker: Boolean(packageJson.worker),
              local: path.isAbsolute(mod),
              matrix: DEFAULT_TAG_MATRIX,
            })); */
          const _getModSpec = mod => Promise.all([
            _getPluginPackageJson(mod),
            _getPluginVersions(mod),
            _getPluginReadme(mod),
          ])
            .then(([
              packageJson,
              versions,
              readme,
            ]) => ({
              type: 'module',
              id: mod,
              name: mod,
              displayName: packageJson.name,
              version: packageJson.version,
              versions: versions,
              description: packageJson.description || null,
              readme: readme ? marked(readme) : null,
              hasClient: Boolean(packageJson.client),
              hasServer: Boolean(packageJson.server),
              hasWorker: Boolean(packageJson.worker),
              local: path.isAbsolute(mod),
              matrix: DEFAULT_TAG_MATRIX,
              metadata: {},
            }));
          const _getModSpecs = mods => Promise.all(mods.map(mod => _getModSpec(mod)));

          /* function serveReadme(req, res, next) {
            fs.readFile(path.join(dirname, 'README.md'), 'utf8', (err, s) => {
              if (!err) {
                const result = `<div style="padding: 0 30px;">
                  ${_renderMarkdown(s)}
                </div>`;
                res.send(result);
              } else if (err.code === 'ENOENT') {
                res.send('');
              } else {
                res.status(500);
                res.send(err.stack);
              }
            });
          }
          app.get('/archae/rend/readme', serveReadme); */
          const _requestLocalMods = q => _getLocalPlugins()
            .then(plugins => {
              const filteredPlugins = plugins.filter(plugin => {
                const name = path.basename(plugin);
                return name.indexOf(q) !== -1;
              });

              return _getModSpecs(filteredPlugins);
            });
          const _requestNpmMods = q => npm.requestSearch(q)
            .then(results => {
              const mods = results.map(({package: {name}}) => name);

              return _getModSpecs(mods);
            });
          function serveSearch(req, res, next) {
            res.set('Access-Control-Allow-Origin', '*');

            const {q = ''} = req.query;

            Promise.all([
              _requestLocalMods(q),
              _requestNpmMods(q),
            ])
              .then(([
                localModSpecs,
                npmModSpecs,
              ]) => {
                const modSpecs = localModSpecs.concat(npmModSpecs);
                res.json(modSpecs);
              })
              .catch(err => {
                res.status(500);
                res.send(err.stack);
              });
          }
          app.get('/archae/rend/search', serveSearch);
          function serveMods(req, res, next) {
            res.set('Access-Control-Allow-Origin', '*');

            const {q = ''} = req.query;

            _getModSpec(q)
              .then(modSpec => {
                res.json(modSpec);
              })
              .catch(err => {
                res.status(500);
                res.send(err.stack);
              });
          }
          app.get('/archae/rend/mods', serveMods);

          this._cleanup = () => {
            function removeMiddlewares(route, i, routes) {
              if (
                // route.handle.name === 'serveReadme' ||
                route.handle.name === 'serveSearch' ||
                route.handle.name === 'serveMods'
              ) {
                routes.splice(i, 1);
              }
              if (route.route) {
                route.route.stack.forEach(removeMiddlewares);
              }
            }
            app._router.stack.forEach(removeMiddlewares);
          };
        }
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
/* const _renderMarkdown = s => showdownConverter
  .makeHtml(s)
  .replace(/&mdash;/g, '-')
  .replace(/(<code\s*[^>]*?>)([^>]*?)(<\/code>)/g, (all, start, mid, end) => start + mid.replace(/\n/g, '<br/>') + end)
  .replace(/\n+/g, ' '); */

module.exports = Rend;
