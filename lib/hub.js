const Docker = require('dockerode');

const docker = new Docker();

const IMAGE_NAME = 'zeo-base';

const _requestImage = () => new Promise((accept, reject) => {
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

module.exports = a => _requestImage()
  .then(() => new Promise((accept, reject) => {
    const {dirname} = a;

    docker.run(IMAGE_NAME, ['--', '--site'], [process.stdout, process.stderr], {
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
        console.log(data.StatusCode);

        accept();
      } else {
        reject(err);
      }
    });
  }));
