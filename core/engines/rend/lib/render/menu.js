const karmaIcon = require('../img/karma');
const karmaIconSrc = 'data:image/svg+xml;base64,' + btoa(karmaIcon);

const landImg = require('../img/land');
const landImgSrc = 'data:image/svg+xml;base64,' + btoa(landImg);

const landIconImg = require('../img/land-icon');
const landIconImgSrc = 'data:image/svg+xml;base64,' + btoa(landIconImg);

const tagImg = require('../img/tag-white');
const tagImgSrc = 'data:image/svg+xml;base64,' + btoa(tagImg);

const fileImg = require('../img/file-white');
const fileImgSrc = 'data:image/svg+xml;base64,' + btoa(fileImg);

const menuUtils = require('../utils/menu');

const makeRenderer = ({creatureUtils}) => {

const {
  WIDTH,
  HEIGHT,
} = require('../constants/menu');

const getStatusSrc = ({status: {username, accountType, karma, incomingMails, outgoingMails, worldname, users, numTags, numFiles}}) => {
  return `\
    <div style="padding: 30px;">
      <div style="display: flex; margin-bottom: 20px; font-size: 30px; line-height: 1; justify-content: center; align-items: center;">
        <div style="display: inline-flex; margin-right: auto; padding: 5px 20px; background-color: #EEE; border-radius: 100px; justify-content: center; align-items: center;">
          <img src="${creatureUtils.makeStaticCreature('user:' + username)}" width="40" height="40" style="margin-right: 10px; image-rendering: pixelated;" />
          <span>${username}</span>
        </div>
        <div style="display: flex; padding: 5px 0; justify-content: center; align-items: center;">
          <img src="${karmaIconSrc}" width="40" height="40" style="margin-right: 10px;">
          <div>${karma}</div>
        </div>
      </div>
      <div style="display: flex; margin: 0 -30px; margin-bottom: 20px; padding: 30px; background-color: #000; color: #FFF;">
        <div style="margin-right: 20px; width: 100px; height: 100px; background-color: #FFF;"></div>
        <div style="margin-right: 30px;">
          <div style="font-size: 24px;">${worldname}</div>
          <div style="font-size: 24px;">${users.length} Users</div>
        </div>
        <div style="margin-right: auto;">
          ${users.map(user => `\
            <div style="display: flex; margin-bottom: 2px; padding: 2px 10px; background-color: #222; border-radius: 100px; font-size: 13px; line-height: 1; align-items: center;">
              <img src="${creatureUtils.makeStaticCreature('user:' + user)}" width="18" height="18" style="margin-right: 10px; image-rendering: pixelated;" />
              <div>${user}</div>
            </div>
          `).join('\n')}
        </div>
        <div>
          <div style="display: flex; margin-bottom: 5px; font-size: 20px; align-items: center;">
            <img src="${tagImgSrc}" width="28" height="28" style="margin-right: 10px;">
            <div>${numTags} Tags</div>
          </div>
          <div style="display: flex; margin-bottom: 5px; font-size: 20px; align-items: center;">
            <img src="${fileImgSrc}" width="28" height="28" style="margin-right: 10px;">
            <div>${numFiles} Files</div>
          </div>
        </div>
      </div>
      <div style="display: flex; margin-bottom: 5px; font-size: 20px; align-items: center;">
        <img src="${landImgSrc}" width="28" height="28" style="margin-right: 10px;">
        <div>${incomingMails} Incoming mails</div>
      </div>
      <div style="display: flex; margin-bottom: 5px; font-size: 20px; align-items: center;">
        <img src="${landIconImgSrc}" width="28" height="28" style="margin-right: 10px;">
        <div>${outgoingMails} Outgoing mail</div>
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
      <a style="display: flex; position: relative; width: 170px; height: 100%; margin-left: -25px; justify-content: center; align-items: stretch; font-size: 20px; text-decoration: none; box-sizing: border-box; ${tab === 'equipment' ? 'z-index: 1;' : ''}" onclick="navbar:equipment">
        ${tab === 'equipment' ? focusedContent('Equipment') : unfocusedContent('Equipment')}
      </a>
      <a style="display: flex; position: relative; width: 170px; height: 100%; margin-left: -25px; justify-content: center; align-items: stretch; font-size: 20px; text-decoration: none; box-sizing: border-box; ${tab === 'mail' ? 'z-index: 1;' : ''}" onclick="navbar:mail">
        ${tab === 'mail' ? focusedContent('Mail') : unfocusedContent('Mail')}
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
