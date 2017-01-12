# [zeo.sh](https://zeo.sh)

WebVR worlds in Javascript.

Zeo.sh lets you run `npm` modules in VR from your browser, using a headset or keyboard + mouse. The goal is to get Javascript from your fingers to your face in the shortest time possible.

<img src="https://cdn.rawgit.com/modulesio/zeo-data/defb101e115250f6512ab6f6c29e69ce9e75a80b/video/demo.gif" width="512px">

If you know how to run `node`, you can strap on a headset, pick up your controllers, and build worlds out of the Zeo module ecosystem on `npm`. If you know Javascript, `THREE.js`, and `npm`, then you can write your own.

## Features

- one command `npm install`
- world persistence
- in-VR plugin UI
- multiplayer support
- server-side physics
- file upload/download
- `npm` module ecosystem

Zeo uses the [`archae`](https://github.com/modulesio/archae) module loader.

## Quick install (Linux)

```bash
npm install zeo # requires node 6+
```

:point_right: The _required dependencies_ are `build-essential` and `cmake`. These are needed to build the included [Bullet physics engine](https://github.com/bulletphysics/bullet3). On Debian/Ubuntu you can get these dependencies with:

```bash
sudo apt-get install build-essential cmake
```

If you're using a different package manager it almost certainly has these, though under a different name.

// XXX

```js
function init() {

	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 10000 );
	camera.position.z = 1000;

	geometry = new THREE.BoxGeometry( 200, 200, 200 );
	material = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe: true } );

	mesh = new THREE.Mesh( geometry, material );
	scene.add( mesh );

	renderer = new THREE.WebGLRenderer();
	renderer.setSize( window.innerWidth, window.innerHeight );

	document.body.appendChild( renderer.domElement );

}

function init() {

	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 10000 );
	camera.position.z = 1000;

	geometry = new THREE.BoxGeometry( 200, 200, 200 );
	material = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe: true } );

	mesh = new THREE.Mesh( geometry, material );
	scene.add( mesh );

	renderer = new THREE.WebGLRenderer();
	renderer.setSize( window.innerWidth, window.innerHeight );

	document.body.appendChild( renderer.domElement );

}
```

## Features

- Works with WebVR 1.0
- Fully emulates HMD + tracked controllers, if you don't have the browser or hardware for it
- A ton of included base modules to get you started, including:
  - Multi-world management with a backing database
  - _Server-side_ physics with JavaScript bindings to Bullet
  - Multiplayer support, which plays nicely with the physics server
  - Model loader
  - Positional audio
  - VR `bash` shell so you can hack while jacked
  - Youtube player
  - Portals you can walk through
  - Weather effects
  - Skybox with Rayleigh scattering, sun, moon, and stars
  - Everything is plain JS!

## In progress

  - A menu UI infrastructure
  - Plugin management without leaving VR
  - Voice controls and reading backed by Watson
  - Virtual tools you can pick up and play with
  - Keyboard emulation
  - Emulated game consoles with Retroarch
