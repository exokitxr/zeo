const symbol = Symbol();

const cameraWidth = 0.2;
const cameraHeight = 0.15;
const cameraAspectRatio = cameraWidth / cameraHeight;
const cameraDepth = 0.1;

class Camera {
  mount() {
    const {three: {THREE, scene, camera, renderer}, input, render, elements, hands} = zeo;

    const updates = [];
    const _update = () => {
      for (let i = 0; i < updates.length; i++) {
        const update = updates[i];
        update();
      }
    };

    const cameraElements = [];
    const cameraComponent = {
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0, 0, 0,
            0, 0, 0, 1,
            1, 1, 1
          ]
        },
      },
      entityAddedCallback(entityElement, attribute, value) {
        const entityApi = {};

        const renderTarget = (() => {
          const width = 1024;
          const height = width / cameraAspectRatio;
          const renderTarget = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
          });
          return renderTarget;
        })();
        // this.renderTarget = renderTarget;

        const mesh = (() => {
          const result = new THREE.Object3D();

          const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            wireframe: true,
            opacity: 0.5,
            transparent: true,
          });

          const baseMesh = (() => {
            const geometry = new THREE.BoxBufferGeometry(cameraWidth, cameraHeight, cameraDepth);

            const material = wireframeMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
          })();
          result.add(baseMesh);
          result.baseMesh = baseMesh;

          const lensMesh = (() => {
            const lensWidth = cameraWidth * 0.4;
            const lensHeight = lensWidth;
            const lensDepth = lensWidth;

            const geometry = (() => {
              const result = new THREE.BoxBufferGeometry(lensWidth, lensHeight, lensDepth);
              result.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(cameraDepth / 2) - (lensDepth / 2)));
              return result;
            })();

            const material = wireframeMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
          })();
          result.add(lensMesh);
          result.lensMesh = lensMesh;

          const screenMesh = (() => {
            const screenWidth = cameraWidth;
            const screenHeight = cameraHeight;
            const geometry = (() => {
              const result = new THREE.PlaneBufferGeometry(screenWidth, screenHeight);
              result.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, cameraDepth / 2));
              return result;
            })();
            const material = (() => {
              const result = new THREE.MeshBasicMaterial({
                map: renderTarget.texture,
              });
              result.polygonOffset = true;
              result.polygonOffsetFactor = -1;
              return result;
            })();
            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
          })();
          result.add(screenMesh);
          result.screenMesh = screenMesh;

          return result;
        })();
        scene.add(mesh);
        entityApi.mesh = mesh;

        cameraElements.push(entityApi);

        const sourceCamera = new THREE.PerspectiveCamera(45, cameraWidth / cameraHeight, camera.near, camera.far);

        const update = () => {
          const lensPosition = new THREE.Vector3();
          const lensRotation = new THREE.Quaternion();
          const lensScale = new THREE.Vector3();
          mesh.lensMesh.updateMatrixWorld();
          mesh.lensMesh.matrixWorld.decompose(lensPosition, lensRotation, lensScale);

          sourceCamera.position.copy(lensPosition);
          sourceCamera.quaternion.copy(lensRotation);

          mesh.visible = false;
          renderer.render(scene, sourceCamera, renderTarget);
          renderer.setRenderTarget(null);
          mesh.visible = true;
        };
        updates.push(update);

        entityApi.cleanup = () => {
          scene.remove(mesh);

          cameraElements.splice(cameraElements.indexOf(entityApi), 1);

          updates.splice(updates.indexOf(update), 1);
        };
        
        entityElement[symbol] = entityApi;
      },
      entityRemovedCallback(entityElement) {
        const {[symbol]: entityApi} = entityElement;
        entityApi.cleanup();

        entityApi[symbol] = null;
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
        }
      },

      /* requestImageData() {
        const {renderTarget} = this;
        const {width, height} = renderTarget;
        const buffer = new Uint8Array(width * height * 4);
        renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, buffer);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, width, height);
        const {data: imageDataData} = imageData;
        imageDataData.set(buffer);
        ctx.putImageData(imageData, 0, 0);

        const dataUrl = canvas.toDataURL('image/png');
        return fetch(dataUrl)
          .then(res => res.blob());
      } */
    };
    elements.registerComponent(this, cameraComponent);

    const _paddown = e => {
      const {side} = e;

      // XXX figure out how to implement snapshotting here

      /* const grabElement = hands.getGrabElement(side);
      const cameraElement = cameraElements.find(cameraElement => cameraElement === grabElement);

      if (cameraElement) {
        e.stopImmediatePropagation();
      } */
    };
    input.on('paddown', _paddown, {
      priority: 1,
    });
    const _padup = e => {
      const {side} = e;

      // XXX figure out how to implement snapshotting here

      /* const grabElement = hands.getGrabElement(side);
      const cameraElement = cameraElements.find(cameraElement => cameraElement === grabElement);

      if (cameraElement) {
        cameraElement.requestImageData()
          .then(blob => {
            blob.name = 'Screenshot-1.png';

            return fs.createFile(blob)
              .then(tagMesh => {
                console.log('uploaded', tagMesh);
              });
          })
          .catch(err => {
            console.warn(err);
          });

        e.stopImmediatePropagation();
      } */
    };
    input.on('padup', _padup, {
      priority: 1,
    });

    render.on('update', _update);

    this._cleanup = () => {
      elements.unregisterComponent(this, cameraComponent);

      input.removeListener('paddown', _paddown);
      input.removeListener('padup', _padup);

      render.removeListener('update', _update);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Camera;
