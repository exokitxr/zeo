archae.requestPlugin('/core/engines/zeo')
  .then(() => {
    console.log('app started');
  })
  .catch(err => {
    console.warn(err);
  });
