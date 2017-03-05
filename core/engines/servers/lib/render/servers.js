const prettyms = require('pretty-ms');
const {
  WIDTH,
  HEIGHT,
} = require('../constants/servers');
const karmaBlackIcon = require('../img/karma');
const karmaBlackIconSrc = 'data:image/svg+xml;base64,' + btoa(karmaBlackIcon);
const karmaWhiteIcon = require('../img/karma-white');
const karmaWhiteIconSrc = 'data:image/svg+xml;base64,' + btoa(karmaWhiteIcon);

const pulseBlackIcon = require('../img/pulse');
const pulseBlackIconSrc = 'data:image/svg+xml;base64,' + btoa(pulseBlackIcon);
const pulseWhiteIcon = require('../img/pulse-white');
const pulseWhiteIconSrc = 'data:image/svg+xml;base64,' + btoa(pulseWhiteIcon);

const makeRenderer = ({creatureUtils}) => {

const getServersPageSrc = ({page, servers, currentServerUrl}) => {
  switch (page) {
    case 'list':
      return getListPageSrc({page, servers, currentServerUrl});
    case 'server':
      return getServerPageSrc();
    case 'newServer':
      return getNewServerPageSrc();
    default:
      return '';
  }
};

const getListPageSrc = ({page, servers, currentServerUrl}) => {
  const leftSrc = (() => {
    const headerSrc = (() => {
      return `\
        <div style="display: flex; margin-bottom: 20px; font-size: 16px; line-height: 1.4;">
          <div style="display: flex; flex-grow: 1;">
            <a style="display: flex; margin-right: 10px; padding: 5px 15px; background-color: #000; border: 1px solid transparent; color: #FFF;; border-radius: 100px; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="servers:list">Servers</a>
          </div>
          <a style="display: block; padding: 5px 15px; border: 1px solid #333; border-radius: 100px; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="servers:newServer">+ New server</a>
        </div>
      `;
    })();
    const serversSrc = (() => {
      const _getServerSrc = server => {
        const {username, worldname, url, users} = server;
        const fullWorldname = username + '/' + worldname;
        const ping = Math.floor(Math.random() * 1000); // XXX actually compute this
        const selected = url === currentServerUrl;

        const _getSelectedStyle = selected => {
          if (selected) {
            return 'background-color: #000; border: 1px solid transparent; color: #FFF;';
          } else {
            return 'background-color: #FFF; border: 1px solid #EEE;';
          }
        };

        return `\
          <div style="display: flex; height: 100px; margin-bottom: 10px; ${_getSelectedStyle(selected)}; box-sizing: border-box;">
            ${!selected ?
              `<a style="display: flex; width: 100px; height: 100px; margin: -1px 0 -1px -1px; background-color: #FFF; color: #000; font-size: 13px; text-decoration: none; justify-content: center; align-items: center;" onclick="servers:connect:${url}">
                <div style="padding: 5px 15px; border: 1px solid #333; border-radius: 100px;">Connect</div>
              </a>`
            :
              `<a style="display: flex; width: 100px; height: 100px; margin: -1px 0 -1px -1px; background-color: #FFF; color: #000; font-size: 13px; text-decoration: none; justify-content: center; align-items: center;" onclick="servers:disconnect">
                <div style="padding: 5px 15px; border: 1px solid #333; border-radius: 100px;">Disconnect</div>
              </a>`
            }
            <div style="display: flex; padding: 5px 20px; flex-grow: 1; flex-direction: column;">
              <div style="display: flex; align-items: center;">
                <div style="margin-right: auto; font-size: 16px; font-weight: 400;">${fullWorldname}</div>
                <div style="display: flex; margin-right: 10px; color: #E91E63; font-size: 13px; font-weight: 400; align-items: center;">Official</div>
                <div style="display: flex; margin-right: 10px; font-size: 13px; align-items: center;">
                  <img src="${!selected ? pulseBlackIconSrc : pulseWhiteIconSrc}" width="18" height="18" style="margin-right: 5px;">
                  <div>${prettyms(ping)}</div>
                </div>
              </div>
              <div style="display: flex; margin-bottom: 5px; font-size: 13px; align-items: center;">${url}</div>
              <div style="display: flex; margin-bottom: 5px;">
                ${users.map(user => `\
                  <div style="display: flex; margin-right: 10px; margin-bottom: 2px; padding: 2px 10px; background-color: ${selected ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}; border-radius: 100px; font-size: 13px; line-height: 1; align-items: center;">
                    <img src="${creatureUtils.makeStaticCreature('user:' + user)}" width="18" height="18" style="margin-right: 10px; image-rendering: pixelated;" />
                    <div>${user}</div>
                  </div>
                `).join('\n')}
              </div>
            </div>
          </div>
        `;
      };

      let result = '';
      for (let i = 0; i < servers.length; i++) {
        const server = servers[i];
        result += _getServerSrc(server);
      }
      return result;
    })();

    return `\
      <div style="display: flex; padding: 20px 30px; flex-grow: 1; flex-direction: column;">
        ${headerSrc}
        ${serversSrc}
      </div>
    `;
  })();
  const rightSrc = getThreadSidebarSrc();

  return `\
    <div style="display: flex; width: ${WIDTH}px; min-height: ${HEIGHT}px; font-size: 30px; line-height: 1.4;">
      ${leftSrc}
      ${rightSrc}
    </div>
  `;
};

const getServerPageSrc = () => {
  const leftSrc = (() => `\
    <div style="display: flex; padding: 20px 30px; margin-bottom: auto; flex-grow: 1; flex-direction: column; justify-content: stretch; align-items: stretch;">
      <div style="display: flex; margin-bottom: 20px; font-size: 16px; line-height: 1.4;">
        <a style="display: block; padding: 5px 15px; border: 1px solid #333; border-radius: 100px; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="servers:list">< Back</a>
      </div>
    </div>
  `)();
  const rightSrc = getThreadSidebarSrc();

  return `\
    <div style="display: flex; font-size: 30px; line-height: 1.4;">
      ${leftSrc}
      ${rightSrc}
    </div>
  `;
};

const getNewServerPageSrc = () => {
  const leftSrc = (() => {
    const headerSrc = `\
      <div style="margin-bottom: 10px; font-size: 24px;">New server</div>
    `;
    const nameSrc = (() => {
      const inputText = '';
      const inputValue = 0;
      const inputPlaceholder = 'Server name';
      const focus = false;

      return `\
        <a style="position: relative; display: block; margin-bottom: 20px; background-color: #EEE; border-radius: 5px; font-size: 24px; text-decoration: none;" onclick="servers:focus:title">
          ${focus ? `<div style="position: absolute; width: 2px; top: 2px; bottom: 2px; left: ${inputValue}px; background-color: #333;"></div>` : ''}
          <div>${inputText}</div>
          ${!inputText ? `<div style="color: #AAA;">${inputPlaceholder}</div>` : ''}
        </a>
      `;
    })();
    const configSrc = (() => {
      return ''; // XXX

      return `\
        <a style="position: relative; display: block; height: 100px; margin-bottom: 20px; background-color: #EEE; border-radius: 5px; font-size: 16px; text-decoration: none;" onclick="servers:focus:message">
          ${focus ? `<div style="position: absolute; width: 2px; top: 2px; bottom: 2px; left: ${inputValue}px; background-color: #333;"></div>` : ''}
          <div>${inputText}</div>
          ${!inputText ? `<div style="color: #AAA;">${inputPlaceholder}</div>` : ''}
        </a>
      `;
    })();
    const buttonsSrc = `\
      <div style="display: flex; flex-grow: 1; font-size: 16px; line-height: 1.4;">
        <a style="display: block; padding: 5px 15px; margin-right: 10px; border: 1px solid #333; border-radius: 100px; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="servers:createServer">Create</a>
        <a style="display: block; padding: 5px 15px; border: 1px solid #333; border-radius: 100px; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="servers:list">Cancel</a>
      </div>
    `;

    return `\
      <div style="display: flex; padding: 20px 30px; margin-bottom: auto; flex-grow: 1; flex-direction: column;">
        ${headerSrc}
        ${nameSrc}
        ${configSrc}
        ${buttonsSrc}
      </div>
    `;
  })();
  const rightSrc = getThreadSidebarSrc();

  return `\
    <div style="display: flex; font-size: 30px; line-height: 1.4;">
      ${leftSrc}
      ${rightSrc}
    </div>
  `;
};

const getThreadSidebarSrc = () => {
  const searchSrc = (() => {
    const inputText = '';
    const inputValue = 0;
    const inputPlaceholder = 'Search servers';
    const focus = false;

    return `\
      <a style="position: relative; display: block; margin-bottom: 20px; background-color: #FFF; text-decoration: none;" onclick="servers:focus:search">
        ${focus ? `<div style="position: absolute; width: 2px; top: 2px; bottom: 2px; left: ${inputValue}px; background-color: #333;"></div>` : ''}
        <div>${inputText}</div>
        ${!inputText ? `<div style="color: #AAA;">${inputPlaceholder}</div>` : ''}
      </a>
    `;
  })();

  return `\
    <div style="width: 300px; padding: 20px 30px; background-color: #000; color: #FFF; box-sizing: border-box;">
      ${searchSrc}
    </div>
  `;
};

return  {
  getServersPageSrc,
};

};

const _makeId = () => Math.random().toString(36).substring(7);

module.exports = {
  makeRenderer,
};
