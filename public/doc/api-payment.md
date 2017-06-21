## Payment API

This API allows your mod to interact with the [VRID blockchain](/docs/vrid).
You should understand how VRID works before using this API. Blockchains can be a bit confusing! &#x1F635;

Participating in VRID blockchain replication and consensus is a major job, so this API is just a layer that makes requests to a VRID node running elsewhere. The URL to use is configured on server startup (`vridUrl`). There's a default run by the project, but it's easy to [run your own](https://github.com/crds) if you prefer.

This API just presents a nice way to talk to the configured VRID node.

#### `requestBalances({confirmed = false})`

Returns a `Promise` that resolves to the assets balances for the current user's VRID. The result is `[{asset, quantity}]` where the `asset` is the asset mnemonic (like `CRD`) and `quantity` is the number owned. If the asset isn't in the list its quantity is zero.

The `confirmed` flag chooses whether we want the guaranteed confirmed balances (`true`), or the up-to-date ones (`false`). The default (`false)` factors in messages that have been verified but not confirmed by the network. The tradeoff for `true` is that it can take a while to see updated balances because charges need to settle. This is a feature! There's [juicy technical details on Github](https://github.com/modulesio/crd).s

```
const {vrid} = zeo;

vrid.requestBalances()
  .then(balances => {
    balances.forEach(({asset, quantity}) => {
      console.log(`You have ${quantity} ${asset}.`);
    });
  })
  .catch(err => {
    console.warn('network error', err);
  });
```
