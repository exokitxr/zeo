const {
  WIDTH,
  HEIGHT,
} = require('../constants/menu');

const getLoginSrc = ({username, password, inputIndex, inputValue, loading, focusType}) => {
  return `\
    <div style="position: relative; display: flex; width: ${WIDTH}px; height: ${HEIGHT}px; justify-content: center; align-items: center;">
      <div style="position: absolute; top: 0; left: 0; right: 0; display: flex; height: 100px; padding: 20px; background-color: #000; font-size: 40px; color: #FFF; box-sizing: border-box; align-items: center;">Zeo VR</div>
      <div style="width: 640px;">
        ${!loading ?
          `<div style="margin-bottom: 20px; font-size: 40px; line-height: 1.4;">Log in</div>
          <a style="position: relative; display: block; margin-bottom: 20px; background-color: #EEE; font-size: 40px; text-decoration: none;" onclick="login:focus:username">
            ${focusType === 'username' ? `<div style="position: absolute; width: 2px; top: 2px; bottom: 2px; left: ${inputValue}px; background-color: #333;"></div>` : ''}
            <div>${username}</div>
            ${!username ? `<div style="color: #AAA;">Username</div>` : ''}
          </a>
          <a style="position: relative; display: block; margin-bottom: 20px; background-color: #EEE; font-size: 40px; text-decoration: none;" onclick="login:focus:password">
            ${focusType === 'password' ? `<div style="position: absolute; width: 2px; top: 2px; bottom: 2px; left: ${inputValue}px; background-color: #333;"></div>` : ''}
            <div>${password}</div>
            ${!password ? `<div style="color: #AAA;">Password</div>` : ''}
          </a>
          <a style="display: block; padding: 20px; margin-right: 10px; border: 1px solid #333; border-radius: 100px; font-size: 40px; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="login:submit">Submit</a>`
        :
          `<div style="font-size: 40px;">Loading...</div>`
        }
      </div>
    </div>
  `;
};

module.exports = {
  getLoginSrc,
};
