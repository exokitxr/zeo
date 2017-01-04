# Zeo mods

This document specifies what you need to do to write your own Zeo mods.

The high-level oveview is that you write `mount` and `unmount` functions as your entry points, add objects to the VR scene with plain `THREE.js`, and publish the result to `npm`. Everything here is free-form Javascript; Zeo is the glue that delivers the Javascript to your face.

There's an escape hatch to `glsl`, `node`, `npm` and the full internet ecosystem if you need it.

What follows is a _Getting started_ guide and a specification.

## Getting started

// XXX

## Specification

Zeo mods follow the [Archae mods specification](https://github.com/modulesio/archae). That is, you should define `"client"`, `"server"`, and/or `"worker"` files in your `"package.json"`, and have them export `mount` and `unmount` functions so the loader knows how to load them. Once you've done this, your module can be loaded into Zeo, even if it technically doesn't do anything.

Example skeleton:

#### package.json

```js
{
  "name": "test-mod",
  "client": "client.js",
  "keywords": ["zeo-mod"]
}
```

#### client.js

```js
module.exports = () => {
  mount() {
    console.log('mounted!');
  },
  unmount() {
    console.log('unmounted!');
  },
};
```

To actually add functionality to your moduel, you'll probably want to _add stuff to the Zeo scene in the `mount` function_ and _remove it in the `unmount` function_.

Technically speaking, Zeo is an Archae engine that wraps `THREE.js`: Zeo takes care of setting up the `scene` you'll be using, adds some infrastructural components such as HMD and controller tracking, and sets up the Archae loader for your modules.

But you don't have to worry about any og that; the only thing you need to do as a Zeo mod is to interact with the `THREE.js` scene that Zeo sets up for you. The API follows.

### Zeo engine API

The first thing you'll need to do to get access to the rest of Zeo's APIs is to request the Zeo engine with `archae.requestEngine()`. Per the Archae specification, you can get the `archae` loader instance by grabbing it in the top-level function that's exported from your module:

```js
module.exports = archae => { // here
  mount() {
    console.log('got archae loader!', {archae});
  },
};
```

Once you've done that, you get the Zeo engine instance with `archae.requestEngine('/core/engines/zeo')`. This returns a `Promise` that will resolve to the Zeo API root:

```js
module.exports = archae => { // here
  mount() {
    return archae.requestEngine('/core/engines/zeo')
      .then(zeo => {
        console.log('got Zeo API!', {zeo});
      });
  },
};
```

Note the `return archae.requestEngine()`: per the Archae specification, the `mount` function can return a Promise that will resolve once the mod completes its loading. Since our mod technically depends on loading the Zeo engine API, `return archae.requestEngine()` magically does the correct thing. We could load multiple things with `Promise.all`, or continue the `Promise` chain if we wanted to load more stuff here and it would "just work", but we'll stick with the simple example for now.

The rest of what your module does communicates with Zeo through the API you get out of the resolved `archae.requestEngine('/core/engines/zeo')`.

### Zeo scene API

Zeo loads `THREE.js` and sets up the `scene` rendering for you, and exposes these at the root of the Zeo API.

```js
module.exports = archae => { // here
  mount() {
    return archae.requestEngine('/core/engines/zeo')
      .then(zeo => {
        const {THREE, scene} = zeo;

        console.log("got Zeo's THREE and scene!", {THREE, scene});
      });
  },
};
```

These are the bare THREE.js APIs and you can immediately use them to add meshes and other objects to the THREE.js scene graph. There's no magic here and you have the full THREE.js API at your disposal.

Here we add a green sphere floating in the middle of the scene:

// XXX

### Zeo update callbacks API

Since Zeo is fundamentally about interactive VR, you will probably want a way to "do something on every frame", or "do something for each eye camera" -- such as advance an animation or render something stereoscopically.

The Zeo framework is the "owner" of the VR camera, the rendering pipeline, and timing, so to be able to do stuff (like updating animations), you'll need to be able to hook in your code at the right time in a frame. That's what the update callbacks are for.

// XXXX

### Zeo VR status API

// XXX

## Local mods

// XXX

## Publishing to `npm`

// XXX note `zeo-mod` tag
