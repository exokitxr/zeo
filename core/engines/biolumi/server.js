class Biolumi {
  mount() {
    this._cleanup = () => {};
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Biolumi;
