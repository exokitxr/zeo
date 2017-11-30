const DAY_NIGHT_SKYBOX_PLUGIN = 'day-night-skybox';
const FOG_DENSITY = 0.01;
const FOG_COLOR = 0xFFFFFF;

const dataSymbol = Symbol();

class Fog {
  mount() {
    const {three: {scene}, elements, render} = zeo;

    const fogElement = {
      entityAddedCallback(entityElement) {
        scene.fog.density = FOG_DENSITY;
        scene.fog.color.setHex(FOG_COLOR);

        const _update = () => {
          const dayNightSkyboxEntity = elements.getEntitiesElement().querySelector(DAY_NIGHT_SKYBOX_PLUGIN);
          if (dayNightSkyboxEntity && dayNightSkyboxEntity.getSunIntensity) {
            scene.fog.color.setHex(FOG_COLOR).multiplyScalar(dayNightSkyboxEntity.getSunIntensity());
          }
        };
        render.on('update', _update);

        entityElement[dataSymbol] = {
          cleanup() {
            render.removeListener('update', _update);

            scene.fog.density = 0;
          },
        };
      },
      entityRemovedCallback(entityElement) {
        entityApi[dataSymbol].cleanup();
        delete entityApi[dataSymbol];
      },
    }
    elements.registerEntity(this, fogElement);

    this._cleanup = () => {
      elements.unregisterEntity(this, fogElement);
    };
  }

  unmount() {
    this._cleanup();
  }
};

module.exports = Fog;
