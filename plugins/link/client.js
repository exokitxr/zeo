const symbol = Symbol();

class Link {
  mount() {
    const {three: {THREE, scene, camera, renderer}, elements, render} = zeo;

    const meshes = [];
    const _update = () => {
      for (let i = 0; i < meshes.length; i++) {
        const mesh = meshes[i];
        const {cubeCamera} = mesh;

        mesh.visible = false;
        cubeCamera.updateCubeMap(renderer, scene);
        mesh.visible = true;
      }
    };

    const linkComponent = {
      selector: 'link[position][destination]',
      attributes: {
        position: {
          type: 'matrix',
          value: [
            -1, 1, 0,
            0, 0, 0, 1,
            1, 1, 1,
          ],
        },
        destination: {
          type: 'matrix',
          value: [
            0, 1, -10,
            0, 0, 0, 1,
            1, 1, 1,
          ],
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = {};

        const cubeCamera = new THREE.CubeCamera(0.001, 1024, 256);
        scene.add(cubeCamera);

        const mesh = (() => {
          const geometry = new THREE.SphereBufferGeometry(0.5, 32, 32);
          const material = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            envMap: cubeCamera.renderTarget.texture,
          });

          const mesh = new THREE.Mesh(geometry, material);
          mesh.cubeCamera = cubeCamera;
          return mesh;
        })();
        scene.add(mesh);
        meshes.push(mesh);
        entityApi.mesh = mesh;

        entityApi._cleanup = () => {
          scene.remove(cubeCamera);
          scene.remove(mesh);

          meshes.splice(meshes.indexOf(mesh), 1);
        };

        entityElement[symbol] = entityApi;
      },
      entityRemovedCallback(entityElement) {
        const {[symbol]: entityApi} = entityElement;

        entityApi._cleanup();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const {[symbol]: entityApi} = entityElement;

        switch (name) {
          case 'position': {
            const {mesh} = entityApi;

            mesh.position.set(newValue[0], newValue[1], newValue[2]);
            mesh.quaternion.set(newValue[3], newValue[4], newValue[5], newValue[6]);
            mesh.scale.set(newValue[7], newValue[8], newValue[9]);

            break;
          }
          case 'destination': {
            const {mesh: {cubeCamera}} = entityApi;

            cubeCamera.position.set(newValue[0], newValue[1], newValue[2]);
            cubeCamera.quaternion.set(newValue[3], newValue[4], newValue[5], newValue[6]);
            cubeCamera.scale.set(newValue[7], newValue[8], newValue[9]);

            break;
          }
        }
      }
    }
    elements.registerComponent(this, linkComponent);

    render.on('update', _update);

    this._cleanup = () => {
      elements.unregisterComponent(this, linkComponent);

      render.removeListener('update', _update);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Link;
