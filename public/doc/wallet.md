# Wallet

### How does this all work?



### How do I manage my coins?

Short answer: use the (webwallet)[/wallet].

Long answer: there's a distributed blockchain mining network running in the background. It's a `bitcoind` fork with tweaked (much faster) parameters. (Yes, you can totally mine it yourself!)

Just as in Bitcoin, the blockchain is a distributed global ledger of who owns which coins. Nobody can spend coins without having the mathematical keys to them -- it's computationally impossible. Your keys are just a set of English words.

A webwallet is a webpage that stores these keywords in a local-only browser cookie and looks up which things you own. And it has exposes a limited API that allows servers to look at your wallet and authorize transactions. VR servers gather this information and display it in the form of avatars holding coins in the world.

Although we host the webwallet software, it's just for convenience. We have no control over the blockchain network; it runs on P2P internet consensus magic.

You can use your own wallet if you like. The code is open source.
