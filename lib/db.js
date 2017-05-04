const Crapdb = require('crapdb');

const requestUserDb = dbPath => new Promise((accept, reject) => {
  const userDb = new Crapdb({
    path: dbPath,
  });

  userDb.load(err => {
    if (!err) {
      if (userDb.get() === undefined) {
        userDb.set([]);
      }

      accept(userDb);
    } else {
      reject(err);
    }
  });
});

module.exports = {
  requestUserDb,
};
