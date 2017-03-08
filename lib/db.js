const path = require('path');

const nedb = require('nedb');

const requestUserDb = dbPath => new Promise((accept, reject) => {
  const userDb = new nedb({
    filename: dbPath,
    // filename: path.join(dirname, dataDirectory, 'db', 'users.db'),
  });
  userDb.loadDatabase(err => {
    if (!err) {
      userDb.ensureIndex({
        fieldName: 'token',
        unique: true,
      }, err => {
        if (!err) {
          accept(userDb);
        } else {
          reject(err);
        }
      });
    } else {
      reject(err);
    }
  });
});

module.exports = {
  requestUserDb,
};
