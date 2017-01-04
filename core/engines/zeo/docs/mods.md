# Zeo mods

This document specifies what you need to do to write your own Zeo mods.

It's simpler than you'd think: you write `mount` and `unmount` functions as your entry points, add objects to the VR scene with plain THREE.js, and publish the result to `npm`. Zeo takes care of the rest of the details to delivering mods to your face and hands.

Zeo is Javascript all the way down, but there's an escape hatch to `glsl`, `node`, `npm` and the full internet ecosystem if you need it.

## Specification


