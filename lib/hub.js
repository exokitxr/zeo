const path = require('path');
const fs = require('fs-extra');
const stream = require('stream');
const Docker = require('dockerode');

const docker = new Docker();

const IMAGE_NAME = 'zeo-base';
const EXTRA_MOUNTS = [
  '/usr/lib',
];

const check = a => new Promise((accept, reject) => {
  docker.getImage(IMAGE_NAME).inspect((err, info) => {
    if (!err) {
      accept();
    } else {
      if (err.statusCode === 404) {
        const newErr = new Error('could not find ' + JSON.stringify(IMAGE_NAME) + ' hub image; build it with scripts/build-hub-image.sh');
        reject(err);
      } else {
        const newErr = new Error('could not connect to docker: ' + JSON.stringify(err));
        reject(newErr);
      }
    }
  });
});

const start = (a, config) => {
  const {dirname, dataDirectory} = a;
  const {port, hub: {numContainers, startPort}} = config;

  const cryptoDirectoryPath = path.join(dirname, 'data', 'crypto');
  const installedDirectoryPath = path.join(dirname, 'installed');

  const _getContainerDirectoryPath = index => path.join(dirname, dataDirectory, 'containers', 'container-' + pad(index, 2));
  const _ensureDirectory = directoryPath => new Promise((accept, reject) => {
    fs.mkdirp(directoryPath, err => {
      if (!err) {
        accept();
      } else {
        reject(err);
      }
    });
  });
  const _fileExists = filePath => new Promise((accept, reject) => {
    fs.exists(filePath, exists => {
      accept(exists);
    });
  });
  const _ensureDirectories = () => {
    const _ensureLocalDirectories = () => _ensureDirectory(cryptoDirectoryPath);
    const _ensureContainerDirectories = () => {
      const _ensureContainerDirectory = index => {
        const containerInstalledDirectoryPath = path.join(_getContainerDirectoryPath(index), 'installed');

        return Promise.all([
          _fileExists(installedDirectoryPath),
          _fileExists(containerInstalledDirectoryPath),
        ])
          .then(([
            installedExists,
            containerInstalledExists,
          ]) => new Promise((accept, reject) => {
            if (installedExists && !containerInstalledExists) {
              fs.copy(installedDirectoryPath, containerInstalledDirectoryPath, err => {
                if (!err) {
                  accept();
                } else {
                  reject(err);
                }
              });
            } else {
              accept();
            }
          }));
      };

      const promises = [];
      for (let i = 0; i < numContainers; i++) {
        promises.push(_ensureContainerDirectory(i));
      }
      return Promise.all(promises);
    };

    return _ensureLocalDirectories()
      .then(() => _ensureContainerDirectories());
  };
  const _startContainer = index =>  new Promise((accept, reject) => {
    const containerDataDirectoryPath = path.join(_getContainerDirectoryPath(index), 'data');

    const hub = docker.run(IMAGE_NAME, ['--', '--site'], null, {
      Tty: false,
      ExposedPorts: {
        [port + "/tcp"]: {},
      },
      HostConfig: {
        PortBindings: {
          [port + "/tcp"]: [
            {
              "HostIp": "",
              "HostPort": String(startPort + index),
            },
          ],
        },
        Binds: [
          dirname + ":/root/zeo",
          containerDataDirectoryPath + ":/root/zeo/data",
          cryptoDirectoryPath + ":/root/zeo/data/crypto",
        ].concat(EXTRA_MOUNTS.map(mount => mount + ':' + mount)),
      },
    }, (err, data, container) => {
      if (!err) {
        console.log('started', container.id);

        accept();
      } else {
        reject(err);
      }
    });
    hub.on('container', c => {
      c.attach = (spec, cb) => {
        process.nextTick(() => {
          const s = new stream.PassThrough();
          s.end();
          cb(null, s);
        });
      };
      c.wait = cb => {
        process.nextTick(() => {
          const d = {};
          cb(null, d);
        });
      };
    });
  });

  return _ensureDirectories()
    .then(() => {
      const startPromises = [];
      for (let i = 0; i < numContainers; i++) {
        startPromises.push(_startContainer(i));
      }
      return Promise.all(startPromises);
    });
};

const stop = a => new Promise((accept, reject) => {
  docker.listContainers((err, containers) => {
    if (!err) {
      const hubContainers = containers.filter(({Image}) => Image === IMAGE_NAME);

      Promise.all(hubContainers.map(hubContainer => new Promise((accept, reject) => {
        console.log('stopping ', hubContainer.Id);

        docker.getContainer(hubContainer.Id).stop(err => {
          if (!err) {
            accept();
          } else {
            reject(err);
          }
        });
      })))
        .then(() => {
          accept();
        })
        .catch(err => {
          reject(err);
        });
    } else {
      reject(err);
    }
  });
});

const pad = (n, width) => {
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
};

module.exports = {
  check,
  start,
  stop,
};
