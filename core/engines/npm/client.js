class Npm {
  constructor(archae) {
    // this._archae = archae;
  }

  mount() {
    // const {_archae: archae} = this;

    const _requestSearch = s => fetch('/archae/npm/search?q=' + encodeURIComponent(s))
      .then(res => res.json())
      .then(result => result.map(element => {
        const {package: {name, version, description, keywords}, searchScore: score} = element;
        return {
          name,
          version,
          description,
          keywords,
          score,
        };
      }));

    return {
      requestSearch: _requestSearch,
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Npm;
