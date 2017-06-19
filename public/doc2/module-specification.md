# Module specification

This document specifies what you need to do to write your own VR `npm` modules.

These are self-contained units of Javascript code you can add to your worlds, and they can be anything from [an edible cake](https://github.com/modulesio/z-cake) to a [physics toolbox](https://github.com/modulesio/z-primitives).

It is assumed that you already have a Zeo VR server. If not, see [Getting started](https://github.com/modulesio/zeo/tree/master/docs/getting-started.md).

## Modules overview

A Zeo module is just an [`npm`](https://www.npmjs.com/) module that follows this standard.

Basically, to make your module VR-compatible, you add some extra keys in the [`package.json`](https://docs.npmjs.com/files/package.json). These keys reference your Javascript VR code so we know how to load your module. Then you add the `zeo-module` `keyword` to make your module discoverable on `npm`.

When you publish such a module to the `npm` registry, it will automagically become available on any Zeo VR server.

If you're a hands-on learner and you already know Javascript, you might want to simply dive into the [`Bouncy ball` demo plugin on Github](https://github.com/modulesio/zeo/tree/master/plugins/demo).

Otherwise, read on for the full Zeo VR module specification.

## Writing modules

Under the hood, Zeo uses the [`archae`](https://github.com/modulesio/archae) module loader. It's just a way of writing client/server `npm` modules that can be started and stopped dynamically.

### package.json

The main thing that makes an `npm` module runnable in VR is that its `package.json` includes the keys `client`, `server`, or `worker` (all of which are optional). These should point to the (package-relative) `.js` files you want to run in the corresponding environments:

#### package.json
```javascript
{
  "name": "my-vr-plugin",
  "client": "client.js",
  "server": "server.js",
  "worker": "worker.js"
  "keywords": ["zeo-module"],
}
```

We'll go into the structure of each of these files below.

Also note the `"keywords": ["zeo-module"]`. This is used to discover your module when searching `npm`, but it's not required for loading a [local module](#option-1-local-module) that you don't intend to publish.

#### client.js
```javascript
module.exports = {
  mount() {
    console.log('module loaded');
  },
  unmount() {
    console.log('module unloaded');
  },
};
```

### client / server / worker

Zeo VR handles all of the details of installing, building, bundling, loading, and unloading your modules in the correct environment (`client`, `server`, or `worker`).

The environment in which your Javascript file is loaded depends on which key you use to reference the entry point file in your `package.json`:

- `client` files are loaded in the browser
- `server` files are loaded on the server
- `worker` files are loaded in the browser [via the API](#worker-api)

Regardless of environment, your code can `require()` any NPM module or file in the usual way.

Your `client` and `worker` files will be automatically bundled with [`rollup.js`](https://rollupjs.org/) and loaded in the browser. Likewise, the `server` file can require any `node` module, including native modules.

Although you can only have one of each `client`, `server`, and `worker` Javascript file entrypoints, these can do anything -- including loading additional files and starting parallel processes. Just make sur that whatever you do in your `mount` function [gets cleaned up in `unmount`](#writing-a-module).

Just make sure any npm modules you're using appear in your [`package.json` `dependencies`](https://docs.npmjs.com/files/package.json#dependencies) (i.e. you did [`npm install --save`](https://docs.npmjs.com/cli/install)).

Note that although can use ES6 `import`/`export` for frontend files, `server` files are run bare in `node` and must use `require()` and `module.exports`. Also, note that there is no compilation step -- you must ensure that you're only using Javascript features supported by your environment.

### mount / unmount

The only requirement for making this work is that your Javascript files `export` a `mount` function to run when your module is loaded, and (optionally) an `unmount` function to run when your module is unloaded.

The only requirement on these functions is that:

1. `mount` ensures everything you need is loaded, and either does so synchronously or returns a `Promise` that will resolve when loading is finished, and
1. `unmount` undoes everything that `mount` did, and either does so synchronously or returns a `Promise` that will resovle when unloading is finished

(Under the hood, this is just the [`archae`](https://github.com/modulesio/archae) plugin format).

#### Example module file
```javascript
// a valid VR module
module.exports = {
  mount() {
    console.log('module loaded');
  },
  unmount() {
    console.log('module unloaded');
  },
};
```

If all you do is this, your module will be loadable in Zeo VR.

However, to do meaningful VR things, such as add content to the scene, make your module configurable, or interact with other modules, you'll want to use the `zeo` API.

`zeo` is available as a global variable. The full API specification is [here](#api-introduction).

#### Getting at the zeo object
```javascript
module.exports = {
  mount() {
    console.log('here is the THREE object', zeo.THREE);
  },
};
```

## Loading modules

Once you've written a module that meets the specification, you have two options for loading it into Zeo VR:

- put the module files on your server ([Option 1](#option-1-local-install))
- publish to `npm` ([Option 2](#option-2-publish-to-npm))

These are functionally equivalent. The only difference is that your module will not be available on other Zeo VR servers unless you publish to `npm` (option 2).

### Option 1: Local install

This method is most useful for testing plugins as you develop them, without the overhead of publishing and downloading from `npm`.

To use a plugin locally, simply drop your `npm` module's directory (which otherwise meets the same module specification) into `/plugins` in the `zeo` project root. For example, `/plugins/my-vr-module` would be the right place to put a `zeo` plugin named `my-vr-module`.

Once you've done this, you'll be able to add your plugin to your world the normal way in Zeo VR, by choosing it from `World` tab. Note that you can only do this on the server where you dropped your plugin.

### Option 2: Publish to npm

Publishing your plugin to `npm` is the best way to make your module available on any Zeo VR server.

To do this, just do a regular [`npm publish`](https://docs.npmjs.com/cli/publish) for any module after adding `"zeo-module"` to the `"keywords"` array in your `package.json` so Zeo VR can find it on `npm`.

#### package.json
```js
{
  "name": "my-vr-module",
  "version": "0.0.1",
  "keywords": [
    "zeo-mod"
  ],
  "client": "client.js"
}
```

To add a published module to your world, search for it in the `World` tab. Anyone on any Zeo VR server will be able to search for your module and add it to their world.
