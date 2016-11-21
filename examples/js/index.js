/* const _loadCorsPlugin = new Promise((accept, reject) => {
  let clientJs = null;
  let serverJs = null;

  Promise.all([
    fetch('/js/plugins/cors/client.js')
      .then(res => new Promise((accept, reject) => {
        res.text()
          .then(s => {
            clientJs = s;

            accept();
          })
          .catch(reject);
      })),
    fetch('/js/plugins/cors/server.js')
      .then(res => new Promise((accept, reject) => {
        res.text()
          .then(s => {
            serverJs = s;

            accept();
          })
          .catch(reject);
      })),
  ])
  .then(() => {
    const corsPlugin = {
      name: 'corsPlugin',
      version: '0.0.1',
      dependencies: {
        'react': '',
        'react-dom': '',
        'react-tools': '',
      },
      client: 'client.js',
      server: 'server.js',
      files: {
        'client.js': clientJs,
        'server.js': serverJs,
      }
    };
    archae.requestPlugin(corsPlugin, err => {
      console.log('added cors plugin', err);
    });

    resolve();
  })
  .catch(reject);
}); */

/* archae.requestPlugins([
  '/extra/plugins/biolumi/form',
]).then(([
    form,
  ]) => {
    console.log('ok');
  })
  .catch(err => {
    console.warn(err);
  }); */

// main

archae.requestEngines([
  '/core/engines/zeo',
])
  .then(([
    zeo,
  ]) => {
    zeo.requestChangeWorld('proteus')
      .then(world => {
        console.log('added zeo world');

        world.requestMods([
          '/extra/plugins/zeo/controls',
          '/extra/plugins/zeo/teleport',
          '/extra/plugins/zeo/light',
          '/extra/plugins/zeo/controllers',
          // '/extra/plugins/zeo/hmd',
          '/extra/plugins/zeo/ocean',
          '/extra/plugins/zeo/models',
          '/extra/plugins/zeo/weapons',
          '/extra/plugins/zeo/youtube',
          '/extra/plugins/zeo/lens',
        ])
          .then(() => {
            console.log('added zeo mods');
          })
          .catch(err => {
            console.warn(err);
          });
      })
      .catch(err => {
        console.warn(err);
      });
  })
  .catch(err => {
    console.warn(err);
  });
