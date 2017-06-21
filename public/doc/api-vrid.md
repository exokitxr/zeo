## VRID API

This API allows your mod to interact with the [VRID blockchain](/docs/vrid).
You should understand how VRID works before using this API. Blockchains can be a bit confusing! &#x1F635;

Participating in VRID blockchain replication and consensus is a major job, so this API is just a layer that makes requests to a VRID node running elsewhere. The URL to use is configured on server startup (`vridUrl`). There's a default run by the project, but it's easy to [run your own](https://github.com/crds) if you prefer.

This API just presents a nice way to talk to the configured VRID node.

#### `getAddress()`

Returns a string containing the current user's VRID address.

Guaranteed to succeed since addresses are automatically generated, but note that it can change if the user switches accounts.

#### `requestBalances({address = getAddress(), confirmed = false})`

Returns a `Promise` that resolves to the assets balances for VRID address `address`. The result is `[{asset, quantity}]` where the `asset` is the asset mnemonic (like `CRD`) and `quantity` is the number owned. If the asset isn't in the list its quantity is zero.

`requestBalances` should never fail unless there's a network issue.

The `confirmed` flag chooses whether we want the guaranteed confirmed balances (`true`), or the up-to-date ones (`false`). The default (`false)` factors in messages that have been verified but not confirmed by the network. The tradeoff for `true` is that it can take a while to see updated balances because charges need to settle. This is a feature! There's [juicy technical details on Github](https://github.com/modulesio/crds).

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

#### `requestCharge(chargeSpec)`

Requests the user to accept a charge (via a notification). If the user accepts, requests the VRID node to perform a charge. `chargeSpec` is a charge object that looks like this:

```
const chargeSpec = {
  srcAddress, // optional
  dstAddress,
  srcAsset,
  srcQuantity,
  dstAsset, // optional
  dstQuantity, // optional
};
```

- `srcAddress`: The VRID address of the user being charged, optional (defaults to `getAddress()`).
- `dstAddress`: The VRID that is getting paid. If you want to pay yourself, this is your address.
- `srcAsset`: The source asset mnemonic (like `CRD`) you're charging.
- `srcQuantity`: The quantity of `srcAsset` you're charging.
- `dstAsset`: Optional. If you're paying (selling) `srcAddress` something _in return for their `srcAsset`_, that asset name goes in `dstAsset`. For example, if you're selling 10 `POTION` for 1 `CRD`, then we would have `{srcAsset: 'CRD', srcQuantity: 1, dstAsset: 'POTION', dstQuantity: 10}`.
- `dstQuantity`: Optional. Required if there's a `dstAsset`.

The result is a `Promise` that will resolve if the charge ends up accepted on the network, and rejects with an error otherwise (including if the user cancels the request, or if there are insufficient funds).

It's worth noting that successful resolution of the `Promise` only means the charge has been accepted. The balance returned by `requestBalances({confirmed: false})` will reflect the charge immediately, but the user will have the option of charging back for a short while.
