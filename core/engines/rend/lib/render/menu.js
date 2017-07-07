const {
  WIDTH,
  HEIGHT,
} = require('../constants/menu');

const makeRenderer = ({creatureUtils}) => {

const getStatusSrc = ({status: {state, url, address, port, name, username, users}}) => {
  const allUsers = [username].concat(users).sort((a, b) => a.localeCompare(b));
  const stateColor = (() => {
    switch (state) {
      case 'connecting': return '#CCC';
      case 'connected': return '#4CAF50';
      case 'disconnected': return '#F44336';
      case 'firewalled': return '#FF9800';
      case 'private': return '#2196F3';
      default: return '#000';
    }
  })();

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
        <h1 style="display: flex; margin-top: 20px; margin-bottom: 10px; font-size: 40px; font-weight: 400; align-items: center;">
          <div style="width: 20px; height: 20px; margin-right: 20px; background-color: ${stateColor}; border-radius: 100px;"></div>
          <span>${_capitalize(state)}</span>
        </h1>
        ${state === 'firewalled' ? `<div style="margin-bottom: 10px; font-size: 24px; font-weight: 400;">Others might not be able to join. Make sure to open port <b>${port}</b> for address <b>${address}</b> on your router.</div>` : ''}
        <a style="display: inline-block; margin-bottom: 10px; font-size: 30px; line-height: 1.6; font-weight: 400; color: #2196F3; text-decoration: none; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;" onclick="status:url">${url}</a>
        <div style="margin-bottom: 20px; font-size: 24px; font-weight: 400;">Share this link. Click to copy.</div>
        <div style="display: flex;">
          <a style="margin-right: 20px; border: 2px solid; padding: 7px 20px; font-size: 24px; font-weight: 400; line-height: 1.4;" onclick="status:saveWorld">Save world</a>
          <a style="border: 2px solid; padding: 7px 20px; font-size: 24px; font-weight: 400; line-height: 1.4;" onclick="status:clearWorld">Clear world</a>
        </div>
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

const _capitalize = s => s.length > 0 ? (s[0].toUpperCase() + s.slice(1)) : '';

return {
  getStatusSrc,
  getNavbarSrc,
};

};

module.exports = {
  makeRenderer,
};
