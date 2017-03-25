const path = require('path');

class ProceduralSkybox {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {dirname, dataDirectory, metadata: {server: {worldname: serverWorldname}}} = archae;
    const {express, app} = archae.getCore();

    let live = true;
    this._cleanup = {
      live = false;
    };

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

    return _requestServerImages(serverWorldname)
      .then(({
        iconImg,
        skyboxImg,
        cubeMapImgs,
      }) => {
        if (live) {
          function serveIcon(req, res, next) {
            res.type('image/png');
            res.set('Etag', iconImg.etag);

            res.send(iconImg);
          }
          a.app.get('/servers/img/icon.png', serveIcon);
          function serveSkybox(req, res, next) {
            res.type('image/png');
            res.set('Etag', skyboxImg.etag);

            res.send(skyboxImg);
          }
          a.app.get('/servers/img/skybox.png', serveSkybox);
          function servceCubemap(req, res, next) {
            const face = req.params[0];
            const cubeMapImg = cubeMapImgs[face];

            res.type('image/png');
            res.set('Etag', cubeMapImg.etag);

            res.send(cubeMapImg);
          }
          a.app.get(/^\/servers\/img\/cubemap-(top|bottom|left|right|front|back)\.png$/, serveCubemap);

          this._cleanup = () => {
            function removeMiddlewares(route, i, routes) {
              if (
                route.handle.name === 'serveHmdModel' ||
                route.handle.name === 'serveIcon' ||
                route.handle.name === 'serveCubemap'
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

module.exports = ProceduralSkybox;
