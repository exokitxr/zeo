# Introduction

## What's this

*Zeo* is a multiplayer VR server for your browser that you can extend with a mods in realtime. Mods are just Javascript (node modules) that run in the browser or on the server. There's already a large collection of mods for you to play with, but you can also make your own, it's pretty easy. 

Modded or not, anyone can join your Zeo server if you give them the URL. That could get confusing, but luckily there's a magic Virtual Reality IDentity (VRID) system baked in that tracks your avatar and the digital things you _regardless of which server you're on_, because your VRID lives in a distributed blockchain. Oh yeah, and your avatar can own real credits and other digital assets. And by real we mean fake.

It's been asked whether this whole thing is a joke. The answer is yes. But you can use it anyway!

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

To see all of the VR APIss you can hook into, see [here]().
