const stream = require('stream');
const Docker = require('dockerode');

const docker = new Docker();

const IMAGE_NAME = 'zeo-base';

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

const start = a => new Promise((accept, reject) => {
  const {dirname} = a;

  const _makeFakeStream = () => {
    const s = new stream.PassThrough();
    s.on('data', () => {});
    return s;
  };
  const hub = docker.run(IMAGE_NAME, ['--', '--site'], null, {
    Tty: false,
    ExposedPorts: {
      "8000/tcp": {},
    },
    HostConfig: {
      PortBindings: {
        "8000/tcp": [
          {
            "HostIp": "",
            "HostPort": "8001",
          },
        ],
      },
      Binds: [
        dirname + ":/root/zeo",
      ],
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

module.exports = {
  check,
  start,
  stop,
};
