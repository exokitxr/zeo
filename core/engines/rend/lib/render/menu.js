const {
  WIDTH,
  HEIGHT,
} = require('../constants/menu');

const makeRenderer = ({creatureUtils}) => {

const getStatusSrc = ({status: {username, worldname, users, hasHub, loading}}) => {
  const allUsers = !loading ? [username].concat(users).sort((a, b) => a.localeCompare(b)) : null;

  return `\
    <div style="padding: 30px;">
      <div style="display: flex; margin-bottom: 20px; font-size: 30px; line-height: 1; justify-content: center; align-items: center;">
        <div style="display: inline-flex; margin-right: auto; padding: 5px 20px; background-color: #EEE; border-radius: 100px; justify-content: center; align-items: center; ${!loading ? '' : 'visibility: hidden;'}">
          <img src="${creatureUtils.makeStaticCreature('user:' + username)}" width="40" height="40" style="margin-right: 10px; image-rendering: pixelated;" />
          <span>${username}</span>
        </div>
        <a style="display: flex; height: 46px; margin-right: 20px; padding: 0 20px; border: 1px solid; border-radius: 10px; color: #F44336; font-size: 24px; text-decoration: none; justify-content: center; align-items: center; box-sizing: border-box;" onclick="status:downloadLoginToken">Download token</a>
        <a style="display: flex; height: 46px; padding: 0 20px; border: 1px solid; border-radius: 10px; color: #2196F3; font-size: 24px; text-decoration: none; justify-content: center; align-items: center; box-sizing: border-box;" onclick="status:logOut">Log out</a>
      </div>
      <div style="display: flex; margin: 0 -30px; margin-bottom: 20px; padding: 30px; background-color: #000; color: #FFF;">
        <img src="${creatureUtils.makeStaticCreature('server:' + worldname)}" width="100" height="100" style="margin-right: 20px; image-rendering: -moz-crisp-edges; image-rendering: pixelated;" />
        <div style="margin-right: 30px;">
          <div style="font-size: 24px;">${worldname}</div>
          ${!loading ? `<div style="font-size: 24px;">${allUsers.length} User${allUsers.length !== 1 ? 's' : ''}</div>` : ''}
        </div>
        <div style="margin-right: auto;">
          ${!loading ? allUsers.map(user => `\
            <div style="display: flex; margin-bottom: 2px; padding: 5px 15px; background-color: #222; border-radius: 100px; font-size: 16px; line-height: 1; align-items: center;">
              <img src="${creatureUtils.makeStaticCreature('user:' + user)}" width="26" height="26" style="margin-right: 5px; image-rendering: pixelated;" />
              <div>${user}</div>
            </div>
          `).join('\n') : ''}
        </div>
        <div>
          <a style="display: flex; height: 46px; margin-bottom: 20px; padding: 0 20px; border: 2px solid; border-radius: 10px; color: #66BB6A; font-size: 24px; font-weight: 400; text-decoration: none; justify-content: center; align-items: center; box-sizing: border-box;" onclick="status:snapshotWorld">Snapshot world</a>
          ${hasHub ? `<a style="display: flex; height: 46px; padding: 0 20px; border: 2px solid; border-radius: 10px; color: #9575CD; font-size: 24px; font-weight: 400; text-decoration: none; justify-content: center; align-items: center; box-sizing: border-box;" onclick="status:backToHub">Back to hub</a>` : ''}
        </div>
      </div>
    </div>
  `;
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
      <a style="display: flex; position: relative; width: 170px; height: 100%; margin-left: -25px; justify-content: center; align-items: stretch; font-size: 20px; text-decoration: none; box-sizing: border-box; ${tab === 'worlds' ? 'z-index: 1;' : ''}" onclick="navbar:worlds">
        ${tab === 'worlds' ? focusedContent('Worlds') : unfocusedContent('Worlds')}
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
