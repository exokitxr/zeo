#### Engine

Engines are the _non_ user-replaceable parts of your app. They are the APIs you write for. You can depend on them, you can even pick and choose them, but you don't get to change them. Examples of engines:

[react-dom](https://www.npmjs.com/package/react-dom)
[express](https://github.com/expressjs/express)
[Three.js](https://github.com/mrdoob/three.js/)
[ammo.js](https://github.com/kripken/ammo.js/)
[redis](https://github.com/NodeRedis/node_redis)
[node-http-proxy](https://github.com/nodejitsu/node-http-proxy)

Notice that engines can exist on the client, server, or both.

As a user, you don't have to care about how your engines start or shut down, how they work, or how they play with others. That's the responsibility of the engines to get right.

#### Plugin

Plugins are the user-replaceable parts of your app. They are plain NPM modules. They can be whatever Javscript you want, but to actually do real-world stuff, you probably want to write them to use your engine's APIs. A plugin is encouraged to use as many engines as it needs, on both the client and server side. It can use all of these simultaneously.

The only hard requirements for a plugin are that

a) it cleans up after itself, and
b) it does not play outside of its sandbox, interfering with the infrastructure or other plugins

#### Archae

The role of archae in all of this is to be the glue that runs your engines, wires them up to your plugins, and exposes a nice configuration API on top.
