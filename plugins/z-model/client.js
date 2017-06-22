class Model {
  mount() {
    const {three: {THREE}, elements} = zeo;

    const modelEntity = {
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0, 0, 0,
            0, 0, 0, 1,
            1, 1, 1,
          ],
        },
        src: {
          type: 'file',
          value: 'https://cdn.rawgit.com/modulesio/zeo-data/29412380b29e98b18c746a373bdb73aeff59e27a/models/cloud/cloud.json',
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = entityElement.getEntityApi();
        const entityObject = entityElement.getObject();

        entityApi.position = null;
        entityApi.mesh = null;

        entityApi._cancelRequest = null;

        entityApi._updateMesh = () => {
          const {mesh, position} = entityApi;

          if (mesh && position) {
            mesh.position.set(position[0], position[1], position[2]);
            mesh.quaternion.set(position[3], position[4], position[5], position[6]);
            mesh.scale.set(position[7], position[8], position[9]);
            mesh.updateMatrixWorld();
          }
        };

        entityApi._cleanup = () => {
          const {mesh, _cancelRequest: cancelRequest} = entityApi;
          if (mesh) {
            entityObject.remove(mesh);
          }
          if (cancelRequest) {
            cancelRequest();
          }
        };
      },
      entityRemovedCallback(entityElement) {
        const entityApi = entityElement.getEntityApi();

        entityApi._cleanup();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getEntityApi();
        const entityObject = entityElement.getObject();

        switch (name) {
          case 'position': {
            entityApi.position = newValue;

            entityApi._updateMesh();

            break;
          }
          case 'src': {
            const {mesh: oldMesh, _cancelRequest: cancelRequest} = entityApi;
            if (oldMesh) {
              entityObject.remove(oldMesh);
              this.mesh = null;
            }
            if (cancelRequest) {
              cancelRequest();
            }

            let live = true;
            entityApi._cancelRequest = () => {
              live = false;
            };

            const file = newValue;
            file.read({type: 'model'})
              .then(mesh => {
                if (live) {
                  entityObject.add(mesh);
                  entityApi.mesh = mesh;

                  entityApi._updateMesh();

                  entityApi._cancelRequest = null;
                }
              })
              .catch(err => {
                console.warn('failed to load model', err);
              });

            break;
          }
        }
      },
    }
    elements.registerEntity(this, modelEntity);

    this._cleanup = () => {
      elements.unregisterEntity(this, modelEntity);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Model;
