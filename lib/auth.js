const crypto = require('crypto');

const CIPHER_SUITE = 'RSA-SHA256';

const makeToken = ({privateKey}) => {
  const token = {
    credit: Infinity,
    r: crypto.randomBytes(128 / 8).toString('hex'),
  };
  const tokenString = JSON.stringify(token);

  const sign = crypto.createSign(CIPHER_SUITE);
  sign.end(tokenString);

  const signature = sign.sign(privateKey, 'base64');

  return new Buffer(signature + tokenString, 'utf8').toString('base64');
};
const parseToken = ({publicKey, token: tokenStringBase64}) => {
  const signatureTokenString = new Buffer(tokenStringBase64, 'base64').toString('utf8');

  const match = signatureTokenString.match(/^([^\{]+?)(\{.+?)$/);
  if (match) {
    const signature = match[1];
    const tokenString = match[2];

    const verify = crypto.createVerify(CIPHER_SUITE);
    verify.end(tokenString);

    const signatureBuffer = new Buffer(signature, 'base64');
    if (verify.verify(publicKey, signatureBuffer)) {
      return _jsonParse(tokenString);
    } else {
      return null;
    }
  } else {
    return null;
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
  makeToken,
  parseToken,
};
