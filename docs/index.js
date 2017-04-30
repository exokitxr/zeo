const fs = require('fs');

module.exports = {
  getTemplate() {
    return '' +
      fs.readFileSync(__dirname + '/template.html');
  },
  getMarkdowns() {
    return [
      'tutorials',
      'manual',
      'api',
      'features',
      'contact',
    ].map(name => ({
      name: name,
      data: fs.readFileSync(__dirname + `/${name}.md`, 'utf8')
    }));
  },
};
