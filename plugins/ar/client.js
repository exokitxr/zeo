const aspectRatio = 16 / 9;
const videoWidth = 1;
const videoHeight = videoWidth / aspectRatio;

class Ar {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/zeo',
      '/core/engines/biolumi',
    ]).then(([
      zeo,
      biolumi,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = zeo;

        const transparentImg = biolumi.getTransparentImg();

        class ArElement extends HTMLElement {
          createdCallback() {
            this.position = null;

            this._cancelRequest = null;

            let live = true;
            this._cleanup = () => {
              const {mesh, audio, _cancelRequest: cancelRequest} = this;

              if (mesh) {
                scene.remove(mesh);
              }
              if (audio) {
                audio.destroy();
              }
              if (cancelRequest) {
                cancelRequest();
              }

              live = false;
            };

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
                });
                return material;
              })();

              return new THREE.Mesh(geometry, material);
            })();
            scene.add(mesh);
            this.mesh = mesh;

            const update = () => {
              const {material: {map}} = mesh;
              if (map.image.tagName === 'VIDEO') {
                map.needsUpdate = true;
              }
            };
            updates.push(update);

            this._cleanup = () => {
              scene.remove(mesh);

              const {material: {map}} = mesh;
              if (map.image.tagName === 'VIDEO') {
                map.image.destroy();
              }

              updates.splice(updates.indexOf(update), 1);
            };

            this.audio = null;
            this._cancelRequest = null;
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
        zeo.registerElement(this, ArElement);

        const updates = [];
        const _update = () => {
          for (let i = 0; i < updates.length; i++) {
            const update = updates[i];
            update();
          }
        };
        zeo.on('update', _update);

        this._cleanup = () => {
          zeo.unregisterElement(this);

          zeo.removeListener('update', _update);
        };

        return {};
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Ar;
