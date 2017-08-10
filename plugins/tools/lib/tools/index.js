const sword = require('./sword');
const bow = require('./bow');
const hammer = require('./hammer');

const toolsLib = options => [
  sword,
  bow,
  hammer,
].map(toolLib => toolLib(options));

module.exports = toolsLib;
