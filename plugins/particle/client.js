const SIDES = ['left', 'right'];

class Particle {
  mount() {
    const {three: {THREE, scene, camera}, elements, render, pose, input, world, ui, sound, utils: {geometry: geometryUtils}} = zeo;

    const patricleMaterial = new THREE.LineBasicMaterial({
      color: 0x000000,
    });

    const particleComponent = {
      selector: 'patricle[position]',
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0, 0, 0,
            0, 0, 0, 1,
            1, 1, 1,
          ],
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();
        const entityObject = entityElement.getObject();

        const mesh = (() => {
          const geometry = (() => {
            const geometry = new THREE.BufferGeometry();
            const halfSq = sq(0.1) / 2;
            const positions = Float32Array.from([
              -0.1, 1.5 + halfSq, 0,
              0.1, 1.5 + halfSq, 0,
              0, 1.5 - halfSq, 0,
              -0.1, 1.5 + halfSq, 0,
            ]);
            geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
            return geometry;
          })();
          const material = patricleMaterial;

          const mesh = new THREE.Line(geometry, material);
          mesh.update = () => {
            // XXX
          };

          return mesh;
        })();
        entityObject.add(mesh);
        entityApi.mesh = mesh;

        const _update = () => {
          mesh.update();
        };
        render.on('update', _update);

        entityApi._cleanup = () => {
          entityObject.remove(mesh);

          render.removeListener('update', _update);
        };
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getComponentApi();

        switch (name) {
          case 'position': {
            const position = newValue;

            if (position) {
              const {mesh} = entityApi;

              mesh.position.set(position[0], position[1], position[2]);
              mesh.quaternion.set(position[3], position[4], position[5], position[6]);
              mesh.scale.set(position[7], position[8], position[9]);
            }

            break;
          }
        }
      },
      entityRemovedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();

        entityApi._cleanup();
      },
    };
    elements.registerComponent(this, particleComponent);

    this._cleanup = () => {
      elements.unregisterComponent(this, particleComponent);
    };
  }

  unmount() {
    this._cleanup();
  }
}

const sq = n => Math.sqrt((n * n) + (n * n));

module.exports = Particle;
