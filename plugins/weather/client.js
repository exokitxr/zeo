const PARTICLE_PLUGIN = 'plugins-particle';

class Weather {
  mount() {
    const {elements} = zeo;

    this._cleanup = () => {};

    return elements.requestElement(PARTICLE_PLUGIN)
      .then(particleElement => {
        particleElement.addRain(0, 0);
        particleElement.addSnow(-1, 0);
        particleElement.addSmoke(0, -1);
      });
  }

  unmount() {
    this._cleanup();
  }
};

module.exports = Weather;
