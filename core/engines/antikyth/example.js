const Antikyth = require('.');

const FRAME_RATE = 60;
const TICK_TIME = 1000 / FRAME_RATE;
const SET_TIME = 1000 * 2;

const antikyth = new Antikyth();

const world = (() => {
  const result = new Antikyth.World();

  const floor = new Antikyth.Plane({
    position: [0, 0, 0],
    dimensions: [0, 1, 0],
    mass: 0,
  });
  result.add(floor);
  result.floor = floor;

  const box = new Antikyth.Box({
    position: [0, 2, 0],
    rotation: [Math.PI / 8, 0, 0, 1],
    dimensions: [1, 1, 1],
    mass: 1,
  });
  box.on('update', ({position: [px, py, pz], rotation: [rx, ry, rz, rw]}) => {
    console.log('box', px, py, pz);
  });
  result.add(box);
  result.box = box;

  const sphere = new Antikyth.Sphere({
    position: [10, 2, 10],
    size: 1,
    mass: 1,
  });
  sphere.on('update', ({position: [px, py, pz], rotation: [rx, ry, rz, rw]}) => {
    console.log('sphere', px, py, pz);
  });
  result.add(sphere);
  result.sphere = sphere;

  return result;
})();
antikyth.add(world);

// main loop

setInterval(() => {
  antikyth.requestUpdate();
}, TICK_TIME);
setInterval(() => {
  const {box} = world;
  box.setPosition(0, 2, 0);
  box.setRotation(Math.PI / 8, 0, 0, 1);
}, SET_TIME);

antikyth.start();
