import vrid from 'vrid';

window.vrid = vrid;

vrid.getUser()
  .then(user => {
    if (user) {
      archae.requestPlugin('/core/engines/zeo')
        .then(() => {
          console.log('app started');
        })
        .catch(err => {
          console.warn(err);
        });
    } else {
      document.location.href = `https://my.zeovr.io/sign-in.html?redirectUrl=${encodeURIComponent(document.location.href)}`;
    }
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
