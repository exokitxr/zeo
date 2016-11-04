const path = require('path');

const config = {
  module: {
    loaders: [
      {
        test: /\.js$/,
        // include: path.join(__dirname, 'plugins'),
        // exclude: /(node_modules|bower_components)/,
        loader: 'babel', // 'babel-loader' is also a valid name to reference
        query: {
          presets: ['es2015']
        }
      }
    ]
  }
};

module.exports = config;
