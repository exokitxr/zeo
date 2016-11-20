const client = ({engines: {three}}) => ({
  mount() {
    const {scene} = three;

    // scene.add(); // XXX

    this._cleanup = () => {
      // XXX
    };
  },
  unmount() {
    this._cleanup();
  },
});

module.exports = client;
