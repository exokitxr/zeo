const sword = require('./sword');
const bow = require('./bow');
const hammer = require('./hammer');
const torch = require('./torch');
const mirror = require('./mirror');

const toolsLib = options => [
  sword,
  bow,
  hammer,
  torch,
  mirror,
].map(toolLib => toolLib(options));

module.exports = toolsLib;
