# Introduction

## What is Zeo VR?

*Zeo VR* is a [`node.js`](https://nodejs.org) server that delivers Javascript modules from [`npm`](https://npmjs.org) to your web browser and runs them in [`WebVR`](https://webvr.info/).

Basically, it uses web technologies to glue together plain Javascript modules and present it in an immersive VR context. Highlights:

- Multiplayer
- Voice chat
- Server-side physics
- World persistence
- In-VR module configurator
- Positional audio
- Plain [THREE.js](https://threejs.org) API
- Use any [NPM](https://npmjs.org) module
- Run modules on both frontend or backend via [`archae`](https://github.com/modulesio/archae)
- Hot code loading
- Normalized event API for headset and controllers
- Per-frame, per-eye render callbacks
- First class media file and model uploads
- Support all major model formats
- HMD + controller emulation with keyboard + mouse
- Mostly just Javascript
- [Open source on Github](https://github.com/modulesio/zeo)

#### Install Zeo VR

```javascript
npm install zeo
```

#### Install depencencies (Debian/Ubuntu)

```javascript
sudo apt-get install build-essential cmake python ffmpeg libcairo2-dev
```

### Browser requirements

The only requirement for connecting to a Zeo VR server is a device with a web browser that supports [`WebGL`](https://en.wikipedia.org/wiki/WebGL). This includes virtually [every modern web browser](http://caniuse.com/#feat=webgl), including mobile ones.

Note that neither [`WebVR`](https://webvr.info/) nor any VR hardware is actually required: there is mouse + keyboard emulation of VR controls (keybindings are [here](#key-bindings)). That said, the main point of Zeo VR is that it works in virtual reality, so you're missing out without a headset. But the option of working without gear is there, and enjoys first-class support.

If you want to use `WebVR`, you'll need a browser that supports it. For desktop, at the moment that means either [Chromium Experimental](https://webvr.info/get-chrome/) or [Firefox Nightly](https://www.mozilla.org/en-US/firefox/channel/desktop/#nightly). This requirement will go away when WebVR makes it to the stable version of your favorite browser.

### Server requirements

The main requirement for running your own Zeo VR server is _Linux_.

Technically all you need is `node.js`, but some native C++ modules require a build step and a native C++ compiler. _Windows_ and _OSX_ might work, but are not tested. It's recommended that you simply use a Linux virtual machine.

### Headset support

Currently only the [HTC Vive](https://en.wikipedia.org/wiki/HTC_Vive) is supported.

Most other headsets (including mobile platforms like Daydream) _have been known to work_ but are not actively tested. The main annoyance you'll run into is that models, tutorials, and documentation currently assume you're using a Vive. The other is performance.

Support for more devices is on the roadmap.
