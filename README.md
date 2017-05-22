<img src="https://cdn.rawgit.com/modulesio/zeo/de2961d8bf3edbad67d0e2ce8491314ae6b065bf/public/img/heading.jpg" width="200px">

Peer to peer WebVR appstore on a blockchain. _Achievement unlocked: Buzzword Bingo_

A [`node.js`](https://nodejs.org) multiplayer VR server you can hack with drag-and-drop npm modules. _Some cool stuff exists already_. Anyone can join with a URL, using a headset or mouse + keyboard.

Backed by a blockchain and webwallet, so your self worth is defined by meaningless internet points that follow you across servers. Just like RL. Find coins on servers use them to buy stuff.

Open source. APIs for rendering, input, mining, and payments. So if you make something cool, publish it to npm and start making money.<sup>*</sup>

<sup>*</sup> not real money :(

## Run a server

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

Be careful: expect your server to be taken over. If you don't want this, use Docker (easy, highly recommended, see above).

## Run a miner

```
minerd -a sha256d -o http://127.0.0.1:18332 -O 'backenduser:backendpassword' --coinbase-addr=n3W1ExUh7Somt28Qe7DT5FUfY127MY4r1X
```

## Features

- One command `npm install`
- WebVR based, polyfilled for older browsers
- World persistence
- [NPM](https://npmjs.org) ecosystem access from VR
- In-VR module configurator
- Multiplayer with voice chat
- Server-side physics
- Modules are plain [`three.js`](https://threejs.org) [Web Components](https://developer.mozilla.org/en-US/docs/Web/Web_Components)
- Modules hotload on front + backend via [`archae`](https://github.com/modulesio/archae)
- Browser API for HMD + Controllers querying
- Per-frame, per-eye callbacks
- Positional audio support
- File upload/download integration
- HMD + controller emulation with keyboard + mouse
- It's just Javascript, so change whatever you like

// XXX fill this in

## API documentation

Docs are [here](https://zeovr.io/docs).

## Awesome modules

Here's a showcase of some of the `npm` modules you can run on Zeo:

// XXX fill this in

## Contributing

PR's welcome! File an issue if you think you found a bug.

## Contact

Slack: https://zeovr.slack.com
Twitter: [@modulesio](https://twitter.com/modulesio)

If you want to reach me privately, I'm Avaer Kazmer <a@modules.io>.
