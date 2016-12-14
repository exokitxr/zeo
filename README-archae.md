# Archae

The stupid npm plugin system.

Archae lets you build your app as a set of _plugins_ (npm modules) written for _engines_ (also npm modules). As long as your `npm` module exposes a function to `mount` and `unmount` on the client and/or server (both optional), `archae` will automagically load and serve everything for you, so you can forget about the details and focus on your app. As a bonus you get free goodies like:

- ES6
- `require`, `module.exports`, `import`, `export`
- HTTP/2
- Automatic webpack builds
- Batteries-included engines for databases, frontend rendering, WebGL, and more

## Simple example

#### package.json
```json
{
  name: "my-plugin",
  "client": "client.js",
  "server": "server.js",
  dependencies: {
    "my-dep": "^1.0.0"
  }
}
```

#### client.js
```json
module.exports = archae => ({
  mount() {
    let message = 'Running in the browser!';
    let n = 0;
    const _updateText = () => {
      element.textContent = message + ' You clicked ' + n + ' times.';
    };

    const element = document.createElement('h1');
    element.onclick = () => {
      n++;
      _updateText();
    };
    this.element = element;
    document.body.appendChild(element);

    return {
      changeMessage(m) {
        message = m;
        _updateText();
      }
    };
  },
  unmount() {
    document.body.removeChild(this.element);
  }
});
```

#### server.js
```json
module.exports = archae => ({
  mount() {
    console.log('Running on the server!');
  },
  unmount() {
    console.log('Bye bye!');
  }
});
```

## How it works

Arche pulls, builds, loads, and caches `npm` modules on the backend using `yarn` (for speed), and serves them to the frontend over HTTP/2 (for speed + security), as long as they meet the above spec.

Plugins can be bare JS and can `require` anything they need, and they can load other plugins as needed, but a more powerful way to write your apps is to write them against the `archae` engines: these are npm modules that meet the same API, but whose main role is to provide a _service_ to other plugins. For example, there is an `nedb` engine for persistent storage via a mongodb API on both client and server, and a `three` frontend engine that will set up `three.js` rendering on your page and give you an API for it. By depending on engines you don't have to worry about bootstrapping, while having the freedom to pick and choose the technologies you use, and keeping your code portable by separating your libraries from your application logic.

The Archae core is isomorphic on both the client and server so if you want you can load and unload plugins on either the server or the client -- it's all the same, and it all happens live.

## Definitions

#### Engine

Engines are the _non_ user-replaceable parts of your app. They are the APIs you write for. You can depend on them, you can pick and choose them, and you can even write your own. Examples of engines:

[react-dom](https://www.npmjs.com/package/react-dom)
[express](https://github.com/expressjs/express)
[Three.js](https://github.com/mrdoob/three.js/)
[ammo.js](https://github.com/kripken/ammo.js/)
[redis](https://github.com/NodeRedis/node_redis)
[node-http-proxy](https://github.com/nodejitsu/node-http-proxy)

Notice that engines can exist on the client, server, or both.

Because engines are written in terms of the universal Archae API, you don't have to care about how to start or shut down your engines, how they work, or even where they're running -- that's their responsibility.

#### Plugin

Plugins are the user-replaceable parts of your app. They are plain NPM modules. They can be whatever Javscript you want, but to actually do real-world stuff, you probably want to write them to use your engine's APIs. A plugin is encouraged to use as many engines as it needs, on both the client and server side. It can use all of these simultaneously.

The only hard requirements for a plugin are that

a) it cleans up after itself, and
b) it does not play outside of its sandbox, interfering with the infrastructure or other plugins

#### Archae

The role of archae in all of this is to be the glue that runs your engines, wires them up to your plugins, and exposes a nice configuration API on top.
