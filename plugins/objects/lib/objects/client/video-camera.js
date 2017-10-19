const NUM_POSITIONS = 10 * 1024;
const cameraWidth = 0.15;
const cameraHeight = 0.15;
const cameraDepth = 0.3;
const sideWidth = 0.2 * 0.9;
const sideHeight = 0.15 * 0.9;
const sideAspectRatio = sideWidth / sideHeight;
const sideDepth = 0.02;
const width = 640;
const height = 480;
// const height = Math.round(width / sideAspectRatio);

const dataSymbol = Symbol();

const videoCamera = objectApi => {
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
        const coreGeometry = (() => {
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
        const sideGeometry = (() => {
          const geometry = new THREE.BoxBufferGeometry(sideWidth, sideHeight, sideDepth)
            .applyMatrix(new THREE.Matrix4().makeTranslation(-cameraWidth/2 - sideWidth/2, 0, -cameraDepth/2));
          const uvs = geometry.getAttribute('uv').array;
          const numUvs = uvs.length / 2;
          for (let i = 0; i < numUvs; i++) {
            const index = i * 2 + 1;
            uvs[index] = 1 - (0.5 + (1 - uvs[index]) / 2);
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

        const mediaStream = canvas.captureStream(24);
        const mediaRecorder = new MediaRecorder(mediaStream, {
          mimeType: 'video/webm',
          bitsPerSecond: 8000 * 1024,
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
              data: blob,
              matrix: dropMatrix,
            });
          }
        };

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
            .applyMatrix(new THREE.Matrix4().makeTranslation(-cameraWidth/2 - sideWidth/2, 0, -cameraDepth/2 + sideDepth/2 + 0.005));
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

        let recording = false;
        let recordInterval = null;
        mesh.startRecording = () => {
          recording = true;
          mediaRecorder.start();
          recordInterval = setInterval(() => {
            mediaRecorder.requestData();
          }, 1000);
        };
        mesh.stopRecording = () => {
          recording = false;
          mediaRecorder.stop();
          clearInterval(recordInterval);
          recordInterval = null;
        };

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
        asset: 'ITEM.VIDEOCAMERA',
        itemAddedCallback(grabbable) {
          const _triggerdown = e => {
            if (grabbable.getGrabberSide() === e.side) {
              cameraMeshes[e.side].startRecording();

              e.stopImmediatePropagation();
            }
          };
          input.on('triggerdown', _triggerdown);
          const _triggerup = e => {
            if (grabbable.getGrabberSide() === e.side) {
              cameraMeshes[e.side].stopRecording();

              e.stopImmediatePropagation();
            }
          };
          input.on('triggerup', _triggerup);

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
              input.removeListener('triggerup', _triggerup);
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

module.exports = videoCamera;
