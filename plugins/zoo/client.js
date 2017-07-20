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
    "uniform float theta;",
    "attribute vec3 dy;",
    "varying vec2 vUv;",
    "void main() {",
    "  float theta2 = theta * dy.z;",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, position.y - dy.y + (dy.y*cos(theta2) - dy.x*sin(theta2)), position.z - dy.x + (dy.x*cos(theta2) + dy.y*sin(theta2)), 1.0);",
    "  vUv = uv;",
    "}"
  ].join("\n"),
  fragmentShader: [
    "uniform sampler2D map;",
    "varying vec2 vUv;",
    "void main() {",
    "  vec4 diffuseColor = texture2D(map, vUv);",
    "  if (diffuseColor.a < 0.5) {",
    "    discard;",
    "  }",
    "  gl_FragColor = diffuseColor;",
    "}"
  ].join("\n")
};

console.log('zoo');

class Zoo {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render} = zeo;
    const {THREE, scene} = three;

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

        const header = new Uint32Array(arrayBuffer, 0, 4);
        const numPositions = header[0];
        const numNormals = header[1];
        const numUvs = header[2];
        const numIndices = header[3];
        byteOffset += 4 * 4;

        const positions = new Float32Array(arrayBuffer, byteOffset, numPositions);
        byteOffset += numPositions * 4;

        const normals = new Float32Array(arrayBuffer, byteOffset, numNormals);
        byteOffset += numNormals * 4;

        const uvs = new Float32Array(arrayBuffer, byteOffset, numUvs);
        byteOffset += numUvs * 4;

        const indices = new Uint16Array(arrayBuffer, byteOffset, numIndices);
        byteOffset += numIndices * 2;

        return {
          positions,
          normals,
          uvs,
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
      const {positions, normals, uvs, indices} = model;

      const geometry = new THREE.BufferGeometry();
      geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
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
      const scale = 1 / 8
      mesh.scale.set(scale, scale, scale);
      // mesh.frustumCulled = false;

      mesh.destroy = () => {
        geometry.dispose();
        material.dispose();
        texture.dispose();
      };

      return mesh;
    };

    const ANIMALS = [
      'ammonite',
      'badger',
      'beetle',
      'bigfish',
      'bunny',
      'chick',
      'chicken',
      'cow',
      'elephant',
      'fish',
      'ghost',
      'horse',
      'mammoth',
      'oerrki',
      'penguin',
      'piranha',
      'pterodactyl',
      'sheep',
      'smallbird',
      'spider',
      'swamplurker',
      'trilobite',
      'velociraptor',
      'villager',
      'warthog',
      'wasp',
      'whale',
      'witch',
      'zombie',
      'zombie_brute',
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
              mesh.position.set((-ANIMALS.length/2 + i) * 1.5, 31 /*+ (animal === 'zombie' ? 1.25 : 0)*/, 2);
              mesh.updateMatrixWorld();
              scene.add(mesh);

              cleanups.push(() => {
                scene.remove(mesh);
                mesh.destroy();
              });
            }
          })
      )
    );
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Zoo;
