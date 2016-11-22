const api = {};

const makeId = () => Math.random().toString(36).substring(7);
api.makeId = makeId;

module.exports = api;
