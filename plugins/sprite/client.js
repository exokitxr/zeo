class Sprite {
  mount() {
    const {three: {THREE, scene}, elements, utils: {sprite: spriteUtils}} = zeo;

    const pixelMaterial = new THREE.MeshPhongMaterial({
      vertexColors: THREE.FaceColors,
      shininess: 0,
    });

    const _requestFileImage = file =>
      file.fetch({
        type: 'blob',
      })
        .then(blob => new Promise((accept, reject) => {
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.src = url;
          img.onload = () => {
            accept(img);

            URL.revokeObjectURL(url);
          };
          img.onerror = err => {
            reject(err);

            URL.revokeObjectURL(url);
          };
        }));

    class SpriteElement extends HTMLElement {
      createdCallback() {
        this.position = null;
        this.mesh = null;

        this._cancelRequest = null;

        this._cleanup = () => {
          const {mesh, _cancelRequest: cancelRequest} = this;
          if (mesh) {
            scene.remove(mesh);
          }
          if (cancelRequest) {
            cancelRequest();
          }
        };
      }

      destructor() {
        this._cleanup();
      }

      attributeValueChangedCallback(name, oldValue, newValue) {
        switch (name) {
          case 'position': {
            this.position = newValue;

            this._updateMesh();

            break;
          }
          case 'image': {
            const file = newValue;

            let live = true;
            this._cancelRequest = () => {
              live = false;
            };

            _requestFileImage(file)
              .then(img => {
                if (live) {
                  const {mesh: oldMesh} = this;
                  if (oldMesh) {
                    scene.remove(oldMesh);
                  }

                  const newMesh = (() => {
                    const pixelSize = 0.01;
                    const size = pixelSize * 88;

                    const geometry = spriteUtils.makeImageGeometry(img, pixelSize);
                    geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, (size / 2) - (size * 0.15), 0));
                    const material = pixelMaterial;
                    
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.castShadow = true;
                    return mesh;
                  })();

                  scene.add(newMesh);
                  this.mesh = newMesh;

                  this._updateMesh();

                  this._cancelRequest = null;
                }
              })
              .catch(err => {
                console.warn(err);
              });

            break;
          }
        }
      }

      _updateMesh() {
        const {mesh, position} = this;

        if (mesh && position) {
          mesh.position.set(position[0], position[1], position[2]);
          mesh.quaternion.set(position[3], position[4], position[5], position[6]);
          mesh.scale.set(position[7], position[8], position[9]);
        }
      }
    }
    elements.registerElement(this, SpriteElement);

    this._cleanup = () => {
      elements.unregisterElement(this);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Sprite;
