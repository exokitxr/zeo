const {
  WIDTH,
  HEIGHT,
} = require('../constants/menu');

// const closeBoxImg = require('../img/close-box');
// const closeBoxImgSrc = 'data:image/svg+xml;base64,' + btoa(closeBoxImg);
// const serverPlusImg = require('../img/server-plus');
// const serverPlusImgSrc = 'data:image/svg+xml;base64,' + btoa(serverPlusImg);
const chevronLeftImg = require('../img/chevron-left');
const chevronLeftImgSrc = 'data:image/svg+xml;base64,' + btoa(chevronLeftImg);
// const lanConnectImg = require('../img/lan-connect');
// const lanConnectImgSrc = 'data:image/svg+xml;base64,' + btoa(lanConnectImg);
// const lanDisconnectImg = require('../img/lan-disconnect');
// const lanDisconnectImgSrc = 'data:image/svg+xml;base64,' + btoa(lanDisconnectImg);
// const mouseImg = require('../img/mouse');
// const mouseImgSrc = 'data:image/svg+xml;base64,' + btoa(mouseImg);
const playImg = require('../img/play');
const playImgSrc = 'data:image/svg+xml;base64,' + btoa(playImg);
const upImg = require('../img/up');
const downImg = require('../img/down');

const getHomeMenuSrc = ({page, vrMode, videos}) => {
  const pageSpec = (() => {
    const split = page.split(':');
    const name = split[0];
    const args = split.slice(1);
    return {
      name,
      args,
    };
  })();

  const {name} = pageSpec;
  if (name === 'videos') {
    return getVideosPageSrc(videos);
  } else if (name === 'video') {
    const {args} = pageSpec;
    const pageIndex = parseInt(args[0], 10);

    return getTutorialPageSrc(pageIndex, vrMode);
  } else {
    return '';
  }
};

const getTutorialPageSrc = (pageIndex, vrMode) => {
  const keyboardVrMode = vrMode === null || vrMode === 'keyboard';

  const content = (() => {
    switch (pageIndex) {
      case 0: return `\
        <div style="display: flex; padding: 0 50px; justify-content: center; align-items: center; flex-direction: column; flex-grow: 1;">
          <div style="display: flex; width: 100%; height: 100px; margin-top: auto; justify-content: center; align-items: center;">
            <!-- <div style="width: 200px;"></div>
            <div style="display: flex; flex-grow: 1;">
              <a style="display: flex; width: 90px; height: 100px; justify-content: center; align-items: center;" onclick="tutorial:setPage:1">
                <div style="display: flex; width: 10px; height: 10px; background-color: #000;"></div>
              </a>
              <a style="display: flex; width: 90px; height: 100px; justify-content: center; align-items: center;" onclick="tutorial:setPage:2">
                <div style="display: flex; width: 10px; height: 10px; background-color: #CCC;"></div>
              </a>
              <a style="display: flex; width: 90px; height: 100px; justify-content: center; align-items: center;" onclick="tutorial:setPage:3">
                <div style="display: flex; width: 10px; height: 10px; background-color: #CCC;"></div>
              </a>
              <a style="display: flex; width: 90px; height: 100px; justify-content: center; align-items: center;" onclick="tutorial:setPage:4">
                <div style="display: flex; width: 10px; height: 10px; background-color: #CCC;"></div>
              </a>
              <a style="display: flex; width: 90px; height: 100px; justify-content: center; align-items: center;" onclick="tutorial:setPage:5">
                <div style="display: flex; width: 10px; height: 10px; background-color: #CCC;"></div>
              </a>
            </div>
            <div style="display: flex; width: 100%"> -->
              <a style="display: flex; margin-left: auto; margin-right: 40px; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="home:skipAll">Skip all tutorials</a>
              <a style="display: flex; padding: 10px 15px; border: 2px solid; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="home:next">Next: Modules</a>
            <!-- </div> -->
          </div>
        </div>
      `;
      case 1: return `\
       <div style="display: flex; padding: 0 50px; justify-content: center; align-items: center; flex-direction: column; flex-grow: 1;">
          <div style="display: flex; width: 100%; height: 100px; margin-top: auto; justify-content: center; align-items: center;">
            <!-- <div style="font-size: 30px; font-weight: 400;">Discover your superpowers</div>
            <div style="display: flex;">
              <img src="" width="256" height="128" style="margin: 10px 0; margin-right: 28px;" />
              <img src="" width="256" height="128" style="margin: 10px 0;" />
            </div>
            <div style="width: 540px; margin-bottom: auto; font-size: 15px; font-weight: 400; flex-grow: 1">
              <p>This screen is the <b>MENU</b>. The menu has tools to edit your VR world, move between worlds, and change settings. It's showing you this tutorial.</p>
              <p>To <b>OPEN</b> or <b>CLOSE</b> the menu, press the <b>MENU</b> the <b>PAD${keyboardVrMode ? ' (E key)' : ''}</b> on your controller.</p>
              <p>To <b>TELEPORT</b> around the world, <b>HOLD</b> the <b>PAD${keyboardVrMode ? ' (Q key)' : ''}</b> on to target and <b>RELEASE</b> to go there. Use your finger to adjust how far you'll teleport.</p>
              <p style="margin-bottom: 0; font-size: 18px;">
                <i>
                  <i>To continue, click the <b>NEXT BUTTON</b> with your <b>TRIGGER</b>:</i>
                </i>
              </p>
              </p>
            </div>
            <div style="display: flex; width: 100%;"> -->
              <a style="display: flex; margin-left: auto; margin-right: 40px; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="home:skipAll">Skip all tutorials</a>
              <a style="display: flex; padding: 10px 15px; border: 2px solid; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="home:next">Next: Servers</a>
            <!-- </div> -->
          </div>
        </div>
      `;
      case 2: return `\
        <div style="display: flex; padding: 0 50px; justify-content: center; align-items: center; flex-direction: column; flex-grow: 1;">
          <div style="display: flex; width: 100%; height: 100px; margin-top: auto; justify-content: center; align-items: center;">
            <!-- <div style="font-size: 30px; font-weight: 400;">The cake is real</div>
            <img src="" width="256" height="128" style="margin: 10px 0;" />
            <div style="width: 540px; margin-bottom: auto; font-size: 15px; font-weight: 400; flex-grow: 1">
              <p>In Zeo VR, your world is made up of <i>modules</i>. Modules are objects you can add to the world.</p>
              <p>For example, here is a <b>CAKE MODULE</b>:</p>
              <div style="width: 100px; height: 100px;"></div>
              <p style="margin-bottom: 0; font-size: 18px;">
                <i>
                  To continue, <b>ADD</b> the cake to the world and <b>EAT</b> it.<br/>
                  Grab a slice by holding the <b>GRIP (F key)</b> and move it to your mouth.<br/>
                </i>
              </p>
            </div>
            <div style="display: flex; width: 100%;"> -->
              <a style="display: flex; margin-left: auto; margin-right: 40px; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="home:skipAll">Skip all tutorials</a>
              <a style="display: flex; padding: 10px 15px; border: 2px solid; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="home:next">Next: Multiplayer</a>
            <!-- </div> -->
          </div>
        </div>
      `;
      case 3: return `\
        <div style="display: flex; padding: 0 50px; justify-content: center; align-items: center; flex-direction: column; flex-grow: 1;">
          <div style="display: flex; width: 100%; height: 100px; margin-top: auto; justify-content: center; align-items: center;">
            <!-- <div style="font-size: 30px; font-weight: 400;">It's dangerous to go alone!</div>
            <img src="" width="256" height="128" style="margin: 10px 0;" />
            <div style="width: 540px; margin-bottom: auto; font-size: 15px; font-weight: 400; flex-grow: 1">
              <p>Zeo VR lets you connect to multiplayer world servers.</p>
              <p>Look at the <b>LINK ORBS</b> around you. Each Link Orb is a server you can join. To connect to a server, <b>POINT</b> at it and click your <b>TRIGGER</b>.</p>
              <p>Some servers are <b>LOCKED</b> until you get permission from the owner. Contact info for each server is written above the server, but you can <i>sneak a peek</i> through the orb.</p>
              <p style="margin-bottom: 0; font-size: 18px;">
                <i>
                  To <b>LEARN</b> how to code your own worlds, read the <a onclick="home:apiDocs"><b>API Docs</b></a>.<br/>
                  To <b>HIDE</b> the tutorial, click the <b>NEXT BUTTON</b>.<br/>
                </i>
              </p>
            </div>
            <div style="display: flex; width: 100%;"> -->
              <a style="display: flex; margin-left: auto; margin-right: 40px; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="home:skipAll">Skip all tutorials</a>
              <a style="display: flex; padding: 10px 15px; border: 2px solid; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="home:next">Next: Host your own</a>
            <!-- </div> -->
          </div>
        </div>
      `;
      case 4: return `\
        <div style="display: flex; padding: 0 50px; justify-content: center; align-items: center; flex-direction: column; flex-grow: 1;">
          <div style="display: flex; width: 100%; height: 100px; margin-top: auto; justify-content: center; align-items: center;">
            <!-- <div style="font-size: 30px; font-weight: 400;">It's dangerous to go alone!</div>
            <img src="" width="256" height="128" style="margin: 10px 0;" />
            <div style="width: 540px; margin-bottom: auto; font-size: 15px; font-weight: 400; flex-grow: 1">
              <p>Zeo VR lets you connect to multiplayer world servers.</p>
              <p>Look at the <b>LINK ORBS</b> around you. Each Link Orb is a server you can join. To connect to a server, <b>POINT</b> at it and click your <b>TRIGGER</b>.</p>
              <p>Some servers are <b>LOCKED</b> until you get permission from the owner. Contact info for each server is written above the server, but you can <i>sneak a peek</i> through the orb.</p>
              <p style="margin-bottom: 0; font-size: 18px;">
                <i>
                  To <b>LEARN</b> how to code your own worlds, read the <a onclick="home:apiDocs"><b>API Docs</b></a>.<br/>
                  To <b>HIDE</b> the tutorial, click the <b>NEXT BUTTON</b>.<br/>
                </i>
              </p>
            </div>
            <div style="display: flex; width: 100%;"> -->
            <a style="display: flex; margin-left: auto; margin-right: 40px; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="home:skipAll">Skip all tutorials</a>
  <a style="display: flex; padding: 10px 15px; border: 2px solid; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="home:next">Go to main menu</a>
            <!-- </div> -->
          </div>
        </div>
      `;
      default: return '';
    }
  })();
  const headerText = (() => {
    switch (pageIndex) {
      case 0: return 'Introduction 1: Controls';
      case 1: return 'Introduction 2: Modules';
      case 2: return 'Introduction 3: Multiplayer';
      case 3: return 'Introduction 4: Host your own';
      case 4: return 'Introduction 5: Making modules';
      default: return '';
    }
  })();

  return getHeaderWrappedSrc(content, headerText, {back: true});
};

const getVideosPageSrc = videos => {
  return getHeaderWrappedSrc(`\
    <div style="display: flex; flex-direction: column; flex-grow: 1;">
      <div style="display: flex; margin-bottom: auto; flex-direction: column;">
        ${videos.map((video, index) =>
          `<a style="display: flex; padding: 10px 0; margin: 0 50px; text-decoration: none; align-items: center;" onclick="home:video:${index}">
             <img src="${video.thumbnailImgData}" style="display: block; height: 60px; width: ${60 * 1.5}px; margin-right: 20px;">
             <div style="display: flex; height: 60px; font-size: 24px; font-weight: 400;">${video.name}</div>
          </a>`
        ).join('\n')}
      </div>
      <div style="display: flex; height: 100px; padding: 0 50px; justify-content: center; align-items: center;">
        <a style="display: flex; margin-left: auto; margin-right: 40px; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="home:skipAll">Main menu</a>
        <a style="display: flex; padding: 10px 15px; border: 2px solid; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="home:next">Next: Controls</a>
      </div>
    </div>
  `, 'Introduction videos', {back: true});
};

const getHeaderWrappedSrc = (content, headerText, {back = false} = {}) => `\
  <div style="display: flex; width: ${WIDTH}px; height: ${HEIGHT}px; flex-direction: column;">
    <div style="display: flex; height: 100px; justify-content: center; align-items: center;">
      ${back ?
        `<a style="display: flex; width: 100px; height: 100px; justify-content: center; align-items: center;" onclick="home:back">
          <img src="${chevronLeftImgSrc}" width="80" height="80" />
        </a>`
      :
        `<div style="width: 50px; height: 100px;"></div>`
      }
      <div style="margin-right: auto; font-size: 32px; font-weight: 400;">${headerText}</div>
    </div>
    ${content}
  </div>
`;

const getMediaPlaySrc = ({paused}) => {
  const buttonSrc = (() => {
    if (paused) {
      return `\
        <a style="display: flex; width: 100%; height: ${HEIGHT - 300}px; justify-content: center; align-items: center;" onclick="media:play">
          <img src="${playImgSrc}" width="80" height="80">
        </a>
      `;
    } else  {
      return `\
        <a style="display: flex; width: 100%; height: ${HEIGHT - 300}px; justify-content: center; align-items: center;" onclick="media:pause">
          <div></div>
        </a>
      `;
    }
  })();

  return `<div style="display: flex; width: ${WIDTH}px; height: ${HEIGHT - 300}px; flex-direction: column; box-sizing: border-box;">
    ${buttonSrc}
  </div>`;
};

const getMediaBarSrc = ({value}) => {
  const barSrc = `\
    <a style="display: flex; width: 100%; height: 100px;" onclick="media:seek">
      <svg xmlns="http://www.w3.org/2000/svg" width="1" height="16" viewBox="0 0 0.26458333 4.2333333" style="position: absolute; height: 100px; width: ${100 * (1 / 16)}px; margin-left: ${-(100 * (1 / 16) / 2)}px; left: ${value * 100}%;">
        <path d="M0 0v4.233h.265V0H0" fill="#f44336"/>
      </svg>
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 8.4666666 8.4666666" preserveAspectRatio="none" style="width: ${WIDTH}px; height: 100px;">
        <path d="M0 3.97v.528h8.467v-.53H0" fill="#ccc"/>
      </svg>
    </a>
  `;

  return `<div style="display: flex; width: ${WIDTH}px; height: 100px; flex-direction: column; box-sizing: border-box;">
    ${barSrc}
  </div>`;
};

module.exports = {
  getHomeMenuSrc,
  getMediaPlaySrc,
  getMediaBarSrc,
};
