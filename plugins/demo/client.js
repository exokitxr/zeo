module.exports = archae => ({ // `archae` is the Zeo plugin loader
  mount() { // `mount` gets called when our plugin loads
    // request the `zeo` plugin API from `archae`
    return archae.requestPlugin('/core/engines/zeo')
      .then(zeo => {
        // grab the API veriables we need
        const {THREE, scene} = zeo;
        const world = zeo.getCurrentWorld();

        // declare some contants
        const COLORS = {
          GREEN: new THREE.Color(0x4CAF50),
          RED: new THREE.Color(0xE91E63),
        };

        // create the sphere and add it to the scene
        const sphere = new THREE.Mesh(
          new THREE.SphereBufferGeometry(0.1, 7, 5),
          new THREE.MeshPhongMaterial({
            color: COLORS.GREEN,
            shading: THREE.FlatShading,
            shininess: 0,
          })
        );
        const startY = 1.2;
        sphere.position.y = startY;
        sphere.castShadow = true;
        scene.add(sphere);

        // declare some state
        const position = new THREE.Vector3(0, 0, 0);
        const velocity = new THREE.Vector3(0, 0, 0);
        let lastTime = world.getWorldTime();

        // `_update` will be called on every frame
        const _update = () => {
          // update time
          const currentTime = world.getWorldTime();
          const timePassed = Math.max(currentTime - lastTime, 1);
          lastTime = currentTime;

          // calculate new position
          const newPosition = position.clone().add(velocity.clone().divideScalar(timePassed));
          const rayBack = newPosition.clone().multiplyScalar((-1 / timePassed) * 0.25);
          velocity.add(rayBack).multiplyScalar(0.98);
          position.copy(newPosition);

          // update sphere
          sphere.position.copy(newPosition);
          sphere.position.y += startY + Math.sin((currentTime * 0.00125) % (Math.PI * 2)) * 0.3;
          sphere.rotation.y = (currentTime * 0.002) % (Math.PI * 2);

          // detect hits
          const status = zeo.getStatus();
          const {gamepads: gamepadsStatus} = status;
          const lines = ['left', 'right'].map(side => {
            const gamepadStatus = gamepadsStatus[side];
            if (gamepadStatus) {
              const {position: controllerPosition} = gamepadStatus;
              return new THREE.Line3(controllerPosition.clone(), sphere.position.clone());
            } else {
              return null;
            }
          });
          const touchingLines = lines
            .map(line => {
              const distance = line ? line.distance() : Infinity;
              return {
                line,
                distance,
              };
            })
            .sort((a, b) => a.distance - b.distance)
            .filter(({distance}) => distance <= 0.1)
            .map(({line}) => line);
          if (touchingLines.length > 0) {
            const touchingLine = touchingLines[0];
            const delta = touchingLine.delta().normalize().multiplyScalar(2.5);
            velocity.copy(delta);
          }

          // style the sphere
          sphere.material.color = touchingLines.length > 0 ? COLORS.RED : COLORS.GREEN;
        };

        // listen for Zeo telling us it's time to update for the next frame
        zeo.on('update', _update);

        // set up a callback to call when we want to clean up after the plugin
        this._cleanup = () => {
          scene.remove(sphere);

          zeo.removeListener('update', _update);
        };
      });
  },
  unmount() { // `unmount` gets called when our plugin unloads
    this._cleanup();
  },
});
