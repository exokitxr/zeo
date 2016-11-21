const api = {};

const sum = a => {
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result += a[i];
  }
  return result;
};
api.sum = sum;

module.exports = api;
