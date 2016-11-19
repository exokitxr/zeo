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
  /* const corsPlugin = {
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
  }); */

  Promise.all([
    archae.requestPlugin('/core/plugins/todo'),
  ])
    .then(() => {
      console.log('added client plugins');
    })
    .catch(err => {
      console.warn(err);
    });
})
.catch(err => {
  console.warn(err);
});
