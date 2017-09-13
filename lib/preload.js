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
      },
    }
  } = a;

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

  return Promise.all([
    _requestCopyDirectory(dataDirectorySrc, dataDirectory),
    _requestCopyDirectory(cryptoDirectorySrc, cryptoDirectory),
  ]);
};

module.exports = {
  preload,
};
