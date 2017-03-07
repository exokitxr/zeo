const path = require('path');
const fs = require('fs');
const child_process = require('child_process');

const mkdirp = require('mkdirp');
const etag = require('etag');
const rnd = require('rnd');
const equidirectCubemapFaces = require('node-equirect-cubemap-faces');

const proceduralartBin = require.resolve('proceduralart');

const make = a => {
  const {dirname, dataDirectory, metadata: {hub: {url: hubUrl, enabled: hubEnabled}}} = a;

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
  const _requestReadImage = srcPath => new Promise((accept, reject) => {
    fs.readFile(srcPath, (err, d) => {
      if (!err) {
        d.etag = etag(d);

        accept(d);
      } else {
        reject(err);
      }
    });
  });
  const _requestReadCubeMapImgs = ({
    srcPathFn,
  }) => Promise.all(equidirectCubemapFaces.order.map(face => new Promise((accept, reject) => {
    const srcPath = srcPathFn(face);

    fs.readFile(srcPath, (err, d) => {
      if (!err) {
        d.etag = etag(d);

        accept(d);
      } else {
        reject(err);
      }
    });
  })))
    .then(faceImgs => {
      const result = {};
      for (let i = 0; i < faceImgs.length; i++) {
        const faceImg = faceImgs[i];
        result[equidirectCubemapFaces.order[i]] = faceImg;
      }
      return result;
    });
  const _requestMakeImage = ({
    args,
    dstPath,
  }) => new Promise((accept, reject) => {
    mkdirp(path.dirname(dstPath), err => {
      if (!err) {
        const childProcess = child_process.spawn(process.argv[0], [proceduralartBin].concat(args));
        childProcess.stderr.pipe(process.stderr);

        const ws = fs.createWriteStream(dstPath);
        childProcess.stdout.pipe(ws);

        const bs = [];
        childProcess.stdout.on('data', d => {
          bs.push(d);
        });

        childProcess.on('close', code => {
          if (code === 0) {
            const b = Buffer.concat(bs);
            b.etag = etag(b);

            accept(b);
          } else {
            const err = new Error('proceduralart exited with non-zero status code: ' + code);
            reject(err);
          }
        });
      } else {
        reject(err);
      }
    });
  });
  const _requestMakeCubeMap = ({
    skyboxImg,
    dstPathFn,
  }) => equidirectCubemapFaces.fromImage(skyboxImg)
    .then(faceCanvases => Promise.all(faceCanvases.map((faceCanvas, index) => new Promise((accept, reject) => {
      const dstPath = dstPathFn(equidirectCubemapFaces.order[index]);

      mkdirp(path.dirname(dstPath), err => {
        if (!err) {
          const rs = faceCanvas.pngStream();
          const ws = fs.createWriteStream(dstPath);

          rs.pipe(ws);

          const bs = [];
          rs.on('data', d => {
            bs.push(d);
          });

          ws.on('finish', () => {
            const b = Buffer.concat(bs);
            b.etag = etag(b);

            accept(b);
          });

          rs.on('error', err =>  {
            reject(err);
          });
          ws.on('error', err =>  {
            reject(err);
          });
        } else {
          reject(err);
        }
      });
    })))
      .then(faceImgs => {
        const result = {};
        for (let i = 0; i < faceImgs.length; i++) {
          const faceImg = faceImgs[i];
          result[equidirectCubemapFaces.order[i]] = faceImg;
        }
        return result;
      })
    );
  
  const _requestServerImages = worldname => {
    const serverImagesPath = path.join(dirname, dataDirectory, 'img', 'server');
    const serverIconImagePath = path.join(serverImagesPath, 'icon', worldname + '.png');
    const serverSkyboxImagePath = path.join(serverImagesPath, 'skybox', worldname + '.png');
    const serverCubemapImagesPath = path.join(serverImagesPath, 'cubemap');

    return Promise.all([
      _requestExists(serverIconImagePath),
      _requestExists(serverSkyboxImagePath),
    ].concat(equidirectCubemapFaces.order.map(face =>
      _requestExists(path.join(serverCubemapImagesPath, worldname + '-' + face + '.png')))
    ))
      .then(existsResults => {
        if (existsResults.every(exists => exists)) {
          return Promise.all([
            _requestReadImage(serverIconImagePath),
            _requestReadImage(serverSkyboxImagePath),
            _requestReadCubeMapImgs({
              srcPathFn: face => path.join(serverCubemapImagesPath, worldname + '-' + face + '.png'),
            }),
          ])
            .then(([
              iconImg,
              skyboxImg,
              cubeMapImgs,
            ]) => ({
              iconImg,
              skyboxImg,
              cubeMapImgs,
            }));
        } else {
          console.warn('Generating server identity -- this might take a minute...');

          return Promise.all([
            {
              args: [worldname, String(64), 'icon'],
              dstPath: serverIconImagePath,
            },
            {
              args: [worldname, String(4096), 'skybox'],
              dstPath: serverSkyboxImagePath,
            },
          ].map(_requestMakeImage))
            .then(([
              iconImg,
              skyboxImg,
            ]) => _requestMakeCubeMap({
              skyboxImg,
              dstPathFn: face => path.join(serverCubemapImagesPath, worldname + '-' + face + '.png'),
             })
              .then(cubeMapImgs => {
                console.warn('Done generating server identity.');

                return {
                  iconImg,
                  skyboxImg,
                  cubeMapImgs,
                };
              })
            );
        }
      })
  };
  const _requestHubImages = worldname => {
    const hubImagesPath = path.join(dirname, dataDirectory, 'img', 'hub');
    const hubIconImagePath = path.join(hubImagesPath, 'icon', worldname + '.png');
    const hubSkyboxImagePath = path.join(hubImagesPath, 'skybox', worldname + '.png');
    const hubCubemapImagesPath = path.join(hubImagesPath, 'cubemap');

    return Promise.all([
      _requestExists(hubIconImagePath),
      _requestExists(hubSkyboxImagePath),
    ].concat(equidirectCubemapFaces.order.map(face =>
      _requestExists(path.join(hubCubemapImagesPath, worldname + '-' + face + '.png')))
    ))
      .then(existsResults => {
        if (existsResults.every(exists => exists)) {
          return Promise.all([
            _requestReadImage(hubIconImagePath),
            _requestReadImage(hubSkyboxImagePath),
            _requestReadCubeMapImgs({
              srcPathFn: face => path.join(hubCubemapImagesPath, worldname + '-' + face + '.png'),
            }),
          ])
            .then(([
              iconImg,
              skyboxImg,
              cubeMapImgs,
            ]) => ({
              iconImg,
              skyboxImg,
              cubeMapImgs,
            }));
        } else {
          return Promise.all([
            {
              args: [worldname, String(64), 'icon'],
              dstPath: hubIconImagePath,
            },
            {
              args: [worldname, String(256), 'skybox'],
              dstPath: hubSkyboxImagePath,
            },
          ].map(_requestMakeImage))
            .then(([
              iconImg,
              skyboxImg,
            ]) => _requestMakeCubeMap({
              skyboxImg,
              dstPathFn: face => path.join(hubCubemapImagesPath, worldname + '-' + face + '.png'),
             })
              .then(cubeMapImgs => ({
                iconImg,
                skyboxImg,
                cubeMapImgs,
              }))
            );
        }
      });
  };

  return {
    requestServerImages: _requestServerImages,
    requestHubImages: _requestHubImages,
  };
};

module.exports = {
  make,
};
