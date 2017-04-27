const {
  WIDTH,
  HEIGHT,
} = require('../constants/menu');
const homeImg = require('../img/home');
const homeImgSrc = 'data:image/svg+xml;base64,' + btoa(homeImg);

const makeRenderer = ({creatureUtils}) => {

const getStatusSrc = ({status: {url, username, worldname, users, authToken, flags}}) => {
  if (flags.server) {
    const allUsers = [username].concat(users).sort((a, b) => a.localeCompare(b));

    return `\
      <div style="display: flex; padding: 0 30px;">
        <div style="margin-right: auto;">
          <h1 style="margin: 15px 0; font-size: 40px; font-weight: 400;">My profile</h1>
          <div style="display: flex; font-size: 30px; line-height: 1; justify-content: center; align-items: center;">
            <div style="display: inline-flex; margin-right: auto; justify-content: center; align-items: center;">
              <img src="${creatureUtils.makeStaticCreature('user:' + username)}" width="40" height="40" style="margin-right: 10px; image-rendering: pixelated;" />
              <span>${username}</span>
            </div>
          </div>
          <h1 style="margin: 15px 0; font-size: 40px; font-weight: 400;">Server status</h1>
          <div style="display: flex; justify-content: center; align-items: center;">
            <div style="display: flex; position: relative; margin-left: -30px; margin-right: auto; padding: 10px 30px; background-color: #000; font-size: 30px; font-weight: 400; color: #FFF; justify-content: center; align-items: center;">
              <img src="${creatureUtils.makeStaticCreature('server:' + worldname)}" width="40" height="40" style="margin-right: 20px; image-rendering: -moz-crisp-edges; image-rendering: pixelated;" />
              <span style="margin-right: auto;">${worldname}</span>
            </div>
          </div>
          <h1 style="margin: 15px 0; font-size: 40px; font-weight: 400;">Online (${allUsers.length})</h1>
          <div style="display: flex;">
            ${allUsers.map(user => `\
              <div style="display: flex; margin-bottom: 5px; font-size: 30px; line-height: 1; align-items: center;">
                <img src="${creatureUtils.makeStaticCreature('user:' + user)}" width="40" height="40" style="margin-right: 20px; image-rendering: pixelated;" />
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
          ${flags.hub ? `<a style="display: flex; padding: 0 10px; font-size: 24px; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="status:backToHub">
            <img src="${homeImgSrc}" width="40" height="40" style="margin-right: 10px;" />
            <span style="font-weight: 400;">Zeo VR Home</span>
          </a>` : ''}
        </div>
      </div>
    `;
  } else {
    return `<div style="display: flex; width: ${WIDTH}px; height: ${HEIGHT}px; flex-direction: column; justify-content: center; align-items: center;">
      <div style="display: flex; margin: auto 0; flex-direction: column; justify-content: center; align-items: center;">
        <div style="margin-bottom: 20px; font-size: 50px;">Demo world</div>
        <div style="font-size: 24px;">This is an unsaved singleplayer world.</div>
        <div style="font-size: 24px;">Connect to a multiplayer world in the <a style="display: inline-block; font-weight: 400; text-decoration: none;" onclick="status:servers">Servers</a> tab.</div>
      </div>
    </div>`;
  }
};

const getNavbarSrc = ({tab}) => {
  const focusedContent = label => `\
    <div style="position: absolute; top: 0; left: 0; border-width: 50px 25px 0 0; border-style: solid; border-color: transparent #FFF transparent transparent;"></div>
    <div style="position: absolute; top: 0; right: 0; border-width: 50px 0 0 25px; border-style: solid; border-color: transparent transparent transparent #FFF;"></div>
    <div style="display: flex; position: relative; width: 120px; background-color: #FFF; justify-content: center; align-items: center;">${label}</div>
  `;
  const unfocusedContent = label => `\
    <div style="position: absolute; top: 0; left: 0; border-width: 50px 25px 0 0; border-style: solid; border-color: transparent #EEE transparent transparent;"></div>
    <div style="position: absolute; top: 0; right: 0; border-width: 50px 0 0 25px; border-style: solid; border-color: transparent transparent transparent #EEE;"></div>
    <div style="display: flex; position: relative; width: 120px; background-color: #EEE; justify-content: center; align-items: center;">${label}</div>
  `;

  return `\
    <div style="display: flex; width: 1024px; height: 50px; background-color: #CCC;">
      <a style="display: flex; position: relative; width: 170px; height: 100%; justify-content: center; align-items: stretch; font-size: 20px; text-decoration: none; ${tab === 'status' ? 'z-index: 1;' : ''}" onclick="navbar:status">
        ${tab === 'status' ? focusedContent('Status') : unfocusedContent('Status')}
      </a>
      <a style="display: flex; position: relative; width: 170px; height: 100%; margin-left: -25px; justify-content: center; align-items: stretch; font-size: 20px; text-decoration: none; box-sizing: border-box; ${tab === 'world' ? 'z-index: 1;' : ''}" onclick="navbar:world">
        ${tab === 'world' ? focusedContent('World') : unfocusedContent('World')}
      </a>
      <a style="display: flex; position: relative; width: 170px; height: 100%; margin-left: -25px; justify-content: center; align-items: stretch; font-size: 20px; text-decoration: none; box-sizing: border-box; ${tab === 'servers' ? 'z-index: 1;' : ''}" onclick="navbar:servers">
        ${tab === 'servers' ? focusedContent('Servers') : unfocusedContent('Servers')}
      </a>
      <a style="display: flex; position: relative; width: 170px; height: 100%; margin-left: -25px; justify-content: center; align-items: stretch; font-size: 20px; text-decoration: none; box-sizing: border-box; ${tab === 'options' ? 'z-index: 1;' : ''}" onclick="navbar:options">
        ${tab === 'options' ? focusedContent('Options') : unfocusedContent('Options')}
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
