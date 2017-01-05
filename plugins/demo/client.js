module.exports = archae => ({
  mount() {
    return archae.requestEngines([
      '/core/engines/zeo',
      '/core/engines/webvr',
    ])
      .then(([
        zeo,
        webvr,
      ]) => {
        const {THREE, scene} = zeo;

        const green = new THREE.Color(0x4CAF50);
        const red = new THREE.Color(0xE91E63);

        const sphere = new THREE.Mesh(
          new THREE.SphereBufferGeometry(0.1, 5, 4),
          new THREE.MeshPhongMaterial({
            color: green,
            shading: THREE.FlatShading,
            shininess: 0,
          })
        );
        const startY = 1.2;
        sphere.position.y = startY;
        scene.add(sphere);

        const box = new THREE.Mesh(
          new THREE.BoxBufferGeometry(0.2, 0.2, 0.2),
          new THREE.MeshBasicMaterial({
            color: 0x333333,
            wireframe: true,
            opacity: 0.5,
            transparent: true,
          })
        );
        box.visible = false;
        scene.add(box);

        this._cleanup = () => {
          scene.remove(sphere);
        };

        const world = zeo.getCurrentWorld();

        return {
          update() {
            // update sphere/box
            const t = world.getWorldTime();
            const newY = startY + Math.sin((t * 0.0025) % (Math.PI * 2)) * 0.25;
            sphere.position.y = newY;
            sphere.rotation.y = (t * 0.002) % (Math.PI * 2);
            box.position.y = newY;

            // update box mesh
            const status = webvr.getStatus();
            const {gamepads: gamepadsStatus} = status;

            const select = ['left', 'right'].some(side => {
              const gamepadStatus = gamepadsStatus[side];

              if (gamepadStatus) {
                const {position: controllerPosition} = gamepadStatus;
                return controllerPosition.distanceTo(sphere.position) <= 0.1;
              } else {
                return false;
              }
            });
            sphere.material.color = select ? red : green;
            box.visible = select;
          },
        };
      });
  },
  unmount() {
    this._cleanup();
  },
});
