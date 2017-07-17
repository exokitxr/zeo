const hammer = require('./hammer');
const torch = require('./torch');

const toolsLib = ({archae}) => [
  hammer,
  torch,
].map(toolLib => toolLib({archae}));

module.exports = toolsLib;
