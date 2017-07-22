module.exports = THREE => {

const ANIMAL_SHADER = {
  uniforms: {
    theta: {
      type: 'f',
      value: 0,
    },
    headRotation: {
      type: 'v4',
      value: new THREE.Vector4(),
    },
    hit: {
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
    "uniform vec4 headRotation;",
    "uniform float theta;",
    "attribute vec4 dy;",
    "attribute vec4 dh;",
    "varying vec2 vUv;",
    "varying vec4 vDy;",
  `
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
  `,
    "void main() {",
    "  vec3 headPosition = dh.w > 0.0 ? (applyQuaternion(position.xyz - dh.xyz, headRotation) + dh.xyz) : position.xyz;",
    "  vec3 limbPosition;",
    "  if (dy.w > 0.0) {", // limb rotation applies
    "    vec3 axis;",
    "    if (dy.w < 5.0) {", // x rotation for regular limb
    "      axis = vec3(1.0, 0.0, 0.0);",
    "    } else {", // y rotation for tail
    "      axis = vec3(0.0, 1.0, 0.0);",
    "    }",
    "    limbPosition = (headPosition.xyz - dy.xyz + rotateAxisAngle(dy.xyz, axis, theta * (mod(dy.w, 2.0) < 1.0 ? -1.0 : 1.0) * (dy.w <= 2.0 ? -1.0 : 1.0)));",
    "  } else {", // limb rotation does not apply
    "    limbPosition = headPosition.xyz;",
    "  }",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(limbPosition, 1.0);",
    "  vUv = uv;",
    "  vDy = dy;",
    "}"
  ].join("\n"),
  fragmentShader: [
    "uniform float hit;",
    "uniform sampler2D map;",
    "varying vec2 vUv;",
    "varying vec4 vDy;",
    "void main() {",
    "  vec4 diffuseColor = texture2D(map, vUv);",
    "  if (diffuseColor.a < 0.5) {",
    "    discard;",
    "  }",
    "  if (hit > 0.5) {",
    "    diffuseColor.r += 0.3;",
    "  }",
    "  gl_FragColor = diffuseColor;",
    "}"
  ].join("\n")
};

/* const _makeDebugBoxMesh = i => {
  const boxCenter = new THREE.Vector3(0 * (i !== undefined ? (i === 0 ? -1 : 1) : 1), 0.5, -2);
  const boxSize = new THREE.Vector3(2.2, 2, 1.6);
  return new THREE.Mesh(
    new THREE.BoxBufferGeometry(boxSize.x, boxSize.y, boxSize.z).applyMatrix(new THREE.Matrix4().makeTranslation(
      boxCenter.x, boxCenter.y, boxCenter.z
    )),
    new THREE.MeshPhongMaterial({color: 0xFF0000, transparent: true, opacity: 0.5})
  );
}; */

// const upVector = new THREE.Vector3(0, 1, 0);
const zooMaterial = new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.clone(ANIMAL_SHADER.uniforms),
  vertexShader: ANIMAL_SHADER.vertexShader,
  fragmentShader: ANIMAL_SHADER.fragmentShader,
  transparent: true,
});
zooMaterial.volatile = true;

/* let live = true;
this._cleanup = () => {
  live = false;
}; */

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
const _requestImage = src => new Promise((accept, reject) => {
  if (typeof src === 'string') {
    const img = new Image();

    img.onload = () => {
      accept(img);
    };
    img.onerror = err => {
      reject(img);
    };

    img.crossOrigin = 'Anonymous';
    img.src = src;
  } else {
    accept(src);
  }
});
const _requestData = url => fetch(url)
  .then(_resArrayBuffer);
const _requestModel = src => {
  if (typeof src === 'string') {
    return _requestData(src)
      .then(arrayBuffer => {
        let byteOffset = 0;

        const header = new Uint32Array(arrayBuffer, 0, 6);
        const numPositions = header[0];
        const numNormals = header[1];
        const numUvs = header[2];
        const numDys = header[3];
        const numDhs = header[4];
        const numIndices = header[5];
        byteOffset += 6 * 4;

        const positions = new Float32Array(arrayBuffer, byteOffset, numPositions);
        byteOffset += numPositions * 4;

        const normals = new Float32Array(arrayBuffer, byteOffset, numNormals);
        byteOffset += numNormals * 4;

        const uvs = new Float32Array(arrayBuffer, byteOffset, numUvs);
        byteOffset += numUvs * 4;

        const dys = new Float32Array(arrayBuffer, byteOffset, numDys);
        byteOffset += numDys * 4;

        const dhs = new Float32Array(arrayBuffer, byteOffset, numDhs);
        byteOffset += numDhs * 4;

        const indices = new Uint16Array(arrayBuffer, byteOffset, numIndices);
        byteOffset += numIndices * 2;

        const size = new THREE.Vector3().fromArray(new Float32Array(arrayBuffer, byteOffset, 3));
        byteOffset += 3 * 4;

        return {
          positions,
          normals,
          uvs,
          dys,
          dhs,
          indices,
          size,
        };
      });
  } else {
    return Promise.resolve(src);
  }
};

/* let now = 0;
const _update = () => {
  now = Date.now();
};
render.on('update', _update); */

/* const cleanups = [];
this._cleanup = () => {
  for (let i = 0; i < cleanups.length; i++) {
    const cleanup = cleanups[i];
    cleanup();
  }
};

cleanups.push(() => {
  zooMaterial.dispose();

  // render.removeListener('update', _update);
}); */

/* return Promise.all(
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
  }); */

const animal = (img, model) => {
  const geometry = new THREE.BufferGeometry();
  geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
  geometry.addAttribute('normal', new THREE.BufferAttribute(new Float32Array(0), 3));
  geometry.addAttribute('uv', new THREE.BufferAttribute(new Float32Array(0), 2));
  geometry.addAttribute('dy', new THREE.BufferAttribute(new Float32Array(0), 4));
  geometry.addAttribute('dh', new THREE.BufferAttribute(new Float32Array(0), 4));
  geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(0), 1));
  geometry.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(0, 0, 0),
    1
  );

  const texture = new THREE.Texture(
    null,
    THREE.UVMapping,
    THREE.ClampToEdgeWrapping,
    THREE.ClampToEdgeWrapping,
    THREE.NearestFilter,
    THREE.NearestFilter,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
    1
  );
  const material = zooMaterial;

  const mesh = new THREE.Mesh(geometry, material);
  // mesh.frustumCulled = false;

  // mesh.add(_makeDebugBoxMesh());
  /* mesh.add(_makeDebugBoxMesh(0));
  mesh.add(_makeDebugBoxMesh(1)); */

  /* const angleRate = 1.5 * 1000;
  const startOffset = Math.floor(Math.random() * angleRate);
  const headRotation = new THREE.Quaternion(); */
  mesh.onBeforeRender = () => {
    material.uniforms.map.value = texture;
    /* headRotation.setFromAxisAngle(
      upVector,
      Math.sin(((startOffset + now) % angleRate) / angleRate * Math.PI * 2) * 0.75
    );
    material.uniforms.headRotation.value.set(headRotation.x, headRotation.y, headRotation.z, headRotation.w);
    material.uniforms.theta.value = Math.sin(((startOffset + now) % angleRate) / angleRate * Math.PI * 2) * 0.75; */
  };
  mesh.destroy = () => {
    geometry.dispose();
    texture.dispose();
  };

  const _load = () => {
    Promise.all([
      _requestImage(img),
      _requestModel(model),
    ])
      .then(([
        img,
        model,
      ]) => {
        const {positions, normals, uvs, dys, dhs, indices, size} = model;

        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
        geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        geometry.addAttribute('dy', new THREE.BufferAttribute(dys, 4));
        geometry.addAttribute('dh', new THREE.BufferAttribute(dhs, 4));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        geometry.boundingSphere.radius = size.length();

        texture.image = img;
        texture.needsUpdate = true;
      });
  };
  _load();

  return mesh;
};
animal.ANIMAL_SHADER = ANIMAL_SHADER;

return animal;

};
