const sword = require('./sword');
const bow = require('./bow');
const hammer = require('./hammer');
const mirror = require('./mirror');

const toolsLib = options => [
  sword,
  bow,
  hammer,
  mirror,
].map(toolLib => toolLib(options));

module.exports = toolsLib;
