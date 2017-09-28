const SkyShader = require('./lib/three-extra/SkyShader');

const LIGHTMAP_PLUGIN = 'plugins-lightmap';
const DAY_NIGHT_SPEED = 100;

class DayNightSkybox {
  mount() {
    const {three, elements, render, world} = zeo;
    const {THREE, scene} = three;

    const THREESky = SkyShader(THREE);

    const zeroVector = new THREE.Vector3();
    const upVector = new THREE.Vector3(0, 1, 0);
    const localVector = new THREE.Vector3();

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
        },
        speed: {
          type: 'number',
          value: DAY_NIGHT_SPEED,
          min: 1,
          max: 2000,
          step: 1,
        },
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

            return sky;
          })();
          object.add(sky.mesh);
          object.sky = sky;

          object.speed = DAY_NIGHT_SPEED;

          return object;
        })();
        scene.add(mesh);
        entityElement.mesh = mesh;

        let sunIntensity = 0;
        const sunDistance = 5000;
        const cutoffAngle = Math.PI/1.95;
        const steepness = 1.5;
        const computeSunIntensity = zenithAngleCos => {
          zenithAngleCos = Math.min(Math.max(zenithAngleCos, -1), 1);
          return Math.max(0, 1 - Math.pow(Math.E, -((cutoffAngle - Math.acos(zenithAngleCos))/steepness)));
        };
        const maxSunIntensity = computeSunIntensity(1);
        // let lastLightmapUpdateTime = 0;
        const update = () => {
          const _updateSunIntensity = () => {
            mesh.sky.azimuth = (0.05 + (((world.getWorldTime() + 200000) / 1000) * mesh.speed / 100000)) % 1;
            const theta = Math.PI * (mesh.sky.inclination - 0.5);
            const phi = 2 * Math.PI * (mesh.sky.azimuth - 0.5);

            const x = sunDistance * Math.cos(phi);
            const y = sunDistance * Math.sin(phi) * Math.sin(theta);
            const z = sunDistance * Math.sin(phi) * Math.cos(theta);

            mesh.sky.uniforms.sunPosition.value.set(x, y, z);

            sunIntensity = computeSunIntensity(
              localVector.copy(mesh.sky.uniforms.sunPosition.value)
                .normalize()
                .dot(upVector)
            ) / maxSunIntensity;
          };
          /* const _updateLightmap = () => {
            const now = Date.now();
            const timeDiff = now - lastLightmapUpdateTime;

            if (timeDiff > 100) {
              const lightmapEntity = elements.getEntitiesElement().querySelector(LIGHTMAP_PLUGIN);
              if (lightmapEntity && lightmapEntity.lightmapper) {
                const shapes = lightmapEntity.lightmapper.getShapes();
                for (let i = 0; i < shapes.length; i++) {
                  const shape = shapes[i];
                  if (shape.type === 'heightfield') {
                    shape.set({
                      v: sunIntensity,
                    });
                  }
                }
              }
              lastLightmapUpdateTime = now;
            }
          }; */

          _updateSunIntensity();
          // _updateLightmap();
        };
        updates.push(update);

        entityElement.getSunIntensity = () => sunIntensity;

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
          case 'speed': {
            const {mesh} = entityElement;

            mesh.speed = newValue;

            break;
          }
        }
      }
    };
    elements.registerEntity(this, skyboxEntity);

    const _update = () => {
      for (let i = 0; i < updates.length; i++) {
        updates[i]();
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
