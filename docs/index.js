const fs = require('fs');

module.exports = {
  getMarkdown: function() {
    return '' +
      fs.readFileSync(__dirname + '/introduction.md') + '\n' +
      fs.readFileSync(__dirname + '/user-manual.md') + '\n' +
      fs.readFileSync(__dirname + '/module-specification.md') + '\n' +
      fs.readFileSync(__dirname + '/api-docs.md') + '\n';
  },
};
