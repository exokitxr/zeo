console.log('load express server');

const server = ({app}) => ({
  mount() {
    console.log('mount express server');

    return app;
  },
  unmount() {
    console.log('unmount express server');
  },
});

module.exports = server;
