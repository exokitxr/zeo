const menuShader = {
  uniforms: {
    texture: {
      type: 't',
      value: null,
    },
    backgroundColor: {
      type: '4f',
      value: null,
    },
  },
  vertexShader: [
    "varying vec2 vUv;",
    "void main() {",
    "  vUv = uv;",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
    "}"
  ].join("\n"),
  fragmentShader: [
    "uniform sampler2D texture;",
    "uniform vec4 backgroundColor;",
    "varying vec2 vUv;",
    "void main() {",
    "  vec4 sample = texture2D(texture, vUv);",
    "  if (sample.a > 0.0) {",
    "    vec3 diffuse = (sample.rgb * sample.a) + (backgroundColor.rgb * (1.0 - sample.a));",
    "    gl_FragColor = vec4(diffuse, (backgroundColor.a >= 0.5) ? 1.0 : sample.a);",
    "  } else {",
    "    if (backgroundColor.a >= 0.5) {",
    "      gl_FragColor = backgroundColor;",
    "    } else {",
    "      discard;",
    "    }",
    "  }",
    "}"
  ].join("\n"),
};

module.exports = menuShader;
