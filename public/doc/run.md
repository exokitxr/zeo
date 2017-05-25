# Run a server

A server is a VR world. Anyone can run one. The code is [open source on Github](https://github.com/modulesio/zeo).

The only requirement is `Node.js` running on a unix-like environment. You can use Linux, Mac OSX, or even Windows 10 with [WSL](https://en.wikipedia.org/wiki/Windows_Subsystem_for_Linux). You can get Node.js [here](https://nodejs.org), or use [`nvm`](https://github.com/creationix/nvm).

#### Couple of notes

Keep in mind that by design, servers allow installing third-party mods, which can run code on the server. These are all open source (npm modules), but unless you're going to check each module you install (_you're not!_), you probably don't want to give them access to your machine.

There's an easy solution: run in a container. The recommended way to run a server is with [Docker](https://docker.io), and that's fully supported.

#### Docker (recommended)

```
docker run -p 8000:8000 modulesio/zeo
```

Get `docker`:

```
curl -sSL https://get.docker.com/ | sh
```

#### Heroku

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

You can use the free tier.

#### Now.sh

```
now modulesio/zeo
```

Get `now`:

```
npm i -g now
```

You can use the free tier.

#### Bare server

```
npm i modulesio/zeo
```

Be careful with this. Any modules you install will have access to your server. If you don't want that, use Docker instead. It's just as easy, and has the same performance. See above.
