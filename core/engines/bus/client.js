const events = require('events');
const {EventEmitter} = events;

const client = () => ({
  mount() {
    return new EventEmitter();
  },
  unmount() {
  },
});

module.exports = client;
