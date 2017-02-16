const timeago = require('time-ago')();
const {
  HEIGHT,
  QUEST_HEIGHT,
} = require('../constants/quest');
const karmaBlackIcon = require('../img/karma');
const karmaBlackIconSrc = 'data:image/svg+xml;base64,' + btoa(karmaBlackIcon);
const karmaWhiteIcon = require('../img/karma-white');
const karmaWhiteIconSrc = 'data:image/svg+xml;base64,' + btoa(karmaWhiteIcon);

const makeRenderer = ({creatureUtils}) => {

const getMailPageSrc = ({page}) => {
  switch (page) {
    case 'threads':
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
            <a style="display: flex; margin-right: 10px; padding: 5px 15px; ${_getSelectedStyle(page === 'threads')}; border-radius: 100px; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="mail:threads">All Threads</a>
            <a style="display: flex; padding: 5px 15px; ${_getSelectedStyle(page === 'notifications')}; border-radius: 100px; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="mail:notifications">
              <span style="margin-right: 10px;">Notifications</span>
              <span style="display: flex; padding: 0 7px; background-color: #808080; border-radius: 100px; border-radius: 100px; color: #FFF; font-size: 14px; line-height: 1.4; font-weight: 400; justify-content: center; align-items: center;">3</span>
            </a>
          </div>
          <a style="display: block; padding: 5px 15px; border: 1px solid #333; border-radius: 100px; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="mail:newThread">+ New Thread</a>
        </div>
      `;
    })();
    const threadsSrc = (() => {
      const _getThreadSrc = index => {
        const author = _makeId();
        const created = Date.now() - (60 * 2 * 1000);

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
    <div style="display: flex; font-size: 30px; line-height: 1.4;">
      ${leftSrc}
      ${rightSrc}
    </div>
  `;
};

const getThreadPageSrc = () => {
  const leftSrc = (() => `\
    <div style="display: flex; padding: 20px 30px; flex-grow: 1; flex-direction: column;">
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
  const leftSrc = (() => `\
    <div style="display: flex; padding: 20px 30px; flex-grow: 1; flex-direction: column;">
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

const getThreadSidebarSrc = () => {
  const searchSrc = (() => {
    const inputText = '';
    const inputValue = 0;
    const inputPlaceholder = 'Search threads';
    const focus = false;

    return `\
      <a style="position: relative; display: block; margin-bottom: 20px; background-color: #FFF; text-decoration: none;" onclick="mail:focus">
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

const getQuestSrc = ({id, name, author, created}) => `\
  <div style="min-height: ${QUEST_HEIGHT}px; background-color: #FFF;">
    <div style="padding-left: 30px; background-color: #000; color: #FFF; font-size: 40px; line-height: 80px;">
      <div style="display: inline-flex; width: 300px; float: right; background: #4CAF50; color: #FFF; font-size: 30px; justify-content: center; align-items: center; box-sizing: border-box; box-sizing: border-box;">
        <img src="${karmaWhiteIconSrc}" width=34 height=34 style="margin-right: 10px;"> 350
      </div>
      <div>${name}</div>
    </div>
    <div style="padding: 5px 10px;">
      <div style="display: inline-flex; padding: 7px 20px; background-color: #EEE; border-radius: 100px; margin-bottom: 20px; font-size: ${30 / 1.4}px; line-height: 1.4;">
        <img src="${creatureUtils.makeStaticCreature('user:' + author)}" width="30" height="30" style="margin-right: 10px; image-rendering: pixelated;" />
        <div>
          <span style="font-weight: 400;">${author}</span>
          <span>posted</span>
          <span style="font-weight: 400;">${timeago.ago(created)}</span>
        </div>
      </div>
    </div>
    <div style="display: flex; margin-bottom: 10px; padding: 0 10px; justify-content: space-between;">
      <a style="display: flex; padding: 7px 20px; border: 1px solid #333; border-radius: 100px; font-size: 24px; font-weight: 400; line-height: 1.4; text-decoration: none; justify-content: center; align-items: center;" onclick="quest:setPosition">Set position</a>
      <div style="display: flex; border: 1px solid #333; border-radius: 100px; font-size: 24px; font-weight: 400; line-height: 1.4; justify-content: center; align-items: center;">
         <a style="padding: 7px 20px; text-decoration: none;" onclick="quest:time:minus">-</a>
         <div style="display: flex; padding: 7px 20px; border-width: 0 1px 0 1px; border-style: solid; border-color: #333; justify-content: center; align-items: center;">
           0:00:00
         </div style="padding: 7px 20px;">
         <a style="padding: 7px 20px; text-decoration: none;" onclick="quest:time:plus">+</a>
      </div>
      <div style="display: flex; border: 1px solid #333; border-radius: 100px; font-size: 24px; font-weight: 400; line-height: 1.4; justify-content: center; align-items: center;">
         <a style="padding: 7px 20px; text-decoration: none;" onclick="quest:karma:minus">-</a>
         <div style="display: flex; padding: 7px 20px; border-width: 0 1px 0 1px; border-style: solid; border-color: #333; justify-content: center; align-items: center;">
           <img src="${karmaBlackIconSrc}" width=20 height=20 style="margin-right: 10px; width: 34px; height: 34px;"> 0
          </div>
         <a style="padding: 7px 20px; text-decoration: none;" onclick="quest:karma:plus">+</a>
      </div>
      <a style="display: flex; padding: 7px 20px; border: 1px solid #333; border-radius: 100px; font-size: 24px; font-weight: 400; line-height: 1.4; text-decoration: none; justify-content: center; align-items: center;" onclick="quest:cancel">Cancel</a>
    </div>
  </div>
`;

return  {
  getMailPageSrc,
  getThreadsPageSrc,
  getQuestSrc,
};

};

const _makeId = () => Math.random().toString(36).substring(7);

module.exports = {
  makeRenderer,
};
