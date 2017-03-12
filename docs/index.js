const fs = require('fs');

module.exports = {
  getMarkdown: function() {
    return '' +
      fs.readFileSync(__dirname + '/introduction.md') + '\n' +
      fs.readFileSync(__dirname + '/user-manual.md') + '\n' +
      fs.readFileSync(__dirname + '/mods.md') + '\n';
  },
};
