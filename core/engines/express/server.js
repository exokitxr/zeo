console.log('load express server');

const server = archae => ({
  mount() {
    const {app} = archae.getCore();

    console.log('mount express server');

    return app;
  },
  unmount() {
    console.log('unmount express server');
  },
});

module.exports = server;
