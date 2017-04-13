(() => {

const base = document.getElementById('base');
base.href = document.location.href + '/';

archae.requestPlugin('/core/engines/zeo')
  .then(() => {
    console.log('app started');
  })
  .catch(err => {
    console.warn(err);
  });

window.onvrdisplayactivate = e => {
  const {display} = e;
  const canvas = document.querySelector('#canvas');

  display.requestPresent([
    {
      leftBounds: [0.0, 0.0, 0.5, 1.0],
      rightBounds: [0.5, 0.0, 0.5, 1.0],
      source: canvas,
    },
  ]);
};

})();
