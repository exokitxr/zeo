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

// main

archae.requestPlugins([
  // '/extra/plugins/biolumi/form',
  '/extra/plugins/zeo-extra/ocean',
])
  .then(result => {
    console.log('added client plugins', result);
  })
  .catch(err => {
    console.warn(err);
  });
