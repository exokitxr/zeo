class Zoo {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render} = zeo;
    const {THREE, scene} = three;

    const MOB_SHADER = {
      uniforms: {
        theta: {
          type: 'f',
          value: 0,
        },
        headRotation: {
          type: 'v4',
          value: new THREE.Vector4(),
        },
        map: {
          type: 't',
          value: null,
        },
      },
      vertexShader: `\
        #define PI 3.1415926535897932384626433832795
        uniform vec4 headRotation;
        uniform float theta;
        attribute float skinIndex;
        attribute vec3 dy;
        varying vec3 vViewPosition;
        varying vec2 vUv;
        vec3 applyQuaternion(vec3 vec, vec4 quat) {
          return vec + 2.0 * cross( cross( vec, quat.xyz ) + quat.w * vec, quat.xyz );
        }
        mat4 rotationMatrix(vec3 axis, float angle) {
            axis = normalize(axis);
            float s = sin(angle);
            float c = cos(angle);
            float oc = 1.0 - c;

            return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                        oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                        oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                        0.0,                                0.0,                                0.0,                                1.0);
        }
        vec3 rotateAxisAngle(vec3 v, vec3 axis, float angle) {
          mat4 m = rotationMatrix(axis, angle);
          return (m * vec4(v, 1.0)).xyz;
        }
        void main() {
          vec3 pos = position.xyz;
          if (skinIndex == 0.0) {
            pos = pos - dy + applyQuaternion(dy, headRotation);
          } else if (skinIndex == 1.0 || skinIndex == 4.0) {
            pos = pos - dy + rotateAxisAngle(dy, vec3(1.0, 0.0, 0.0), -theta);
          } else if (skinIndex == 2.0 || skinIndex == 3.0) {
            pos = pos - dy + rotateAxisAngle(dy, vec3(1.0, 0.0, 0.0), theta);
          }
          vec4 mvPosition = modelViewMatrix * vec4( pos, 1.0 );
          gl_Position = projectionMatrix * mvPosition;
          vViewPosition = position.xyz;
          vUv = uv;
        }
      `,
      fragmentShader: `\
        uniform sampler2D map;
        varying vec3 vViewPosition;
        varying vec2 vUv;
        void main() {
          vec4 diffuseColor = texture2D(map, vUv);
          if (diffuseColor.a < 0.5) {
            discard;
          }

          vec3 fdx = vec3( dFdx( vViewPosition.x ), dFdx( vViewPosition.y ), dFdx( vViewPosition.z ) );
          vec3 fdy = vec3( dFdy( vViewPosition.x ), dFdy( vViewPosition.y ), dFdy( vViewPosition.z ) );
          vec3 normal = normalize( cross( fdx, fdy ) );
          float dotNL = saturate( dot( normal, normalize(vViewPosition)) );

          gl_FragColor = vec4(diffuseColor.rgb * (0.5 + (dotNL * 2.0) * 0.5), 1.0);
        }
      `
    };

    const upVector = new THREE.Vector3(0, 1, 0);
    const mobMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(MOB_SHADER.uniforms),
      vertexShader: MOB_SHADER.vertexShader,
      fragmentShader: MOB_SHADER.fragmentShader,
      // transparent: true,
      extensions: {
        derivatives: true,
      },
    });
    mobMaterial.volatile = true;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _resArrayBuffer = res => {
      if (res.status >= 200 && res.status < 300) {
        return res.arrayBuffer();
      } else {
        return Promise.reject({
          status: res.status,
          stack: 'API returned invalid status code: ' + res.status,
        });
      }
    };
    const _requestImage = url => new Promise((accept, reject) => {
      const img = new Image();

      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(img);
      };

      img.crossOrigin = 'Anonymous';
      img.src = url;
    });
    const _requestData = url => fetch(url, {
      credentials: 'include',
    })
      .then(_resArrayBuffer);
    const _requestModel = url => _requestData(url)
      .then(arrayBuffer => {
        let byteOffset = 0;

        const header = new Uint32Array(arrayBuffer);
        let index = 0;
        const numPositions = header[index++];
        const numUvs = header[index++];
        const numIndices = header[index++];
        const numSkinIndices = header[index++];
        const numDys = header[index++];
        byteOffset += index * 4;

        const positions = new Float32Array(arrayBuffer, byteOffset, numPositions);
        byteOffset += numPositions * 4;

        const uvs = new Float32Array(arrayBuffer, byteOffset, numUvs);
        byteOffset += numUvs * 4;

        const indices = new Uint16Array(arrayBuffer, byteOffset, numIndices);
        byteOffset += numIndices * 2;

        const skinIndices = new Float32Array(arrayBuffer, byteOffset, numSkinIndices);
        byteOffset += numSkinIndices * 4;

        const dys = new Float32Array(arrayBuffer, byteOffset, numDys);
        byteOffset += numDys * 4;

        return {
          positions,
          uvs,
          indices,
          skinIndices,
          dys,
        };
      });

    const _requestAnimalMeshData = animal => Promise.all([
      _requestImage('/archae/mob/img/' + animal + '.png'),
      _requestModel('/archae/mob/models/' + animal + '.dat'),
    ])
      .then(([
        img,
        model,
      ]) => ({
        img,
        model,
      }));
    const _makeAnimalMesh = animalMeshData => {
      const {img, model} = animalMeshData;
      const {positions, uvs, indices, skinIndices, dys} = model;

      const geometry = new THREE.BufferGeometry();
      geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geometry.addAttribute('skinIndex', new THREE.BufferAttribute(skinIndices, 1));
      geometry.addAttribute('dy', new THREE.BufferAttribute(dys, 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));

      const texture = new THREE.Texture(
        img,
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
      const material = mobMaterial;

      const mesh = new THREE.Mesh(geometry, material);
      // mesh.frustumCulled = false;

      const angleRate = 1.5 * 1000;
      const startOffset = Math.floor(Math.random() * angleRate);
      const headRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        Math.PI/6, // (-0.5 + Math.random()) * 2 * Math.PI/4,
        // (-0.5 + Math.random()) * 2 * Math.PI/2,
        Math.PI/4,
        0,
        'YXZ'
      ));
      mesh.onBeforeRender = () => {
        material.uniforms.map.value = texture;
        material.uniforms.headRotation.value.set(headRotation.x, headRotation.y, headRotation.z, headRotation.w);
        material.uniforms.theta.value = Math.sin(((startOffset + now) % angleRate) / angleRate * Math.PI * 2) * 0.75;
      };
      mesh.destroy = () => {
        geometry.dispose();
        texture.dispose();
      };

      return mesh;
    };

    const ANIMALS = [
      'raptor',
    ];

    let now = 0;
    const _update = () => {
      now = Date.now();
    };
    render.on('update', _update);

    const cleanups = [];
    this._cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };

    cleanups.push(() => {
      mobMaterial.dispose();

      render.removeListener('update', _update);
    });

    return Promise.all(
      ANIMALS.map((animal, i) =>
        _requestAnimalMeshData(animal)
          .then(animalMeshData => {
            if (live) {
              const mesh = _makeAnimalMesh(animalMeshData);
              mesh.position.set((-ANIMALS.length/2 + i) * 1.5, 65, 0);
              mesh.updateMatrixWorld();
              scene.add(mesh);

              cleanups.push(() => {
                scene.remove(mesh);
                mesh.destroy();
              });

              return mesh;
            }
          })
      )
    )
      /* .then(meshes => {
        const _update = () => {
          const now = Date.now();

          for (let i = 0; i < meshes.length; i++) {
            const mesh = meshes[i];
            mesh.update(now);
          }
        };
        render.on('update', _update);

        cleanups.push(() => {
          render.removeListener('update', _update);
        });
      }); */
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Zoo;
