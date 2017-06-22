const {
  WIDTH,
  HEIGHT,
} = require('../constants/menu');
const homeImg = require('../img/home');
const homeImgSrc = 'data:image/svg+xml;base64,' + btoa(homeImg);

const makeRenderer = ({creatureUtils}) => {

const getStatusSrc = ({status: {url, username, name, users, authToken}}) => {
  const allUsers = [username].concat(users).sort((a, b) => a.localeCompare(b));

  return `\
    <div style="display: flex; padding: 0 30px;">
      <div style="margin-right: auto;">
        <h1 style="margin: 15px 0; font-size: 40px; font-weight: 400;">My profile</h1>
        <div style="display: flex; font-size: 30px; line-height: 1; justify-content: center; align-items: center;">
          <div style="display: inline-flex; margin-right: auto; justify-content: center; align-items: center;">
            ${creatureUtils.makeSvgCreature('user:' + username, {
              width: 12,
              height: 12,
              viewBox: '0 0 12 12',
              style: 'width: 40px; height: 40px; margin: 10px; image-rendering: -moz-crisp-edges; image-rendering: pixelated;',
            })}
            <span>${username}</span>
          </div>
        </div>
        <h1 style="margin: 15px 0; font-size: 40px; font-weight: 400;">Server status</h1>
        <div style="display: flex; justify-content: center; align-items: center;">
          <div style="display: flex; position: relative; margin-left: -30px; margin-right: auto; padding: 10px 30px; background-color: #000; font-size: 30px; font-weight: 400; color: #FFF; justify-content: center; align-items: center;">
            ${creatureUtils.makeSvgCreature('server:' + name, {
              width: 12,
              height: 12,
              viewBox: '0 0 12 12',
              style: 'width: 40px; height: 40px; margin-right: 20px; image-rendering: -moz-crisp-edges; image-rendering: pixelated;',
            })}
            <span style="margin-right: auto;">${name}</span>
          </div>
        </div>
        <h1 style="margin: 15px 0; font-size: 40px; font-weight: 400;">Online (${allUsers.length})</h1>
        <div style="display: flex;">
          ${allUsers.map(user => `\
            <div style="display: flex; margin-bottom: 5px; font-size: 30px; line-height: 1; align-items: center;">
              ${creatureUtils.makeSvgCreature('user:' + user, {
                width: 12,
                height: 12,
                viewBox: '0 0 12 12',
                style: 'width: 40px; height: 40px; margin-right: 20px; image-rendering: -moz-crisp-edges; image-rendering: pixelated;',
              })}
              <div>${user}</div>
            </div>
          `).join('\n')}
        </div>
      </div>
      <div style="width: 400px;">
        <h1 style="margin: 15px 0; font-size: 40px; font-weight: 400;">Access token</h1>
        <div style="margin-bottom: 10px; font-size: 20px; font-weight: 400;">Share this token to allow others to log in. Click to copy to clipboard.</div>
        <a style="display: block; margin-bottom: 10px; font-size: 30px; font-weight: 400; color: #2196F3; text-decoration: none; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;" onclick="status:token">${url}${authToken ? ('?t=' + authToken) : ''}</a>
        <h1 style="margin: 15px 0; font-size: 40px; font-weight: 400;">Links</h1>
      </div>
    </div>
  `;
};

const getNavbarSrc = ({tab}) => {
  const focusedContent = label => `\
    <div style="position: absolute; top: 0; left: 0; border-width: 50px 25px 0 0; border-style: solid; border-color: transparent #FFF transparent transparent;"></div>
    <div style="position: absolute; top: 0; right: 0; border-width: 50px 0 0 25px; border-style: solid; border-color: transparent transparent transparent #FFF;"></div>
    <div style="display: flex; position: relative; width: 110px; background-color: #FFF; justify-content: center; align-items: center;">${label}</div>
  `;
  const unfocusedContent = label => `\
    <div style="position: absolute; top: 0; left: 0; border-width: 50px 25px 0 0; border-style: solid; border-color: transparent #EEE transparent transparent;"></div>
    <div style="position: absolute; top: 0; right: 0; border-width: 50px 0 0 25px; border-style: solid; border-color: transparent transparent transparent #EEE;"></div>
    <div style="display: flex; position: relative; width: 110px; background-color: #EEE; justify-content: center; align-items: center;">${label}</div>
  `;
  const tabContent = (tabName, tabLabel, first) => `\
    <a style="display: flex; position: relative; width: 160px; height: 100%; ${first ? '' : 'margin-left: -25px;'} justify-content: center; align-items: stretch; font-size: 20px; text-decoration: none; ${tab === tabName ? 'z-index: 1;' : ''}" onclick="navbar:${tabName}">
      ${tab === tabName ? focusedContent(tabLabel) : unfocusedContent(tabLabel)}
    </a>
  `;

  return `\
    <div style="display: flex; width: 1024px; height: 50px; background-color: #CCC;">
      ${[
        tabContent('status', 'Status', true),
        tabContent('world', 'Mods', false),
        tabContent('entity', 'Entities', false),
        tabContent('file', 'Files', false),
        tabContent('servers', 'Servers', false),
        tabContent('wallet', 'Wallet', false),
        tabContent('options', 'Options', false)
      ].join('\n')}
      </a>
    </div>
  `;
};

return {
  getStatusSrc,
  getNavbarSrc,
};

};

module.exports = {
  makeRenderer,
};
