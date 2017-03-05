const {
  WIDTH,
  HEIGHT,
} = require('../constants/menu');

const getLoginSrc = ({token, inputIndex, inputValue, loading, error, focusType}) => {
  return `\
    <div style="position: relative; display: flex; width: ${WIDTH}px; height: ${HEIGHT}px; justify-content: center; align-items: center;">
      <div style="position: absolute; top: 0; left: 0; right: 0; display: flex; height: 100px; padding: 20px; background-color: #000; font-size: 40px; color: #FFF; box-sizing: border-box; align-items: center;">Zeo VR</div>
      <div style="width: 640px;">
        ${!loading ? `\
          ${error ? `\
            <div style="display: flex; position: absolute; left: 0; right: 0; margin-top: -100px; height: 80px; background-color: #F44336; color: #FFF; font-size: 40px; font-weight: 400; justify-content: center; align-items: center;">
              ${error === 'EINPUT' ? 'Enter a token.' : ''}
              ${error === 'EAUTH' ? 'Invalid token.' : ''}
            </div>
          ` : ''}
          <a style="position: relative; display: block; margin-bottom: 30px; background-color: #EEE; font-size: 40px; text-decoration: none;" onclick="login:focus:token">
            ${focusType === 'token' ? `<div style="position: absolute; width: 2px; top: 2px; bottom: 2px; left: ${inputValue}px; background-color: #333;"></div>` : ''}
            <div>${token}</div>
            ${!token ? `<div style="color: #AAA;">Token</div>` : ''}
          </a>
          <a style="display: inline-block; padding: 4px 25px; border: 1px solid #333; border-radius: 100px; color: #333; font-size: 30px; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="login:submit">Log in</a>
        ` : `\
          <div style="font-size: 40px;">Loading...</div>
        `}
      </div>
    </div>
  `;
};

module.exports = {
  getLoginSrc,
};
