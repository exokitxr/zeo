const aspectRatio = 16 / 9;
const videoWidth = 1;
const videoHeight = videoWidth / aspectRatio;

class Ar {
  mount() {
    const {three: {THREE}, elements, render, ui} = zeo;

    const transparentImg = ui.getTransparentImg();

    const arEntity = {
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
        const entityApi = entityElement.getEntityApi();
        const entityObject = entityElement.getObject();

        elementApi.position = null;

        const mesh = (() => {
          const geometry = new THREE.PlaneBufferGeometry(videoWidth, videoHeight, 1, 1);

          const material = (() => {
            const videoTexture = (() => {
              navigator.mediaDevices.getUserMedia({
                video: true,
              })
                .then(stream => {
                  if (live) {
                    const url = URL.createObjectURL(stream);

                    const video = document.createElement('video');
                    video.src = url;
                    video.autoplay = true;
                    video.oncanplaythrough = err => {
                      texture.image = video;
                      texture.needsUpdate = true;
                    };
                    video.destroy = err => {
                      _cleanup();
                    };

                    const _cleanup = () => {
                      URL.revokeObjectURL(url);

                      stream.getTracks()[0].stop();
                    };
                  }
                });

              const texture = new THREE.Texture(
                transparentImg,
                THREE.UVMapping,
                THREE.ClampToEdgeWrapping,
                THREE.ClampToEdgeWrapping,
                THREE.NearestFilter,
                THREE.NearestFilter,
                THREE.RGBFormat,
                THREE.UnsignedByteType,
                16
              );
              texture.needsUpdate = true;
              return texture;
            })();

            const material = new THREE.MeshBasicMaterial({
              map: videoTexture,
              side: THREE.DoubleSide,
            });
            return material;
          })();

          return new THREE.Mesh(geometry, material);
        })();
        entityObject.add(mesh);

        const update = () => {
          const {material: {map}} = mesh;
          if (map.image.tagName === 'VIDEO') {
            map.needsUpdate = true;
          }
        };
        updates.push(update);

        entityApi._updateMesh = () => {
          const {position} = this;

          if (position) {
            mesh.position.set(position[0], position[1], position[2]);
            mesh.quaternion.set(position[3], position[4], position[5], position[6]);
            mesh.scale.set(position[7], position[8], position[9]);
          }
        };
        entityApi._cleanup = () => {
          entityObject.remove(mesh);

          const {material: {map}} = mesh;
          if (map.image.tagName === 'VIDEO') {
            map.image.destroy();
          }

          updates.splice(updates.indexOf(update), 1);
        };
      },
      entityRemovedCallback(entityElement) {
        const entityApi = entityElement.getEntityApi();

        entityApi._cleanup();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getEntityApi();

        switch (name) {
          case 'position': {
            entityApi.position = newValue;
            entityApi._updateMesh();

            break;
          }
        }
      },
    },
    elements.registerEntity(this, arEntity);

    const updates = [];
    const _update = () => {
      for (let i = 0; i < updates.length; i++) {
        const update = updates[i];
        update();
      }
    };
    render.on('update', _update);

    this._cleanup = () => {
      elements.unregisterEntity(this, arEntity);

      render.removeListener('update', _update);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Ar;
