const sword = require('./sword');
const hammer = require('./hammer');
const torch = require('./torch');
const mirror = require('./mirror');

const toolsLib = ({archae}) => [
  sword,
  hammer,
  torch,
  mirror,
].map(toolLib => toolLib({archae}));

module.exports = toolsLib;
