const sword = require('./sword');
const bow = require('./bow');
const pickaxe = require('./pickaxe');
const hammer = require('./hammer');

const toolsLib = options => [
  sword,
  bow,
  pickaxe,
  hammer,
].map(toolLib => toolLib(options));

module.exports = toolsLib;
