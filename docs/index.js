const fs = require('fs');

module.exports = {
  getMarkdown: function() {
    return '' +
      fs.readFileSync(__dirname + '/mods.md') + '\n';
  },
};
