module.exports = archae => ({
  mount() {
    return archae.requestPlugins([
      '/core/engines/zeo',
    ])
      .then(([
        zeo,
      ]) => {
        const {THREE, scene} = zeo;

        const green = new THREE.Color(0x4CAF50);
        const red = new THREE.Color(0xE91E63);

        const sphere = new THREE.Mesh(
          new THREE.SphereBufferGeometry(0.1, 7, 5),
          new THREE.MeshPhongMaterial({
            color: green,
            shading: THREE.FlatShading,
            shininess: 0,
          })
        );
        const startY = 1.2;
        sphere.position.y = startY;
        scene.add(sphere);

        const world = zeo.getCurrentWorld();

        const position = new THREE.Vector3(0, 0, 0);
        const velocity = new THREE.Vector3(0, 0, 0);
        let lastTime = world.getWorldTime();
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
          sphere.position.x = newPosition.x;
          sphere.position.y = newPosition.y;
          sphere.position.z = newPosition.z;
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
          const select = touchingLines.length > 0;
          sphere.material.color = select ? red : green;
        };

        zeo.on('update', _update);

        this._cleanup = () => {
          zeo.removeListener('update', _update);

          scene.remove(sphere);
        };

        return {};
      });
  },
  unmount() {
    this._cleanup();
  },
});
