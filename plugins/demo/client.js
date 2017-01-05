module.exports = archae => {
  mount() {
    return archae.requestEngine('/core/engines/zeo')
      .then(zeo => {
        const {THREE, scene} = zeo;

        const sphere = new THREE.Mesh(
          new THREE.SphereBufferGeometry(0.1, 5, 4),
          new THREE.MeshPhongMaterial({
            color: 0x4CAF50,
            shading: THREE.FlatShading,
            shininess: 0,
          })
        );
        scene.add(sphere);

        this._cleanup = () => {
          scene.remove(sphere);
        };

        let lastWorldTime = zeo.getCurrentWorldTime();

        return {
          update() {
            const currentWorldTime = zeo.getCurrentWorldTime();
            const timeDiff = currentWorldTime - lastWorldTime;
            object.position.y = Math.sin(Math.PI * timeDiff * 0.001); // a less hacky version of gravity that is synchronized to the world rather than your framerate

            lastWorldTime = zeo.getCurrentWorldTime();
          },
        };
      });
  },
  unmount() {
    this._cleanup();
  },
};
