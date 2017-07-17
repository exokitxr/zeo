const hammer = require('./hammer');
const torch = require('./torch');
const mirror = require('./mirror');

const toolsLib = ({archae}) => [
  hammer,
  torch,
  mirror,
].map(toolLib => toolLib({archae}));

module.exports = toolsLib;
