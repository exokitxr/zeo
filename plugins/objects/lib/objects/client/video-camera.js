const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
const NUM_POSITIONS = 10 * 1024;
const cameraWidth = 0.15;
const cameraHeight = 0.15;
const cameraDepth = 0.3;
const sideWidth = 0.2 * 0.9;
const sideHeight = 0.15 * 0.9;
const sideAspectRatio = sideWidth / sideHeight;
const sideDepth = 0.02;
const width = 1024;
const height = Math.round(width / sideAspectRatio);

const dataSymbol = Symbol();

const videoCamera = objectApi => {
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
        const coreGeometry = (() => {
          const geometry = new THREE.BoxBufferGeometry(cameraWidth, cameraHeight, cameraDepth)
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -cameraDepth/2));

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
        const sideGeometry = (() => {
          const geometry = new THREE.BoxBufferGeometry(sideWidth, sideHeight, sideDepth)
            .applyMatrix(new THREE.Matrix4().makeTranslation(-cameraWidth/2 - sideWidth/2, 0, -cameraDepth/2));
          const uvs = geometry.getAttribute('uv').array;
          const numUvs = uvs.length / 2;
          for (let i = 0; i < numUvs; i++) {
            const index = i * 2 + 1;
            uvs[index] = 0.5 + uvs[index] / 2;
          }
          return geometry;
        })();

        const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
          for (let i = 0; i < src.length; i++) {
            dst[startIndexIndex + i] = src[i] + startAttributeIndex;
          }
        };

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(NUM_POSITIONS);
        const normals = new Float32Array(NUM_POSITIONS);
        const uvs = new Float32Array(NUM_POSITIONS);
        const indices = new Uint16Array(NUM_POSITIONS);
        let attributeIndex = 0;
        let uvIndex = 0;
        let indexIndex = 0;
        [
          coreGeometry,
          sideGeometry,
        ].forEach(newGeometry => {
          const newPositions = newGeometry.getAttribute('position').array;
          positions.set(newPositions, attributeIndex);
          const newNormals = newGeometry.getAttribute('normal').array;
          normals.set(newNormals, attributeIndex);
          const newUvs = newGeometry.getAttribute('uv').array;
          uvs.set(newUvs, uvIndex);
          const newIndices = newGeometry.index.array;
          _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

          attributeIndex += newPositions.length;
          uvIndex += newUvs.length;
          indexIndex += newIndices.length;
        });
        geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, attributeIndex), 3));
        geometry.addAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals.buffer, normals.byteOffset, attributeIndex), 3));
        geometry.addAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs.buffer, uvs.byteOffset, uvIndex), 2));
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices.buffer, indices.byteOffset, indexIndex), 1));
        return geometry;

        return geometry;
      })();
      const videoCameraMaterial = (() => {
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

      const cameras = [];

      const cameraItemApi = {
        asset: 'ITEM.VIDEOCAMERA',
        itemAddedCallback(grabbable) {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = false;
          const imageData = ctx.createImageData(canvas.width, canvas.height);
          const mediaStream = canvas.captureStream(24);
          const mediaRecorder = new MediaRecorder(mediaStream, {
            mimeType: 'video/webm',
            bitsPerSecond: 4000 * 1024,
          });
          const blobs = [];
          mediaRecorder.ondataavailable = e => {
            blobs.push(e.data);
          };
          mediaRecorder.onstop = () => {
            if (blobs.length > 0) {
              const blob = new Blob(blobs);
              blobs.length = 0;

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
              type: 'video/webm',
              ext: 'webm',
              data: blob,
              matrix: dropMatrix,
            });

/* const url = URL.createObjectURL(b);
const a = document.createElement('a');
a.href = url;
a.download = 'video.webm';
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url); */
            }
          };

          const cameraMesh = (() => {
            const geometry = cameraGeometry;

            const material = videoCameraMaterial;
            const mesh = new THREE.Mesh(geometry, material);
            mesh.visible = false;

            const renderTarget = new THREE.WebGLRenderTarget(width, height, {
              minFilter: THREE.NearestFilter,
              magFilter: THREE.NearestFilter,
              format: THREE.RGBAFormat,
            });

            const screenMesh = (() => {
              const screenWidth = sideWidth * 0.9;
              const screenHeight = sideHeight * 0.9;
              const geometry = new THREE.PlaneBufferGeometry(screenWidth, screenHeight)
                .applyMatrix(new THREE.Matrix4().makeTranslation(-cameraWidth/2 - sideWidth/2, 0, -cameraDepth/2 + sideDepth/2));
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

                if (recording) {
                  renderer.render(scene, sourceCamera, renderTarget);
                  renderer.render(offScene, offCamera);
                  ctx.drawImage(renderer.domElement, 0, 0, canvas.width, canvas.height);
                }
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

          let recording = false;
          let recordInterval = null;
          const _triggerdown = e => {
            const {side} = e;

            if (grabbable.getGrabberSide() === side) {
              recording = true;
              mediaRecorder.start();
              recordInterval = setInterval(() => {
                mediaRecorder.requestData();
              }, 1000);

              e.stopImmediatePropagation();
            }
          };
          input.on('triggerdown', _triggerdown);
          const _triggerup = e => {
            const {side} = e;

            if (grabbable.getGrabberSide() === side) {
              recording = false;
              mediaRecorder.stop();
              clearInterval(recordInterval);
              recordInterval = null;

              e.stopImmediatePropagation();
            }
          };
          input.on('triggerup', _triggerup);

          cameras.push(grabbable);

          grabbable[dataSymbol] = {
            cleanup: () => {
              scene.remove(cameraMesh);
              cameraMesh.destroy();

              input.removeListener('triggerdown', _triggerdown);
              input.removeListener('triggerup', _triggerup);

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

module.exports = videoCamera;
