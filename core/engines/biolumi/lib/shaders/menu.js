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
    "  vec3 diffuse = vec3(0.0, 0.0, 0.0);",
    "  float alpha = 0.0;",
    "  vec4 sample = texture2D(texture, vUv);",
    "",
    "  if (sample.a > 0.0) {",
    "    diffuse += (sample.rgb * sample.a) + (backgroundColor.rgb * (1.0 - sample.a));",
    "    alpha += sample.a;",
    "  }",
    "  gl_FragColor = vec4(diffuse, (backgroundColor.a >= 0.5) ? 1.0 : alpha);",
    "}"
  ].join("\n"),
};

module.exports = menuShader;
