#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

const result = {};
fs.readdirSync(path.join(__dirname, '..', '..', '..', 'plugins')).sort().forEach(filename => {
  result[filename] = ['0.0.1'];
});

console.log(JSON.stringify(result, null, 2));
