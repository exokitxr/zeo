self.onrequest = (method, args, cb) => {
  if (method === 'ping') {
    cb(null, args[0]);
  } else {
    const err = new Error('unknown method');
    cb(err);
  }
};
