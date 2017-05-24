# Introduction

### What is Zeo VR?

It's a multiplayer VR web server that lets you hotload magic into your world with npm modules. On top of that it has a distributed programmable blockchain currency you can hold and use in the world to unlock even more magic. &#x2728; &#x1F984; &#x2728; &#x1F47E;

It's been asked whether this is a joke. &#x1F639;

### How do I get in on this?

If you're feeling adventurous, find a server [here](/servers). Expect treasures and horrors.

To join a VR world all you need is to open the URL in your web browser (<i>fits in a tweet!</i> &#x1F426;). You can use a mouse and keyboard to emulate the controls. Of course, it also supports true VR headsets with WebVR. Batteries include: voice chat, in-VR node configurator, models/audio/video media drag-and-drop, and other goodness comes in the box. It's all open source, and almost 100% Javascript.

To run your own server all you need is `node`. [Learn how to get started](run-a-server).

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
