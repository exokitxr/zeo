#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

const ls = fs.readFileSync(path.join(__dirname, 'spritesheet.txt'), 'utf8')
  .replace(/\r/g, '')
  .split('\n')
  .map(l => l.match(/^(\S+) = ([0-9]+) ([0-9]+) ([0-9]+) ([0-9]+)$/))
  .filter(l => l);

const result = {};
for (let i = 0; i < ls.length; i++) {
  const l = ls[i];
  const [, name, xs, ys] = l;
  const x = parseInt(xs, 10);
  const y = parseInt(ys, 10);

  result[name] = [x, y];
}
fs.writeFileSync(path.join(__dirname, 'sprites.json'), JSON.stringify(result));
