# Writing Archae mods

An Archae mod is just _a package published to `npm`_, with a `package.json` describing the files to load, and where to load them (server, client, or worker).

## Specification

An Archae mod's `package.json` should contain _zero or more_ of the following keys:

```js
// package.json
{
  ...
  "client": "path/to/a/client-side-file.js",
  "server": "path/to/a/server-side-file.js",
  "worker": "path/to/a/web-worker-file.js",
  ...
}
```

Although not required, the file names for these are conventionally:

```js
// package.json
{
  ...
  "client": "client.js",
  "server": "server.js",
  "worker": "worker.js",
  ...
}
```

Paths is relative to the package root, and must not walk outside of the package using `..`. Paths must resolve to a file bundled with the NPM module. `client`, `servrr`, and `worker` files are all optional, but if included must meet the following specification:

#### `"client"`

The `"client"` file, typically `"client.js"`, is loaded in the browser and is intended to present a user interface for your mod. It can use whatever browser APIs you like, and it may use apis exposed by your mod's `"server"` as loaded on the server side (see [`server.js`](#"server.js")). The only hard requirement imposed on `"client"` is that it follows the [Mount/Unmount spec](#Mount/Unmount spec) so the loader knows how to initalize and clean up your mod.

Your mod's `client.js` will be automatically bundled via `rollup`. It can be written in any bundling format that `rollup` supports -- that is, either `require/module.exports` or `import/export` (but not both). You may `require`/`import` any additional javascript file (or additional javascript module provided it is listed as a dependency) in the usual way.

Note however that `"client"` cannot `require`/`import` native `node` modules.

#### `"server"`

The `"server"` file, typically `"server.js"`, is loaded (predictably) on the server. Like `"client"`, the only hard requirement is that it follows the [Mount/Unmount spec](#Mount/Unmount spec).

Unlike the `"client"`, the `"server"` it is _not_ bundled with `rollup`. This means that it can only use the `require` loading style; `import` is not supported. Your `"server"` file can however `require` any module compatible with `node`, including native modules.

#### `"worker"`

The `"worker"` file is a special file that 

## Mount/unmount spec

The `mount`/`unmount` spec is followed by all three file types described above and tells Archae how to initialize, load, and unload your mod on demand.

#### Root level

At the top level, your file should `export` either:

1. an `object` declaring your mod's `mount` and `unmount` handlers, or
1. a `function` that will be constructed with `new` and passed a single constructor argument, the `archae` instance, which must return the object in `1)`, or
1. a `class` declaration that can be constructed per `2)`

These three are all equivalent; choose whichever is most appropriate for your use case. Note however that if you want to access the `archae` API you'll need to use either `2)` or `3)` to capture the argument in your constructor.

#### `mount` and `unmount` functions

The `mount` and `unmount` functions you provide via the above API are called when Archae decides to load (or, respectively) unload your module for any reason. Neither is required, but if you aren't providing these then you might want to reconsider why you're using Archae as a loader in the first place.

Both of these functions may, if they choose, return a `Promise` (or other `then`able), in which case the `mount`/`unmount` operation will be considered to not have completed until the `Promise` resolves. You can use this facility to load or unload any additional resources you mod file needs, including loading other mods via Archae's promise-based APIs such as `requestPlugin()`.

The `mount` function's resolved result, whatever it is, will be used as the public-facing API of your mod file. The typical usage is for this to be an object containing the methods that may be called on your mod.

For example:

```js
// client.js
module.exports = () => ({
  mount: () => new Promise((accept, reject) => {
    accept({
      getData: () => {
        return 'data';
      },
    });
  }),
  unmount: () => new Promise((accept, reject) => {
    setTimeout(() => {
      accept();
    }, 1000);
  }),
});
```

The resolved result of the `unmount` handler, whatever it is, will be discarded.

A throw or `Promise` rejection in the `mount` handler will cause your mod's loading to fail, and this fact will be reported to callers depending on it, such as those waiting on calling Archae's `requestPlugin()`. A throw or `Promise` rejection in the `unmount` handler has no effect -- the unmount will be considered successful regardless, though the error will be reported to the console for debugging.

Note that the API exported by your mod in the `mount` handler is environment-specific. That is, whatever you return in a `"client"` file will only be available to other mod's `"client"` files.
