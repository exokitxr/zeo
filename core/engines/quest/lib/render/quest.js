const timeago = require('time-ago')();
const {
  HEIGHT,
} = require('../constants/quest');
const karmaIcon = require('../img/karma-white');
const karmaIconSrc = 'data:image/svg+xml;base64,' + btoa(karmaIcon);

const makeRenderer = ({creatureUtils}) => {

const getIncomingQuestsSrc = () => `\
  <div style="padding: 20px">
    <h1 style="margin: 0; margin-bottom: 10px; font-size: 30px; font-weight: 400;">Incoming quests</h1>
    <div style="font-size: 20px; color: #CCC; justify-content: center; align-items: center;">&lt;None&gt;</div>
  </div>
`;

const getOutgoingQuestsSrc = () => `\
  <div style="padding: 20px">
    <h1 style="margin: 0; margin-bottom: 10px; font-size: 30px; font-weight: 400;">Outgoing quests</h1>
    <div style="font-size: 20px; color: #CCC; justify-content: center; align-items: center;">&lt;None&gt;</div>
  </div>
`;

const getAvailableQuestsSrc = () => `\
 <div style="min-height: ${HEIGHT}px; padding: 20px; background-color: #000; font-size: 30px; line-height: 1.4;">
    <div style="position: relative; color: #FFF;">Available quests</div>
  </div> 
`;

const getQuestSrc = ({id, name, author, created}) => `\
  <div style="background-color: #FFF;">
    <div style="padding-left: 30px; background-color: #000; color: #FFF; font-size: 40px; line-height: 80px;">
      <div style="display: inline-flex; width: 300px; float: right; background: #4CAF50; color: #FFF; font-size: 30px; justify-content: center; align-items: center; box-sizing: border-box; box-sizing: border-box;">
        <img src="${karmaIconSrc}" width=34 height=34 style="margin-right: 10px;"> 350
      </div>
      <div>${name}</div>
    </div>
    <div style="padding: 5px 10px;">
      <div style="display: inline-flex; padding: 10px 20px; background-color: #EEE; border-radius: 100px; margin-bottom: 20px; font-size: ${30 / 1.4}px; line-height: 1.4;">
        <img src="${creatureUtils.makeStaticCreature('user:' + author)}" width="30" height="30" style="margin-right: 10px; image-rendering: pixelated;" />
        <div>
          <span style="font-weight: 400;">${author}</span>
          <span>posted</span>
          <span style="font-weight: 400;">${timeago.ago(created)}</span>
        </div>
      </div>
    </div>
  </div>
`;

return  {
  getIncomingQuestsSrc,
  getOutgoingQuestsSrc,
  getAvailableQuestsSrc,
  getQuestSrc,
};

};

module.exports = {
  makeRenderer,
};
