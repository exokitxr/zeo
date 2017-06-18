## What's VRID?

It's your *V*irtual *R*eality *ID*entity. Manage yours [here](/id).

Basically it's your avatar on VR servers. Your VRID holds your stats, `CRD` ("credits") virtual currency, and items. Your VRID _carries across servers_ because it's _not stored on any server_ -- it's replicated on the [`CRD` blockchain](https://github.com/modulesio/crds).

## How do I get one?

You don't need to do anything! You already [have a VRID here](/id).

Basically a VRID is just a secret number that identifies you to the blockchain and lets you make transactions on it. But don't worry about all that &mdash; it's handled for you under the hood.

The only thing you need to remember is that your VRID secret key is stored in your browser cookies, so _you should export it_ and keep it safe. If you provide your email on your [VRID page](/id) we'll set you up with recovery.

## What can I do with VRID?

With your VRID you can do awesome things like find hidden treasures across the metaverse, trade with people you meet, and [make your own mods](/docs/api) and sell them. You don't need anyone's permission.

That's the power of of the blockchain &#x1F984;.

## What's the CRD blockchain?

A blockchain is an internet transaction system with no owner. Think of it like a bank run by robots who pay people to keep them running.

Bitcoin is one blockchain, but there are many. `CRD` ("credits") is just another blockchain that uses the same concepts and algorithms as Bitcoin. The main difference is that CRD is specifically designed for realtime servers like VR. Some features of `CRD`:

- _Fast transactions_: Much higher limits and lower block times compared to Bitcoin
- _Security features_: Charge and chargeback support (like credit cards), which lets you use CRD even with untrusted people in untrusted environments
- Extensible value: Invent new currencies and trade them, so when you make a badass +1 Sword you can trade for 10 potions of invisibility
- _Designed for the web_: CRD is based on Javascript and JSON, which works smoothly in web browsers

The [`CRD` software is open source on Github](https://github.com/modulesio/crds). You'll find much more technical discussion there.

## What's the CRD currency?

`CRD` is the basic currency of the `CRD` blockchain.

The only special thing about `CRD` is that it's what miners get for "mining" the `CRD` blockchain.

## How do I get CRD?

1. [Mine the `CRD` blockchain](https://github.com/modulesio/crds).
1. Find `CRD` on [public servers](/servers). Pick it up and put it in your VRID wallet.
1. Make awesome VR stuff and [open a VR store](/docs/payments).
1. Ask on Twitter! [#zeovr](https://twitter.com/hashtag/zeovr)

## I'm a nerd, what are the deets

It's a `SHA-256` Merkle tree of JSON signed with `secp256k1` ECC. Blocks and messages are indexed in a database, also JSON. No TXO's, just balances.

Mining is dynamic target `SHA-256`, solution gets constant coinbase. Minting custom tokens requires holding the corresponding minting token. Anyone can assign themselves a minting token for an unassigned name.

Sends are to an address, no scripts. Divisibility to cents.

Charges and chargebacks are sends that require no signature, but have settle block delay. Within that delay either party can sign a message to chargeback. Addresses can be locked to prevent charges, which will be immediately rejected.

More on the [Github page](https://github.com/modulesio/crds).
