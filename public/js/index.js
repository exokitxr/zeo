window.webgl = (typeof global !== 'undefined' && global.process && global.process.versions['electron']) ? global.require('node-webgl2') : null;

const bodyHtml = `\
<style>
body {
  --fonts: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
  --monospace-fonts: Consolas, "Liberation Mono", Menlo, Courier, monospace;
}
body {
  margin: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
.loader {
  animation-name: spin;
  animation-duration: 0.5s;
  animation-iteration-count: infinite;
  animation-timing-function: linear;
}
.loader-overlay {
  display: flex;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  justify-content: center;
  align-items: center;
  z-index: 1;
}
.loader-wrap {
  display: flex;
  width: 400px;
  padding: 10px 20px;
  font-family: var(--fonts);
  justify-content: center;
  align-items: center;
  flex-direction: column;
}
.loader-wrap h1, .loader-wrap p {
  margin: 0;
  font-weight: 400;
}
.loader-wrap h1 {
  margin-bottom: 10px;
  font-size: 40px;
  color: #000;
}
.loader-wrap h2 {
  text-align: center;
  margin-bottom: 10px;
  font-size: 30px;
}
.loader-wrap p {
  font-size: 14px;
  font-weight: 600;
}
.error:not(:empty) {
  margin-top: 10px;
  padding: 10px 20px;
  background-color: #F44336;
  color: #FFF;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  } to {
    transform: rotate(360deg);
  }
}
</style>
<div class=loader-overlay id=loader-overlay>
  <div class=loader-wrap>
    <svg class="loader" xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50"><path d="M28,3.21v2.04C37.606,6.705,45,14.994,45,25c0,11.028-8.972,20-20,20S5,36.028,5,25C5,14.994,12.394,6.705,22,5.25V3.21 C11.284,4.678,3,13.887,3,25c0,12.131,9.869,22,22,22s22-9.869,22-22C47,13.887,38.716,4.678,28,3.21z"></path></svg>
    <h1>Loading world</h1>
    <p id=loader-plugin>Initializing...</p>
    <div class=error id=loader-error></div>
  </div>
</div>`;
document.body.innerHTML = bodyHtml;

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
