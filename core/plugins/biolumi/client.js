const client = ({engines: {biolumi}}) => ({
  mount() {
    biolumi.push({
      // XXX
    });
  },
  unmount() {
  },
});

module.exports = client;
