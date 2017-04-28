#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

const mkdirp = require('mkdirp');

const assetsPath = path.join(__dirname, '..', 'lib', 'assets');

mkdirp(assetsPath, err => {
  if (!err) {
    https.get({
      hostname: 'rarepepewallet.com',
      path: '/feed',
    }, res => {
      const bs = [];

      res.on('data', d => {
        bs.push(d);
      });
      res.on('end', () => {
        const b = Buffer.concat(bs);
        const s = b.toString('utf8');
        const pepes = JSON.parse(s);
        const pepeNames = Object.keys(pepes);

        console.log(`got ${pepeNames.length} pepes`);

        fs.writeFileSync(path.join(assetsPath, 'rarepepe.json'), JSON.stringify(pepes, null, 2));
        fs.writeFileSync(path.join(assetsPath, 'rarepepes.json'), JSON.stringify(pepeNames, null, 2));

        const _recurse = i => {
          if (i < pepeNames.length) {
            const pepeName = pepeNames[i];

            console.log(`${i} ${pepeName}`);

            const pepe = pepes[pepeName];
            const {img_url} = pepe;
            http.get(img_url, res => {
              const bs = [];

              res.on('data', d => {
                bs.push(d);
              });
              res.on('end', () => {
                const b = Buffer.concat(bs);

                fs.writeFileSync(path.join(assetsPath, pepeName), b);

                _recurse(i + 1);
              });
              res.on('error', err => {
                console.warn(err);
              });
            }).on('error', err => {
              console.warn(err);
            });
          } else {
            console.log('done');
          }
        };
        _recurse(0);
      });
      res.on('error', err => {
        console.warn(err);
      });
    }).on('error', err => {
      console.warn(err);
    });
  } else {
    console.warn(err);
  }
});
