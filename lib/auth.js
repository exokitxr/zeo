const crypto = require('crypto');
const base128 = require('base128');

const CIPHER_SUITE = 'sha1';
const KEY_SIZE = 128;
const TOKEN_SIZE = 32;
const RAW_TOKEN_SIZE = 128;

const makeKey = () => crypto.randomBytes(KEY_SIZE / 8);

const makeToken = ({key}) => {
  const rString = base128.encode(crypto.randomBytes(TOKEN_SIZE / 8));

  const hmac = crypto.createHmac(CIPHER_SUITE, key);
  hmac.update(rString);
  const signature = base128.encode(hmac.digest());

  return new Buffer(signature + '\u0080' + rString, 'utf8').toString('base64');
};
const parseToken = ({key, token: tokenStringBase64}) => {
  const signatureTokenString = new Buffer(tokenStringBase64, 'base64').toString('utf8');

  const match = signatureTokenString.match(/^([\s\S]+?)\u0080([\s\S]+?)$/);
  if (match) {
    const signature = match[1];
    const rString = match[2];

    const supposedSignature = base128.decode(new Buffer(signature));

    const hmac = crypto.createHmac(CIPHER_SUITE, key);
    hmac.update(rString);
    const realSignature = hmac.digest();

    if (supposedSignature.equals(realSignature)) {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
};

const _jsonParse = s => {
  let error = null;
  let result;
  try {
    result = JSON.parse(s);
  } catch (err) {
    error = err;
  }
  if (!error) {
    return result;
  } else {
    return null;
  }
};

module.exports = {
  makeKey,
  makeToken,
  parseToken,
  RAW_TOKEN_SIZE,
};
