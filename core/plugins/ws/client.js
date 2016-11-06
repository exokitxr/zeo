const client = ({engines: {ws}}) => ({
  mount() {
    ws.on('ping', data => {
      console.log('got ping', {data});
    });
    ws.emit('ping', 'pong');
  },
  unmount() {
  },
});

module.exports = client;
