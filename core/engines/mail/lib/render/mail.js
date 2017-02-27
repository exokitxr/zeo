const timeago = require('time-ago')();
const {
  WIDTH,
  HEIGHT,
  MAIL_HEIGHT,
} = require('../constants/mail');
const karmaBlackIcon = require('../img/karma');
const karmaBlackIconSrc = 'data:image/svg+xml;base64,' + btoa(karmaBlackIcon);
const karmaWhiteIcon = require('../img/karma-white');
const karmaWhiteIconSrc = 'data:image/svg+xml;base64,' + btoa(karmaWhiteIcon);

const makeRenderer = ({creatureUtils}) => {

const getMailPageSrc = ({page}) => {
  switch (page) {
    case 'threads':
    case 'users':
    case 'notifications':
      return getThreadsPageSrc({page});
    case 'thread':
      return getThreadPageSrc();
    case 'newThread':
      return getNewThreadPageSrc();
    default:
      return '';
  }
};

const getThreadsPageSrc = ({page}) => {
  const leftSrc = (() => {
    const headerSrc = (() => {
      const _getSelectedStyle = selected => {
        if (selected) {
          return 'background-color: #000; border: 1px solid transparent; color: #FFF;';
        } else {
          return 'border: 1px solid #333;';
        }
      };

      return `\
        <div style="display: flex; margin-bottom: 20px; font-size: 16px; line-height: 1.4;">
          <div style="display: flex; flex-grow: 1;">
            <a style="display: flex; margin-right: 10px; padding: 5px 15px; ${_getSelectedStyle(page === 'threads')}; border-radius: 100px; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="mail:threads">Threads</a>
            <a style="display: flex; margin-right: 10px; padding: 5px 15px; ${_getSelectedStyle(page === 'users')}; border-radius: 100px; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="mail:users">Users</a>
            <a style="display: flex; padding: 5px 15px; ${_getSelectedStyle(page === 'notifications')}; border-radius: 100px; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="mail:notifications">
              <span style="margin-right: 10px;">Notifications</span>
              <span style="display: flex; padding: 0 7px; background-color: #808080; border-radius: 100px; border-radius: 100px; color: #FFF; font-size: 14px; line-height: 1.4; font-weight: 400; justify-content: center; align-items: center;">3</span>
            </a>
          </div>
          <a style="display: block; padding: 5px 15px; border: 1px solid #333; border-radius: 100px; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="mail:newThread">+ New thread</a>
        </div>
      `;
    })();
    const threadsSrc = (() => {
      const _getThreadSrc = index => {
        const author = _makeId();
        const created = Date.now() - Math.floor((Math.random() * 60 * 24) * 60 * 1000);

        return `\
          <a style="position: relative; display: flex; margin-bottom: 10px; background-color: #EEE; font-size: 16px; line-height: 1.4; text-decoration: none; flex-direction: column;" onclick="mail:thread:${index}">
            <div style="position: absolute; display: flex; top: 0; right: 0; color: #FFF; font-weight: 400;">
              <div style="display: flex; width: 50px; padding: 5px; background-color: #2196F3; justify-content: center; align-items: center; box-sizing: border-box; ${Math.random() < 0.5 ? '' : 'visibility: hidden;'}">${Math.floor(Math.random() * 10)} rep</div>
              <div style="display: flex; width: 50px; padding: 5px; background-color: #E91E63; justify-content: center; align-items: center; $box-sizing: border-box; {Math.random() < 0.5 ? '' : 'visibility: hidden;'}">Pos</div>
              <div style="display: flex; width: 50px; padding: 5px; background-color: #673AB7; justify-content: center; align-items: center; box-sizing: border-box; ${Math.random() < 0.5 ? '' : 'visibility: hidden;'}">Att </div>
            </div>
            <div style="padding: 5px 0;">
              <div style="padding: 0 20px; font-weight: 400;">This is a thread title</div>
              <div style="display: flex; padding: 0 20px; align-items: center;">
                <img src="${creatureUtils.makeStaticCreature('user:' + author)}" width="24" height="24" style="margin-right: 5px; image-rendering: pixelated;" />
                <div>${author} posted ${timeago.ago(created)}</div>
              </div>
            </div>
          </a>
        `;
      };

      let result = '';
      for (let i = 0; i < 10; i++) {
        result += _getThreadSrc(i);
      }
      return result;
    })();

    return `\
      <div style="display: flex; padding: 20px 30px; flex-grow: 1; flex-direction: column;">
        ${headerSrc}
        ${threadsSrc}
      </div>
    `;
  })();
  const rightSrc = getThreadSidebarSrc();

  return `\
    <div style="display: flex; width: ${WIDTH}px; font-size: 30px; line-height: 1.4;">
      ${leftSrc}
      ${rightSrc}
    </div>
  `;
};

const getThreadPageSrc = () => {
  const leftSrc = (() => `\
    <div style="display: flex; padding: 20px 30px; margin-bottom: auto; flex-grow: 1; flex-direction: column;">
      <div style="display: flex; margin-bottom: 20px; font-size: 16px; line-height: 1.4;">
        <a style="display: block; padding: 5px 15px; border: 1px solid #333; border-radius: 100px; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="mail:threads">< Back</a>
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

const getNewThreadPageSrc = () => {
  const leftSrc = (() => {
    const headerSrc = `\
      <div style="margin-bottom: 10px; font-size: 24px;">New thread</div>
    `;
    const titleSrc = (() => {
      const inputText = '';
      const inputValue = 0;
      const inputPlaceholder = 'Add post title';
      const focus = false;

      return `\
        <a style="position: relative; display: block; margin-bottom: 20px; background-color: #EEE; border-radius: 5px; font-size: 24px; text-decoration: none;" onclick="mail:focus:title">
          ${focus ? `<div style="position: absolute; width: 2px; top: 2px; bottom: 2px; left: ${inputValue}px; background-color: #333;"></div>` : ''}
          <div>${inputText}</div>
          ${!inputText ? `<div style="color: #AAA;">${inputPlaceholder}</div>` : ''}
        </a>
      `;
    })();
    const messageSrc = (() => {
      const inputText = '';
      const inputValue = 0;
      const inputPlaceholder = 'Write a message';
      const focus = false;

      return `\
        <a style="position: relative; display: block; height: 100px; margin-bottom: 20px; background-color: #EEE; border-radius: 5px; font-size: 16px; text-decoration: none;" onclick="mail:focus:message">
          ${focus ? `<div style="position: absolute; width: 2px; top: 2px; bottom: 2px; left: ${inputValue}px; background-color: #333;"></div>` : ''}
          <div>${inputText}</div>
          ${!inputText ? `<div style="color: #AAA;">${inputPlaceholder}</div>` : ''}
        </a>
      `;
    })();
    const buttonsSrc = `\
      <div style="display: flex; flex-grow: 1; font-size: 16px; line-height: 1.4;">
        <a style="display: block; padding: 5px 15px; margin-right: 10px; border: 1px solid #333; border-radius: 100px; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="mail:postThread">Post</a>
        <a style="display: block; padding: 5px 15px; border: 1px solid #333; border-radius: 100px; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="mail:threads">Cancel</a>
      </div>
    `;

    return `\
      <div style="display: flex; padding: 20px 30px; margin-bottom: auto; flex-grow: 1; flex-direction: column;">
        ${headerSrc}
        ${titleSrc}
        ${messageSrc}
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
    const inputPlaceholder = 'Search threads';
    const focus = false;

    return `\
      <a style="position: relative; display: block; margin-bottom: 20px; background-color: #FFF; text-decoration: none;" onclick="mail:focus:search">
        ${focus ? `<div style="position: absolute; width: 2px; top: 2px; bottom: 2px; left: ${inputValue}px; background-color: #333;"></div>` : ''}
        <div>${inputText}</div>
        ${!inputText ? `<div style="color: #AAA;">${inputPlaceholder}</div>` : ''}
      </a>
    `;
  })();

  return `\
    <div style="width: 300px; min-height: ${HEIGHT}px; padding: 20px 30px; background-color: #000; color: #FFF; box-sizing: border-box;">
      ${searchSrc}
    </div>
  `;
};

return  {
  getMailPageSrc,
  getThreadsPageSrc,
};

};

const _makeId = () => Math.random().toString(36).substring(7);

module.exports = {
  makeRenderer,
};
