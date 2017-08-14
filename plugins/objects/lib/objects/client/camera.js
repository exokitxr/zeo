const cameraWidth = 0.2;
const cameraHeight = 0.15;
const cameraAspectRatio = cameraWidth / cameraHeight;
const cameraDepth = 0.1;
const width = 640;
const height = 480;
// const height = Math.round(width / cameraAspectRatio);

const dataSymbol = Symbol();

const camera = objectApi => {
  const {three, pose, input, render, items} = zeo;
  const {THREE, scene, camera, renderer} = three;

  const upVector = new THREE.Vector3(0, 1, 0);
  const forwardVector = new THREE.Vector3(0, 0, -1);
  const localVector = new THREE.Vector3();
  const localVector2 = new THREE.Vector3();
  const localMatrix = new THREE.Matrix4();

  const sourceCamera = new THREE.PerspectiveCamera(45, cameraWidth / cameraHeight, camera.near, camera.far);
  sourceCamera.name = camera.name;
  scene.add(sourceCamera);

  const _requestImage = src => new Promise((accept, reject) => {
    const img = new Image();
    img.onload = () => {
      accept(img);
    };
    img.onerror = err => {
      reject(img);
    };
    img.src = src;
  });
  const _requestImageBitmap = src => _requestImage(src)
    .then(img => createImageBitmap(img, 0, 0, img.width, img.height, {
      imageOrientation: 'flipY',
    }));

  return () => _requestImageBitmap('/archae/objects/img/camera.png')
    .then(cameraImg => {
      const cameraGeometry = (() => {
        const geometry = new THREE.BoxBufferGeometry(cameraWidth, cameraHeight, cameraDepth)
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -cameraDepth/2));
        const uvs = geometry.getAttribute('uv').array;
        const numUvs = uvs.length / 2;
        for (let i = 0; i < numUvs; i++) {
          const index = i * 2 + 1;
          if (i >= 20 && i < (20 + 4)) {
            uvs[index] = 1 - (0.5 * (1 - uvs[index]));
          } else {
            uvs[index] = 1 - (0.5 + (1 - uvs[index]) / 2);
          }
        }
        return geometry;
      })();
      const cameraMaterial = (() => {
        const texture = new THREE.Texture(
          cameraImg,
          THREE.UVMapping,
          THREE.ClampToEdgeWrapping,
          THREE.ClampToEdgeWrapping,
          THREE.NearestFilter,
          THREE.NearestFilter,
          THREE.RGBAFormat,
          THREE.UnsignedByteType,
          1
        );
        texture.needsUpdate = true;
        const material = new THREE.MeshBasicMaterial({
          map: texture,
        });
        return material;
      })();
      const _makeCameraMesh = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        const imageData = ctx.getImageData(0, 0, width, height);
        const buffer = new Uint8Array(imageData.data.buffer, imageData.data.buffer.byteOffset, width * height * 4);

        const renderTarget = new THREE.WebGLRenderTarget(width, height, {
          minFilter: THREE.NearestFilter,
          magFilter: THREE.NearestFilter,
          format: THREE.RGBAFormat,
        });

        const geometry = cameraGeometry;

        const material = cameraMaterial;
        const mesh = new THREE.Mesh(geometry, material);
        mesh.visible = false;

        const screenMesh = (() => {
          const screenWidth = cameraWidth * 0.9;
          const screenHeight = cameraHeight * 0.9;
          const geometry = new THREE.PlaneBufferGeometry(screenWidth, screenHeight)
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, 0.005));
          const material = new THREE.MeshBasicMaterial({
            map: renderTarget.texture,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.destroy = () => {
            geometry.dispose();
            material.dispose();
          };
          return mesh;
        })();
        mesh.add(screenMesh);

        mesh.canvas = canvas;

        let grabbable = null;
        mesh.setGrabbable = newGrabbable => {
          grabbable = newGrabbable;
        };

        let frame = 0;
        mesh.update = () => {
          if (grabbable) {
            mesh.position.copy(grabbable.position);
            mesh.quaternion.copy(grabbable.rotation);
            // mesh.scale.copy(grabbable.scale);
            mesh.updateMatrixWorld();

            if (frame === 0) {
              sourceCamera.position.copy(mesh.position);
              sourceCamera.quaternion.setFromRotationMatrix(
                localMatrix.lookAt(
                  grabbable.position,
                  localVector.copy(grabbable.position)
                    .add(localVector2.copy(forwardVector).applyQuaternion(grabbable.rotation)),
                  localVector2.copy(upVector).applyQuaternion(grabbable.rotation)
                )
              );
              // sourceCamera.scale.copy(grabbable.scale);
              sourceCamera.updateMatrixWorld();

              const oldVrEnabled = renderer.vr.enabled;
              renderer.vr.enabled = false;

              mesh.visible = false;
              renderer.render(scene, sourceCamera, renderTarget);
              renderer.setRenderTarget(null);
              mesh.visible = true;

              renderer.vr.enabled = oldVrEnabled;
            } else if (frame === 1) {
              renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, buffer);
            } else if (frame === 2) {
              ctx.putImageData(imageData, 0, 0);
            }

            frame = (frame + 1) % 3;
          } else {
            mesh.visible = false;
          }
        };

        mesh.destroy = () => {
          renderTarget.dispose();
          screenMesh.destroy();
        };

        return mesh;
      };
      const cameraMeshes = {
        left: _makeCameraMesh(),
        right: _makeCameraMesh(),
      };
      scene.add(cameraMeshes.left);
      scene.add(cameraMeshes.right);

      const cameraItemApi = {
        asset: 'ITEM.CAMERA',
        itemAddedCallback(grabbable) {
          const _triggerdown = e => {
            const {side} = e;

            if (grabbable.getGrabberSide() === side) {
              cameraMeshes[side].canvas.toBlob(blob => {
                const dropMatrix = (() => {
                  const {hmd} = pose.getStatus();
                  const {worldPosition: hmdPosition, worldRotation: hmdRotation, worldScale: hmdScale} = hmd;
                  localVector.copy(hmdPosition)
                    .add(
                      localVector2.copy(forwardVector).multiplyScalar(0.5)
                        .applyQuaternion(hmdRotation)
                    );
                  return localVector.toArray().concat(hmdRotation.toArray()).concat(hmdScale.toArray());
                })();
                items.makeFile({
                  data: blob,
                  matrix: dropMatrix,
                });
              }, {
                mimeType: 'image/png',
              });

              e.stopImmediatePropagation();
            }
          };
          input.on('triggerdown', _triggerdown);

          grabbable.on('grab', e => {
            cameraMeshes[e.side].setGrabbable(grabbable);

            grabbable.hide();
          });
          grabbable.on('release', e => {
            cameraMeshes[e.side].setGrabbable(null);

            grabbable.show();
          });

          grabbable[dataSymbol] = {
            cleanup: () => {
              input.removeListener('triggerdown', _triggerdown);
            },
          };
        },
        itemRemovedCallback(grabbable) {
          const {[dataSymbol]: {cleanup}} = grabbable;
          cleanup();

          delete grabbable[dataSymbol];
        },
      };
      items.registerItem(this, cameraItemApi);

      const _update = () => {
        cameraMeshes.left.update();
        cameraMeshes.right.update();
      };
      render.on('update', _update);

      return () => {
        scene.remove(cameraMeshes.left);
        cameraMeshes.left.destroy();
        scene.remove(cameraMeshes.right);
        cameraMeshes.right.destroy();

        items.unregisterItem(this, cameraItemApi);
        render.removeListener('update', _update);
      };
    });
};

module.exports = camera;
