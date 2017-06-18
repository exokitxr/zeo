## What is a mod?

A `mod` is a piece of Javascript code that runs on your VR server.

You can add and remove mods from your VR server using the `Mods` tab in your menu, and configure them on the `Entities` tab.

<img src="img/mods.png" style="width: 100%;">

Mods are just [`npm`](https://npmjs.org/) modules -- packages Javascript code on the `npm` registry. Mods are usually _open source_ and you'll probably find the code on Github.

Mods can run on both the frontend _and_ the backend of your server. This is controlled by the module's `package.json`. The full module specification is [here](/mods-spec).

## Mods vs entities

An `entity` is a `mod` running on your server.

When you add a `mod` to your server you create an `entity` for it. The same mod can be added multiple times, in which case you will have multiple entities for one mod.

Each entity can be configured individually. You can add mods from the `Mods` tab of your menu, and configure them on the `Entities` tab. You can do all of this from inside of VR.

Every mod behaves differently. Good mods have a `Readme` file (which you can read from the menu) that describes how it works and how to configure its entities.

Mods and entities are bound to the server they were added to. Unlike your [VRID](/vrid) they do not follow you across servers. However, mods _can_ track your VRID across servers and act accordingly. So if you own a `+1 Sword`, the `sword` mod/entity will be able to tell, and show everyone that you do in fact own that sword.

## Mod API

Mods run Javascript code in both the browser and on the server, and plug into the VR world using a defined API.

There is [API documentation](/api) that explains all of this stuff, and since everything is open source, you can always read the code to figure it out.

There are mods that add [items](/modules/z-potion), [games](/modules/z-fighter), and [additional features](/modules/z-console).

## Security

Mods can run arbitrary code, and everything was designed with this in mind.

We recommend running your VR server in a Docker container to contain the mess that mods can make. Running in Docker is fully supported and should work out of the box.

Your VRID is secured by the `CRD` blockchain. Mods never see your VRID secret key, so they can't mess with it. Mods can post charges to your VRID without permission, but you can always cancel charges (chargeback) with your secret key.

If you find a mod doing something unsavory &#x1F4A9; [let us know](mailto:support@zeovr.io)! We have a bag of tricks. &#x1F389;
