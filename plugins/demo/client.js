module.exports = archae => ({
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
        const y = 1.2;
        sphere.position.y = y;
        scene.add(sphere);

        this._cleanup = () => {
          scene.remove(sphere);
        };

        const world = zeo.getCurrentWorld();

        return {
          update() {
            const t = world.getWorldTime();
            sphere.position.y = y + Math.sin((t * 0.0025) % (Math.PI * 2)) * 0.25;
            sphere.rotation.y = y + (t * 0.002) % (Math.PI * 2);
          },
        };
      });
  },
  unmount() {
    this._cleanup();
  },
});
