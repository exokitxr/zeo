const {
  WIDTH,
  HEIGHT,
} = require('../constants/menu');

const makeRenderer = ({creatureUtils}) => {

const getStatusSrc = ({status: {url, username, name, users}}) => {
  const allUsers = [username].concat(users).sort((a, b) => a.localeCompare(b));

  return `\
    <div style="display: flex; padding: 0 30px;">
      <div style="margin-right: auto;">
        <h1 style="margin: 20px 0; font-size: 40px; font-weight: 400;">${name} (${allUsers.length})</h1>
        ${allUsers.map(user => `\
          <div style="display: flex; margin-bottom: 5px; font-size: 30px; font-weight: 400; line-height: 1; align-items: center;">
            ${creatureUtils.makeSvgCreature('user:' + user, {
              style: 'width: 40px; height: 40px; margin: 10px; margin-right: 20px; image-rendering: -moz-crisp-edges; image-rendering: pixelated;',
            })}
            <div>${user}</div>
            ${user === username ? `<div style="width: 15px; height: 15px; margin-left: 20px; background-color: #CCC; border-radius: 100px;"></div>` : ''}
          </div>
        `).join('\n')}
      </div>
      <div style="width: 400px;">
        <h1 style="display: flex; margin: 20px 0; font-size: 40px; font-weight: 400; align-items: center;">
          <div style="width: 20px; height: 20px; margin-right: 20px; background-color: #4CAF50; border-radius: 100px;"></div>
          <span>Connected</span>
        </h1>
        <!-- <h1 style="margin: 20px 0; font-size: 40px; font-weight: 400;">Actions</h1> -->
        <div style="display: flex;">
          <a style="margin-right: 20px; border: 2px solid; padding: 7px 20px; font-size: 24px; font-weight: 400; line-height: 1.4;" onclick="status:saveWorld">Save world</a>
          <a style="border: 2px solid; padding: 7px 20px; font-size: 24px; font-weight: 400; line-height: 1.4;" onclick="status:clearWorld">Clear world</a>
        </div>
        <!-- <h1 style="margin: 15px 0; font-size: 40px; font-weight: 400;">Access token</h1>
        <div style="margin-bottom: 10px; font-size: 20px; font-weight: 400;">Share this token to allow others to log in. Click to copy to clipboard.</div>
        <a style="display: block; margin-bottom: 10px; font-size: 30px; font-weight: 400; color: #2196F3; text-decoration: none; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;" onclick="status:token">${url}</a> --> 
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
