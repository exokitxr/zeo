const transparentShader = {
  uniforms: {},
  vertexShader: [
    "varying vec2 vUv;",
    "void main() {",
    "  vUv = uv;",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
    "}",
  ].join("\n"),
  fragmentShader: [
    "void main() {",
    "  discard;",
    "}",
  ].join("\n"),
};

module.exports = transparentShader;
