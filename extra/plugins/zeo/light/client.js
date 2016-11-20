const light = archae => ({
  mount() {
    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestEngines([
      '/core/engines/zeo',
    ]).then(([
      zeo,
    ]) => {
      if (live) {
        const {THREE, scene} = zeo;

        const light = (() => {
          const result = new THREE.DirectionalLight(0xffffff, 0.5);
          result.position.set(0, 10, 0);
          result.lookAt(new THREE.Vector3(0, 0, 0));
          return result;
        })();
        scene.add(light);

        this._cleanup = () => {
          scene.remove(light);
        };
      }
    });
  },
  unount() {
    this._cleanup();
  },
});

module.exports = light;
