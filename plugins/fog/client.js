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

        /* const update = () => { // XXX fix this walk to work with the new skybox module
          const skybox = (() => {
            for (let {parentNode: node} = this; node; node = node.parentNode) {
              if (/^z-i-skybox$/i.test(node.tagName)) {
                return node;
              }
            }
            return null;
          })();

          if (skybox) {
            const sunSphere = skybox.getSunSphere();
            const sunFactor = Math.max(sunSphere.position.y / sunSphere.distance, 0);
            scene.fog.density = sunFactor * FOG_DENSITY;
          } else {
            scene.fog.density = 0;
          }
        };
        updates.push(update); */

        entityElement[dataSymbol] = {
          cleanup() {
            // updates.splice(updates.indexOf(update), 1);

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
