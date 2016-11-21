import Alea from 'alea';

/*
 * This script creates a random name with the generator from Elite`s Galaxies
 * 
 * usage: just call
 * genNames()
 * 
 */

const api = {};

const digrams =
  "ABOUSEITILETSTONLONUTHNO" +
  "..LEXEGEZACEBISO" +
  "USESARMAINDIREA." +
  "ERATENBERALAVETI" +
  "EDORQUANTEISRION";

function makePlanetName(seed) {
  seed = seed || String(Math.random());

  const rng = new Alea(seed);

  let seed0 = Math.floor(rng() * 65535);
  let seed1 = Math.floor(rng() * 65535);
  let seed2 = Math.floor(rng() * 65535);

  function rotatel(x)
  {
      var tmp = (x & 255) * 2;

      if(tmp > 255) tmp -= 255;

      return tmp;
  }

  function twist(x)
  {
      return (256 * rotatel(x / 256)) + rotatel(x & 255);
  }

  function tweakseed()
  {
      var tmp;

      tmp = seed0 + seed1 + seed2;
      tmp &= 65535;

      seed0 = seed1;
      seed1 = seed2;
      seed2 = tmp;
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // original LPT-code was: pairs = digrams[24..<1];
  var pairs = digrams.substring(24)
  var name = "";
  var pair1, pair2, pair3, pair4, pair5;
  var longname, verylongname;

  longname = seed0 & 64;
  verylongname = seed0 & 64;

  pair1 = 2 * ((seed2 / 256) & 31); tweakseed();
  pair2 = 2 * ((seed2 / 256) & 31); tweakseed();
  pair3 = 2 * ((seed2 / 256) & 31); tweakseed();
  pair4 = 2 * ((seed2 / 256) & 31); tweakseed();
  pair5 = 2 * ((seed2 / 256) & 31); tweakseed();

  name += ( pairs[pair1]);
  name += ( pairs[pair1 + 1]);
  name += ( pairs[pair2]);
  name += ( pairs[pair2 + 1]);
  name += ( pairs[pair3]);
  name += ( pairs[pair3 + 1]);

  if(longname || verylongname)
  {
      name += ( pairs[pair4]);
      name += ( pairs[pair4 + 1]);
  }
  if(verylongname)
  {
      name += ( pairs[pair5]);
      name += ( pairs[pair5 + 1]);
  }
  return capitalize(name.replace(/\.+/g, " ").trim().toLowerCase());
}
api.makePlanetName = makePlanetName;

module.exports = api;
