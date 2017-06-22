const FOG_DENSITY = 0.05;

class Fog {
  mount() {
    const {three: {scene}, elements, render} = zeo;

    const updates = [];
    const _update = () => {
      for (let i = 0; i < updates.length; i++) {
        const update = updates[i];
        update();
      }
    };

    const fogElement = {
      entityAddedCallback(entityElement) {
        const entityApi = entityElement.getEntityApi();

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

        entityApi._cleanup = () => {
          // updates.splice(updates.indexOf(update), 1);

          scene.fog.density = 0;
        };
      },
      entityRemovedCallback(entityElement) {
        const entityApi = entityElement.getEntityApi();

        entityApi._cleanup();
      },
    }
    elements.registerEntity(this, fogEntity);

    render.on('update', _update);

    this._cleanup = () => {
      elements.unregisterEntity(this, fogEntity);

      render.removeListener('update', _update);
    };
  }

  unmount() {
    this._cleanup();
  }
};

module.exports = Fog;
