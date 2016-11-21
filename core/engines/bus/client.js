const events = require('events');
const {EventEmitter} = events;

class Bus {
  mount() {
    return new EventEmitter();
  }

  unmount() {
  }
}

module.exports = Bus;
