const {
  WIDTH,
  HEIGHT,
} = require('../constants/menu');

const getLoginSrc = ({token, inputIndex, inputValue, loading, error, focusType}) => {
  return `\
    <div style="display: flex; width: ${WIDTH}px; height: ${HEIGHT}px; flex-direction: column;">
      <div style="display: flex; height: 100px; padding: 20px; background-color: #000; font-size: 40px; color: #FFF; box-sizing: border-box; align-items: center;">Zeo VR</div>
      <div style="display: flex; height: 200px; background-color: #2196F3; color: #FFF; font-size: 16px; font-weight: 400; flex-direction: column; justify-content: center; align-items: center;">
        <div style="width: 640px;">
          <h3>You're not logged in to this server!</h3>
          <p>To log in:</p>
          <ul style="list-style-type: none; padding: 0;">
            <li>- Enter your login token in the URL and reload the page, or</li>
            <li>- Drag-and-drop a file containing your login token, or</li>
            <li>- Enter or paste your login token below</li>
          </ul>
        </div>
      </div>
      <div style="position: relative; display: flex; padding-top: 50px; justify-content: center; align-items: center; flex-direction: column;">
        <div style="width: 640px;">
          ${!loading ? `\
            ${error ? `\
              <div style="display: flex; position: absolute; left: 0; right: 0; margin-top: ${-50 - 80}px; height: 80px; background-color: #F44336; color: #FFF; font-size: 30px; font-weight: 400; justify-content: center; align-items: center;">
                <div style="display: flex; width: 640px;">
                  <div style="flex: 1;">
                    ${error === 'EINPUT' ? 'Enter a token.' : ''}
                    ${error === 'EAUTH' ? 'Invalid token.' : ''}
                  </div>
                  <a style="display: flex; width: 80px; border: 1px solid; border-radius: 5px; text-decoration: none; justify-content: center; align-items: center;" onclick="error:close">X</a>
                </div>
              </div>
            ` : ''}
            <a style="position: relative; display: block; margin-bottom: 30px; background-color: #EEE; font-size: 40px; text-decoration: none; overflow: hidden;" onclick="login:focus:token">
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
    </div>
  `;
};

module.exports = {
  getLoginSrc,
};
