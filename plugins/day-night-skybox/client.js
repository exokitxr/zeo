const SkyShader = require('./lib/three-extra/SkyShader');

class DayNightSkybox {
  mount() {
    const {three, elements, render, world} = zeo;
    const {THREE, scene} = three;

    const THREESky = SkyShader(THREE);

    const MAP_SUN_MATERIAL = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      fog: false,
      transparent: true,
      opacity: 0.8,
    });

    const zeroVector = new THREE.Vector3();
    const upVector = new THREE.Vector3(0, 1, 0);

    const updates = [];

    const skyboxEntity = {
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0, 0, 0,
            0, 0, 0, 1,
            1, 1, 1,
          ],
        }
      },
      entityAddedCallback(entityElement) {
        const mesh = (() => {
          const object = new THREE.Object3D();

          const sky = (() => {
            const sky = new THREESky();

            const {uniforms} = sky;
            uniforms.turbidity.value = 10;
            uniforms.rayleigh.value = 2;
            uniforms.luminance.value = 1;
            uniforms.mieCoefficient.value = 0.005;
            uniforms.mieDirectionalG.value = 0.8;

            sky.inclination = 0;
            sky.azimuth = 0;

            sky.mesh.material.depthWrite = false;

            return sky;
          })();
          object.add(sky.mesh);
          object.sky = sky;

          const sunSphere = (() => {
            const geometry = new THREE.SphereBufferGeometry(200, 5, 3);
            const material = MAP_SUN_MATERIAL;
            const sunSphere = new THREE.Mesh(geometry, material);
            sunSphere.rotation.order = 'ZXY';
            sunSphere.distance = 5000;
            return sunSphere;
          })();
          object.add(sunSphere);
          object.sunSphere = sunSphere;

          const moonSphere = (() => {
            const geometry = new THREE.SphereBufferGeometry(100, 5, 3);
            const material = MAP_SUN_MATERIAL;
            const moonSphere = new THREE.Mesh(geometry, material);
            moonSphere.rotation.order = 'ZXY';
            return moonSphere;
          })();
          object.add(moonSphere);
          object.moonSphere = moonSphere;

          return object;
        })();
        scene.add(mesh);
        entityElement.mesh = mesh;

        const update = () => {
          const {sky, sunSphere/* , sunLight*/, starsMesh, moonSphere} = mesh;

          const worldTime = world.getWorldTime();

          const speed = 20;
          sky.azimuth = (0.05 + ((worldTime / 1000) * speed) / (60 * 10)) % 1;
          const theta = Math.PI * (sky.inclination - 0.5);
          const phi = 2 * Math.PI * (sky.azimuth - 0.5);

          const x = sunSphere.distance * Math.cos(phi);
          const y = sunSphere.distance * Math.sin(phi) * Math.sin(theta);
          const z = sunSphere.distance * Math.sin(phi) * Math.cos(theta);

          sky.uniforms.sunPosition.value.x = x;
          sky.uniforms.sunPosition.value.y = y;
          sky.uniforms.sunPosition.value.z = z;

          sunSphere.position.set(x, y, z);
          sunSphere.rotation.z = -phi;
          sunSphere.updateMatrixWorld();

          moonSphere.position.x = -x;
          moonSphere.position.y = -y;
          moonSphere.position.z = -z;
          moonSphere.rotation.z = -phi;
          moonSphere.updateMatrixWorld();

          sunIntensityCache = null;
        };
        updates.push(update);

        const sunIntensity = zenithAngleCos => {
          zenithAngleCos = Math.min(Math.max(zenithAngleCos, -1), 1);
          return Math.max(0, 1 - Math.pow(Math.E, -((cutoffAngle - Math.acos(zenithAngleCos))/steepness)));
        };
        const cutoffAngle = Math.PI/1.95;
        const steepness = 1.5;
        const maxSunIntensity = sunIntensity(1);

        let sunIntensityCache = null;
        entityElement.getSunIntensity = () => {
          if (sunIntensityCache === null) {
            sunIntensityCache = sunIntensity(
              mesh.sunSphere.position.clone()
                .normalize()
                .dot(upVector)
            ) / maxSunIntensity;
          }

          return sunIntensityCache;
        };

        entityElement._cleanup = () => {
          scene.remove(mesh);

          updates.splice(updates.indexOf(update), 1);
        };
      },
      entityRemovedCallback(entityElement) {
        entityElement._cleanup();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        switch (name) {
          case 'position': {
            const {mesh} = entityElement;

            mesh.position.set(newValue[0], newValue[1], newValue[2]);
            mesh.quaternion.set(newValue[3], newValue[4], newValue[5], newValue[6]);
            mesh.scale.set(newValue[7], newValue[8], newValue[9]);

            break;
          }
        }
      }
    };
    elements.registerEntity(this, skyboxEntity);

    const _update = () => {
      for (let i = 0; i < updates.length; i++) {
        const update = updates[i];
        update();
      }
    };
    render.on('update', _update);

    this._cleanup = () => {
      elements.unregisterEntity(this, skyboxEntity);

      render.removeListener('update', _update);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = DayNightSkybox;
