const ZOO_SHADER = {
  uniforms: {
    theta: {
      type: 'f',
      value: 0,
    },
    map: {
      type: 't',
      value: null,
    },
  },
  vertexShader: [
    "#define PI 3.1415926535897932384626433832795",
    "uniform float theta;",
    "attribute vec4 dy;",
    "varying vec2 vUv;",
    "varying vec4 vDy;",
`
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
`,
    "void main() {",
    "  vec3 limbPosition = dy.w > 0.0 ? (position.xyz - dy.xyz + rotateAxisAngle(dy.xyz, vec3(1.0, 0.0, 0.0), theta * (mod(dy.w, 2.0) < 1.0 ? -1.0 : 1.0) * (dy.w <= 2.0 ? -1.0 : 1.0))) : position.xyz;",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(limbPosition, 1.0);",
    // "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xyz, 1.0);",
    "  vUv = uv;",
    "  vDy = dy;",
    "}"
  ].join("\n"),
  fragmentShader: [
    "uniform sampler2D map;",
    "varying vec2 vUv;",
    "varying vec4 vDy;",
    "void main() {",
    "  vec4 diffuseColor = texture2D(map, vUv);",
    "  if (vDy.w > 0.0) {;",
    "    vec3 extraColor = vec3(0.0);",
    "    if (vDy.w <= 1.0) {",
    "      extraColor = vec3(1.5, 0.0, 0.0);",
    "    } else if (vDy.w <= 2.0) {",
    "      extraColor = vec3(0.0, 1.5, 0.0);",
    "    } else if (vDy.w <= 3.0) {",
    "      extraColor = vec3(0.0, 0.0, 1.5);",
    "    } else if (vDy.w <= 4.0) {",
    "      extraColor = vec3(1.5, 1.5, 1.5);",
    "    }",
    "    diffuseColor.rgb += extraColor;",
    // "    diffuseColor.rgb += vec3(0.5, 0.0, 0.0) * vDy.w;",
    "  };",
    "  if (diffuseColor.a < 0.5) {",
    "    discard;",
    "  }",
    "  gl_FragColor = diffuseColor;",
    "}"
  ].join("\n")
};

class Zoo {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render} = zeo;
    const {THREE, scene} = three;

    const _makeDebugBoxMesh = i => {
      const boxCenter = new THREE.Vector3(0 * (i !== undefined ? (i === 0 ? -1 : 1) : 1), 0, -1.5);
      const boxSize = new THREE.Vector3(16, 30, 25);
      return new THREE.Mesh(
        new THREE.BoxBufferGeometry(boxSize.x, boxSize.y, boxSize.z).applyMatrix(new THREE.Matrix4().makeTranslation(
          boxCenter.x, boxCenter.y, boxCenter.z
        )),
        new THREE.MeshPhongMaterial({color: 0xFF0000, transparent: true, opacity: 0.5})
      );
    };

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
    const _requestData = url => fetch(url)
      .then(_resArrayBuffer);
    const _requestModel = url => _requestData(url)
      .then(arrayBuffer => {
        let byteOffset = 0;

        const header = new Uint32Array(arrayBuffer, 0, 5);
        const numPositions = header[0];
        const numNormals = header[1];
        const numUvs = header[2];
        const numDys = header[3];
        const numIndices = header[4];
        byteOffset += 5 * 4;

        const positions = new Float32Array(arrayBuffer, byteOffset, numPositions);
        byteOffset += numPositions * 4;

        const normals = new Float32Array(arrayBuffer, byteOffset, numNormals);
        byteOffset += numNormals * 4;

        const uvs = new Float32Array(arrayBuffer, byteOffset, numUvs);
        byteOffset += numUvs * 4;

        const dys = new Float32Array(arrayBuffer, byteOffset, numDys);
        byteOffset += numDys * 4;

        const indices = new Uint16Array(arrayBuffer, byteOffset, numIndices);
        byteOffset += numIndices * 2;

        return {
          positions,
          normals,
          uvs,
          dys,
          indices,
        };
      });

    const _requestAnimalMeshData = animal => Promise.all([
      _requestImage('/archae/zoo/img/' + animal + '.png'),
      _requestModel('/archae/zoo/models/' + animal + '.dat'),
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
      const {positions, normals, uvs, dys, indices} = model;

      const geometry = new THREE.BufferGeometry();
      geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geometry.addAttribute('dy', new THREE.BufferAttribute(dys, 4));
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
      const uniforms = THREE.UniformsUtils.clone(ZOO_SHADER.uniforms);
      uniforms.map.value = texture;
      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: ZOO_SHADER.vertexShader,
        fragmentShader: ZOO_SHADER.fragmentShader,
        transparent: true,
      });

      const mesh = new THREE.Mesh(geometry, material);
      const scale = 1 / 8;
      mesh.scale.set(scale, scale, scale);
      // mesh.frustumCulled = false;

      mesh.add(_makeDebugBoxMesh());
      /* mesh.add(_makeDebugBoxMesh(0));
      mesh.add(_makeDebugBoxMesh(1)); */

      const angleRate = 1.5 * 1000;
      mesh.update = now => {
        mesh.material.uniforms.theta.value = Math.sin((now % angleRate) / angleRate * Math.PI * 2) * 0.75;
      };

      mesh.destroy = () => {
        geometry.dispose();
        material.dispose();
        texture.dispose();
      };

      return mesh;
    };

    const ANIMALS = [
      /* 'ammonite',
      'badger',
      'bear', */
      'beetle',
      // 'bigfish',
      'boar',
      'bunny',
      'chick',
      'chicken',
      'cow',
      /* 'cubelet',
      'deer',
      'dungeon_master', */
      'elephant',
      /* 'fish',
      'ghost',
      'giraffe',
      'gull', */
      'horse',
      'mammoth',
      /* 'oerrki',
      'penguin',
      'piranha',
      'pterodactyl',
      'rat', */
      'sheep',
      'skunk',
      'smallbird',
      /* 'spider',
      'swamplurker',
      'turtle',
      'trilobite', */
      'velociraptor',
      /* 'villager',
      'walker',
      'warthog',
      'wasp',
      'whale',
      'witch', */
      'wolf',
      /* 'zombie',
      'zombie_brute', */
    ];

    const cleanups = [];
    this._cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };

    return Promise.all(
      ANIMALS.map((animal, i) =>
        _requestAnimalMeshData(animal)
          .then(animalMeshData => {
            if (live) {
              const mesh = _makeAnimalMesh(animalMeshData);
              mesh.position.set((-ANIMALS.length/2 + i) * 1.5, 31, 2);
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
      .then(meshes => {
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
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Zoo;
