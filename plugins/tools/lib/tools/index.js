const sword = require('./sword');
const bow = require('./bow');
const gun = require('./gun');
const pickaxe = require('./pickaxe');
const hammer = require('./hammer');

const toolsLib = options => [
  sword,
  bow,
  gun,
  pickaxe,
  hammer,
].map(toolLib => toolLib(options));

module.exports = toolsLib;
