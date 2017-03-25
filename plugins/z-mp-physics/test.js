
let physics = require('./build/Debug/physics');

let world = new physics.World();

let box = physics.RigidBody.make({
  type: physics.RigidBody.BOX,
  dimensions: [2, 2, 2],
  position: [0, 300, 0],
  mass : 5
});

let ground = physics.RigidBody.make({
  type: physics.RigidBody.BOX,
  dimensions: [100, 2, 100],
  position: [0, 0, 0],
  mass : 0
});

world.addRigidBody(ground);
world.addRigidBody(box);

for (let i = 0; i < 120; i++) {
  world.stepSimulation(1/60.0);
  console.log(i, box.getPosition());
}
