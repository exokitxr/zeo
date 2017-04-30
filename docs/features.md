# Features

### In-VR world builder

<div style="display: flex; background-color: #CCC; width: 560px; height: 315px; margin: 20px 0; justify-content: center; align-items: center; font-size: 30px; font-weight: 400;">Video goes here</div>

We built this thing from the ground up to work in VR. Whether you're 3D modeling, animating, chatting, or typing text, it's designed to work without you ever taking off your headset. &#x1F60E;

In fact there is no VR-less interface at all -- the only way to _not_ use a headset and controllers is to fake them with your mouse and keyboard!

But don't worry, that's fully supported! We even made a [tutorial](/docs/tutorial) for you to familiarize yourself with controlling your avatar when you're without VR gear. &#x1F50C;

### In-browser multiplayer

<img src="/img/minecraft.svg" width=100 height=100>

Every world automatically supports other avatars joining in. Just paste people the URL -- it fits in a tweet. All they need is a browser.

There is of course positioned voice chat support, whether you're using a headset or not. Since it's server based, there's no weird connection stuff to worry about. You can VR-meet with people across continents if you want. &#x1F30E;

And if you're feeling lonesome, you can browse servers and explore other people's worlds. Servers automatically broadcast their presence to share the VR love. &#x1F497;

### Serverless VR server

<img src="/img/google-chrome.svg" width=100 height=100>

We designed this thing to deploy to [Heroku](https://heroku.com/), [Glitch](https://glitch.com/), and [now](https://zeit.co/now) easily, for free.

Even if you're not a l33t vr haxxor, you can start up a VR server and invite people to join on a dime's notice. All you need is a basic understanding of how the internet works, and if you screw up it doesn't matter: it wasn't your machine anyway! &#x1F468;&#x200D;&#x1F52C; &#x1F4A5;

Move your worlds around by uploading and downloading the `zip` files. &#x1F5DC;

### Pure Javascript

<div style="display: flex;"?>
  <img src="/img/nodejs.svg" width=100 height=100>
  <img src="/img/npm.svg" width=100 height=100>
</div>

Time for some geek talk. This crud is built with the world's most popular programming language. &#x1F468;&#x200D;&#x1F4BB;

If you know Javascript you'll feel right at home hacking your world. If you know [THREE.js](https://threejs.org/) then you have nothing to learn.

There's no secrets in the code; it's just a bunch of readable `npm` modules stuck together. To get it running, run

```
npm install modulesio/zeo
```

wherever `node` is found.

### Backend and frontend

This isn't just a browser framework; it's full stack. That means your VR world can run any piece of code you want, whether it's in the browser, or whether it's JS at all.

Run server-side physics &#x269B;, scrape Youtube videos &#x1F39E;, upload models and media to the world by dragging it into the browser window &#x1F4BB;, or emulate retro video game consoles and play them together in VR. &#x1F4FA; &#x1F3AE;

You can even code things live without leaving the page, since modules get [hotloaded](https://en.wikipedia.org/wiki/Hot_swapping) when you save them.

### An API you (probably) already know

<img src="/img/github-circle.svg" width=100 height=100>

We tried to keep the surprises _inside_ the VR and _out of_ the code. &#x1F913;

Everything is an `npm` module, and modules export functions that add stuff to the THREE.js scene graph or handle HTTP routes. That's basically it; if you've coded for the browser or `node` before then you'll feel right at home with [the API](/docs/api).

To make your stuff configurable from the VR world, just specify the JSON Entity-Component schema: "the sky has a color and it's controlled by this material". The VR UI is automagically generated for you. &#x1F984;

If that sounds complicated, we've got your back with the [docs](/docs/api) and plenty of [exiting modules](/modules) for you to learn from and steal (if you feel so inclinded).

<a href="/docs/contact" style="display: inline-flex; margin: 10px 0; padding: 10px 15px; border: 2px solid; color: #000; font-weight: 400; text-decoration: none; justify-content: center; align-items: center;">Next: Contact &#x1F449;</a>
