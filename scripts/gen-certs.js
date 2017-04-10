#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

const mkdirp = require('mkdirp');
const cryptoutils = require('cryptoutils');

const hostname = 'zeovr.io';
const subjectAltNames = [
  '*.' + hostname,
  'hub.' + hostname,
  'my.' + hostname,
  '*.my.' + hostname,

  'test-hub.' + hostname,
  'test-home.' + hostname,
  '*.test-home.' + hostname,
];

const _main = () => {
  const keys = cryptoutils.generateKeys();
  const cert = cryptoutils.generateCert(keys, {
    commonName: hostname,
    subjectAltNames: subjectAltNames,
  });

  const certDirectory = path.join(__dirname, '..', 'defaults', 'crypto', 'cert');
  const _makeCertDirectory = () => new Promise((accept, reject) => {
    mkdirp(certDirectory, err => {
      if (!err) {
        accept();
      } else {
        reject(err);
      }
    });
  });
  const _setCertFile = (fileName, fileData) => new Promise((accept, reject) => {
    fs.writeFile(path.join(certDirectory, fileName), fileData, err => {
      if (!err) {
        accept();
      } else {
        reject(err);
      }
    });
  });

  _makeCertDirectory()
    .then(() => Promise.all([
      _setCertFile('public.pem', keys.publicKey),
      _setCertFile('private.pem', keys.privateKey),
      _setCertFile('cert.pem', cert),
    ]))
    .then(() => {
      
    })
    .catch(err => {
      console.warn(err);

      process.exit(1);
    });
};
_main();
