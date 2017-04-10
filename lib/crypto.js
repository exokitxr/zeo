const path = require('path');
const fs = require('fs-extra');

const mkdirp = require('mkdirp');

const preload = (a, config) => {
  const {
    dirname,
    dataDirectory,
    cryptoDirectory,
    installDirectory,
    metadata: {
      config: {
        dataDirectorySrc,
        cryptoDirectorySrc,
        installDirectorySrc,
      },
    }
  } = a;

  const _requestExists = p => new Promise((accept, reject) => {
    if (p) {
      fs.lstat(p, err => {
        if (!err) {
          accept(true);
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
  const _requestCopyDirectory = (src, dst) => Promise.all([
    _requestExists(src),
    _requestExists(dst),
  ])
    .then(([
      srcExists,
      dstExists,
    ]) => new Promise((accept, reject) => {
      if (srcExists && !dstExists) {
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

  return Promise.all([
    _requestCopyDirectory(dataDirectorySrc, dataDirectory),
    _requestCopyDirectory(cryptoDirectorySrc, cryptoDirectory),
    _requestCopyDirectory(installDirectorySrc, installDirectory),
  ]);
};

module.exports = {
  preload,
};
