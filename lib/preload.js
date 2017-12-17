const path = require('path');
const fs = require('fs-extra');

const mkdirp = require('mkdirp');
const fshash = require('fshash');

const preload = (a, config) => {
  const {
    dirname,
    dataDirectory,
    cryptoDirectory,
    installDirectory,
    metadata: {
      config: {
        defaultsDirectory,
      },
    }
  } = a;

  const worldDirectory = path.join(dataDirectory, 'world');
  const worldDirectorySrc = path.join(defaultsDirectory, 'world');
  const cryptoDirectorySrc = path.join(defaultsDirectory, 'crypto');

  const _requestExists = p => new Promise((accept, reject) => {
    fs.lstat(p, err => {
      if (!err) {
        accept(true);
      } else if (err.code === 'ENOENT') {
        accept(false);
      } else {
        reject(err);
      }
    });
  });
  const _requestExistsNonEmpty = p => new Promise((accept, reject) => {
    if (p) {
      fs.readdir(p, (err, files) => {
        if (!err) {
          accept(files.length > 0);
        } else if (err.code === 'ENOENT') {
          accept(false);
        } else {
          reject(err);
        }
      });
    } else {
      accept(false);
    }
  });
  const _readdir = p => new Promise((accept, reject) => {
    fs.readdir(p, (err, files) => {
      if (!err) {
        accept(files);
      } else {
        reject(err);
      }
    });
  });
  const _writeFile = (p, d) => new Promise((accept, reject) => {
    fs.writeFile(p, d, err => {
      if (!err) {
        accept();
      } else {
        reject(err);
      }
    });
  });
  const _removeFile = p => new Promise((accept, reject) => {
    fs.unlink(p, err => {
      if (!err) {
        accept();
      } else {
        reject(err);
      }
    });
  });
  const _requestCopyDirectory = (src, dst) => Promise.all([
    _requestExistsNonEmpty(src),
    _requestExistsNonEmpty(dst),
  ])
    .then(([
      srcExistsNonEmpty,
      dstExistsNonEmpty,
    ]) => new Promise((accept, reject) => {
      if (srcExistsNonEmpty && !dstExistsNonEmpty) {
        mkdirp(dst, err => {
          if (!err) {
            fs.copy(src, dst, {
              overwrite: true,
            }, err => {
              if (!err) {
                accept();
              } else {
                reject(err);
              }
            });
          } else {
            reject(err);
          }
        });
      } else {
        accept();
      }
    }));
  const _requestPreloadFsHash = () => {
    const modHashesJsonPath = path.join(dataDirectory, 'mod-hashes.json');
    const trustModHashesJsonPath = path.join(dataDirectory, 'trust-mod-hashes.json');

    return Promise.all([
      _requestExists(modHashesJsonPath),
      _requestExists(trustModHashesJsonPath),
    ])
      .then(([
        modsHashesExists,
        trustModHashesExists,
      ]) => {
        if (trustModHashesExists) {
          return Promise.all([
            _readdir(path.join(dirname, 'core', 'engines'))
              .then(ps => ps.map(p => '/core/engines/' + p)), // NOTE: this cannot be path.join() because Windows
            _readdir(path.join(dirname, 'core', 'utils'))
              .then(ps => ps.map(p => '/core/utils/' + p)),
            _readdir(path.join(dirname, 'plugins'))
              .then(ps => ps.map(p => '/plugins/' + p)),
          ])
            .then(([
              enginesFiles,
              utilsFiles,
              pluginsFiles,
            ]) => {
              const files = enginesFiles.concat(utilsFiles).concat(pluginsFiles);

              return Promise.all(files.map(file => fshash.requestHash(path.join(dirname, file))))
                .then(hashes => {
                  const result = {};

                  for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const hash = hashes[i];
                    result[file] = hash;
                  }


                  return result;
                })
                .then(data => _writeFile(modHashesJsonPath, JSON.stringify(data)))
                .then(() => _removeFile(trustModHashesJsonPath));
            });
        } else {
          return Promise.resolve();
        }
      });
  };

  return Promise.all([
    _requestCopyDirectory(worldDirectorySrc, worldDirectory),
    _requestCopyDirectory(cryptoDirectorySrc, cryptoDirectory),
    _requestPreloadFsHash(),
  ]);
};

module.exports = {
  preload,
};
