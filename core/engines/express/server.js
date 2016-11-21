console.log('load express server');

class Express {
  mount() {
    const {app} = archae.getCore();

    console.log('mount express server');

    return app;
  }

  unmount() {
    console.log('unmount express server');
  }
}

module.exports = Express;
