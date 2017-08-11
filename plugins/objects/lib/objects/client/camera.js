const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
const cameraWidth = 0.2;
const cameraHeight = 0.15;
const cameraAspectRatio = cameraWidth / cameraHeight;
const cameraDepth = 0.1;
const width = 1024;
const height = Math.round(width / cameraAspectRatio);

const dataSymbol = Symbol();

const camera = objectApi => {
  const {three, pose, input, render, items, utils: {sprite: spriteUtils}} = zeo;
  const {THREE, scene, camera, renderer} = three;

  const forwardVector = new THREE.Vector3(0, 0, -1);
  const localVector = new THREE.Vector3();
  const localVector2 = new THREE.Vector3();
  const localVector3 = new THREE.Vector3();

  const sourceCamera = new THREE.PerspectiveCamera(45, cameraWidth / cameraHeight, camera.near, camera.far);
  sourceCamera.name = camera.name;

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
    .then(img => createImageBitmap(img, 0, 0, img.width, img.height));

  return () => _requestImageBitmap('/archae/objects/img/camera.png')
    .then(cameraImg => {
      const cameraGeometry = (() => {
        const geometry = new THREE.BoxBufferGeometry(cameraWidth, cameraHeight, cameraDepth);
        const uvs = geometry.getAttribute('uv').array;
        const numUvs = uvs.length / 2;
        for (let i = 0; i < numUvs; i++) {
          const index = i * 2 + 1;
          if (i >= 20 && i < (20 + 4)) {
            uvs[index] *= 0.5;
          } else {
            uvs[index] = 0.5 + uvs[index] / 2;
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
        const material = new THREE.MeshPhongMaterial({
          map: texture,
        });
        return material;
      })();
      const cameraBuffer = new Uint8Array(width * height * 4);

      const cameras = [];

      const cameraItemApi = {
        asset: 'ITEM.CAMERA',
        itemAddedCallback(grabbable) {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = false;
          const imageData = ctx.createImageData(canvas.width, canvas.height);

          const _triggerdown = e => {
            const {side} = e;

            if (grabbable.getGrabberSide() === side) {
              canvas.toBlob(blob => {
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
                  type: 'image/png',
                  ext: 'png',
                  data: blob,
                  matrix: dropMatrix,
                });
              }, {
                mimeType: 'image/png',
              });

/* const canvas = document.createElement('canvas');
canvas.width = width;
canvas.height = height;
const ctx = canvas.getContext('2d');
const imageData = ctx.createImageData(canvas.width, canvas.height);
for (let y = 0; y < height; y++) {
  new Uint8Array(imageData.data.buffer, imageData.data.byteOffset + y * width * 4, width * 4)
    .set(new Uint8Array(cameraBuffer.buffer, cameraBuffer.byteOffset + (height - 1 - y) * width * 4, width * 4));
}
ctx.putImageData(imageData, 0, 0);
document.body.appendChild(canvas); */

              e.stopImmediatePropagation();
            }
          };
          input.on('triggerdown', _triggerdown);

          const renderTarget = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
          });
          const cameraMesh = (() => {
            const geometry = cameraGeometry;

            const material = cameraMaterial;
            const mesh = new THREE.Mesh(geometry, material);
            mesh.visible = false;

            const screenMesh = (() => {
              const screenWidth = cameraWidth * 0.9;
              const screenHeight = cameraHeight * 0.9;
              const geometry = new THREE.PlaneBufferGeometry(screenWidth, screenHeight)
                .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, cameraDepth / 2));
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

            const offScene = new THREE.Scene();
            const offCamera = new THREE.PerspectiveCamera();
            offScene.add(offCamera);
            const offPlane = (() => { // XXX needs to handle resize
              var cameraZ = offCamera.position.z;
              var planeZ = -5;
              var distance = cameraZ - planeZ;
              // var aspect = viewWidth / viewHeight;
              var aspect = offCamera.aspect;
              var vFov = offCamera.fov * Math.PI / 180;
              var planeHeightAtDistance = 2 * Math.tan(vFov / 2) * distance;
              var planeWidthAtDistance = planeHeightAtDistance * aspect;
              const mesh = new THREE.Mesh(
                new THREE.PlaneBufferGeometry(planeWidthAtDistance, planeHeightAtDistance),
                new THREE.MeshBasicMaterial({
                  map: renderTarget.texture,
                })
              );
              mesh.position.z = planeZ;
              mesh.updateMatrixWorld();
              return mesh;
            })();
            offScene.add(offPlane);
            renderer.compile(offScene, offCamera);

            mesh.update = () => {
              if (grabbable.isGrabbed()) {
                mesh.position.copy(grabbable.position);
                mesh.quaternion.copy(grabbable.rotation);
                // mesh.scale.copy(grabbable.scale);
                mesh.updateMatrixWorld();
                mesh.visible = true;

                sourceCamera.position.copy(mesh.position)
                  .add(
                    localVector.set(0, 0, -cameraDepth / 2)
                      .applyQuaternion(mesh.quaternion)
                  );
                sourceCamera.quaternion.copy(mesh.quaternion);

                renderer.render(scene, sourceCamera, renderTarget);
                renderer.render(offScene, offCamera);
                ctx.drawImage(renderer.domElement, 0, 0, canvas.width, canvas.height);
                renderer.setRenderTarget(null);
              } else {
                mesh.visible = false;
              }
            };
            mesh.destroy = () => {
              geometry.dispose();
              screenMesh.destroy();

              renderTarget.dispose();
            };

            return mesh;
          })();
          scene.add(cameraMesh);
          grabbable.cameraMesh = cameraMesh;

          cameras.push(grabbable);

          grabbable[dataSymbol] = {
            cleanup: () => {
              input.removeListener('triggerdown', _triggerdown);

              scene.remove(cameraMesh);
              cameraMesh.destroy();

              cameras.splice(cameras.indexOf(grabbable), 1);
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
        for (let i = 0; i < cameras.length; i++) {
          cameras[i].cameraMesh.update();
        }
      };
      render.on('update', _update);

      return () => {
        spriteUtils.releaseSpriteGeometry(sparkGeometrySpec);

        items.unregisterItem(this, cameraItemApi);
        render.removeListener('update', _update);
      };
    });
};

module.exports = camera;
