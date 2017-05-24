# Introduction

## What's this

It's multiplayer server that runs VR in your browser and lets you hotload mods. Mods are just Javascript code (npm modules).

Your VR identity (VRID) is stored on a blockchain so your virtual credits (self-worth) travel with you across servers. Anyone can run a server or make their own mods. It's all open source.

It's been asked whether this is a joke; the answer is yes. But you can use it anyway!

## How's I get in on it?

#### Join a server

List of servers [here](/servers). You join at the pleasure of the server admin. Expect treasures and horrors.

To join a world all you need is to open the server URL (<i>fits in a tweet!</i>) in a web browser with WebGL support. You can use a mouse and keyboard to emulate the controls, but you can also use a true headset with WebVR.

If you have the hardware and grant the serv permission, you can even use voice and video chat.

#### Run a server

If you don't want to play by someone else's rules, you can [run your own server](/docs/run).

#### Manage my identity

Your VR identity (VRID) runs on a distributed blockchain. It's just a browser cookie on your machine, so you're in control. Your VRID follows you across servers automatically. You can export your VRID anytime -- it's just a set of English words you can write down.

Manage your VRID with a webwallet [here](/id), _but that's just for conveniece. You can totally [run your own](/webwallet)._

#### Make my own VR content

Modules are just Javascript based on [THREE.js](https://threejs.org). To make your module available form VR, just publish to [npm](https://npmjs.org) with the `zeo-module` keyword. Your module can run code in both the browser and the server, and even accept payments.

[Learn the API](/docs/api) to see all of the things your module can do.

### How do I make my own content?

It's literally just `npm` modules. If you publish with the `zeo-module` keyword your module is instantly avialable to load on any server.

Modules can contain arbitrary browser-side and server-side Javascript code, and you can of course depend on any module on `npm`. Modules are automatically hotloaded and unloaded.

For how to make your module hotloadable (super easy!), see [here]().

To see all of the VR apis you can hook into, see [here]().

### How do I manage my coins?

Short answer: use the (webwallet)[/wallet].

Long answer: there's a distributed blockchain mining network running in the background. It's a `bitcoind` fork with tweaked (much faster) parameters. (Yes, you can totally mine it yourself!)

Just as in Bitcoin, the blockchain is a distributed global ledger of who owns which coins. Nobody can spend coins without having the mathematical keys to them -- it's computationally impossible. Your keys are just a set of English words.

A webwallet is a webpage that stores these keywords in a local-only browser cookie and looks up which things you own. And it has exposes a limited API that allows servers to look at your wallet and authorize transactions. VR servers gather this information and display it in the form of avatars holding coins in the world.

Although we host the webwallet software, it's just for convenience. We have no control over the blockchain network; it runs on P2P internet consensus magic.

You can use your own wallet if you like. The code is open source.
