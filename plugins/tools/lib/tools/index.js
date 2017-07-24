const sword = require('./sword');
const bow = require('./bow');
const hammer = require('./hammer');
const torch = require('./torch');
const mirror = require('./mirror');

const toolsLib = ({archae, data}) => [
  sword,
  bow,
  hammer,
  torch,
  mirror,
].map(toolLib => toolLib({archae, data}));

module.exports = toolsLib;
