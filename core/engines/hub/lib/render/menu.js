const {
  WIDTH,
  HEIGHT,

  SERVER_WIDTH,
  SERVER_HEIGHT,
} = require('../constants/menu');

const SERVERS_PER_PAGE = 8;

const leftWhiteImg = require('../img/left-white');
const leftWhiteImgSrc = 'data:image/svg+xml;base64,' + btoa(leftWhiteImg);
const rightWhiteImg = require('../img/right-white');
const rightWhiteImgSrc = 'data:image/svg+xml;base64,' + btoa(rightWhiteImg);
const chipImg = require('../img/chip');
const chipImgSrc = 'data:image/svg+xml;base64,' + btoa(chipImg);
const earthImg = require('../img/earth');
const earthImgSrc = 'data:image/svg+xml;base64,' + btoa(earthImg);
const closeBoxImg = require('../img/close-box');
const closeBoxImgSrc = 'data:image/svg+xml;base64,' + btoa(closeBoxImg);
const earthBoxImg = require('../img/earth-box');
const earthBoxImgSrc = 'data:image/svg+xml;base64,' + btoa(earthBoxImg);
const viewCarouselImg = require('../img/view-carousel');
const viewCarouselImgSrc = 'data:image/svg+xml;base64,' + btoa(viewCarouselImg);
const serverPlusImg = require('../img/server-plus');
const serverPlusImgSrc = 'data:image/svg+xml;base64,' + btoa(serverPlusImg);
const chevronLeftImg = require('../img/chevron-left');
const chevronLeftIconSrc = 'data:image/svg+xml;base64,' + btoa(chevronLeftImg);
const lanConnectImg = require('../img/lan-connect');
const lanConnectImgSrc = 'data:image/svg+xml;base64,' + btoa(lanConnectImg);
const lanDisconnectImg = require('../img/lan-disconnect');
const lanDisconnectImgSrc = 'data:image/svg+xml;base64,' + btoa(lanDisconnectImg);
const upImg = require('../img/up');
const downImg = require('../img/down');

const makeRenderer = ({creatureUtils}) => {

const getHubMenuSrc = ({page, remoteServers, localServers, inputText, inputIndex, inputValue, loading, vrMode, focusType, flags, imgs}) => {
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
  if (name === 'tutorial') {
    const {args} = pageSpec;
    const pageIndex = parseInt(args[0], 10);

    return getTutorialPageSrc(pageIndex, vrMode, flags, imgs);
  } else if (name === 'remoteServers') {
    const {args} = pageSpec;
    const pageIndex = parseInt(args[0], 10);

    return getRemoteServersSrc(remoteServers, pageIndex, loading);
  } else if (name === 'localServers') {
    const {args} = pageSpec;
    const pageIndex = parseInt(args[0], 10);

    return getLocalServersSrc(localServers, pageIndex, loading);
  } else if (name === 'createServer') {
    return getCreateServerSrc(inputText, inputIndex, inputValue, focusType);
  } else {
    return '';
  }
};

const getTutorialPageSrc = (pageIndex, vrMode, flags, imgs) => {
  const keyboardVrMode = vrMode === null || vrMode === 'keyboard';

  const content = (() => {
    switch (pageIndex) {
      case 0: return `\
        <div style="display: flex; padding: 30px 100px; justify-content: center; align-items: center; flex-direction: column; flex-grow: 1">
          <div style="margin-bottom: 10px; font-size: 30px; font-weight: 400;">Welcome to Zeo!</div>
          <img src="${imgs.logo}" width="${100 * 0.75}" height="{158 * 0.75}" />
          <div style="width: 540px; margin-bottom: auto; font-size: 15px; font-weight: 400; flex-grow: 1">
            ${keyboardVrMode ? `\
              <p>You're using a keyboard and mouse, so here are the controls:</p>
              <div style="display: flex; justify-content: center; align-items: center;">
                <img src="${imgs.keyboard}" width="128" height="${128 / 3}" />
              </div>
              <p>
                <b>WASD</b>: Move around<br/>
                <b>Z or C</b>: Focus left or right controller (<i>required</i> to use the buttons below)<br/>
                <b>Click, E, F, Q</b>: Trigger, menu, grip, touchpad buttons<br/>
                <b>Mousewheel</b> Move controller x/y axis<br/>
                <b>Ctrl + Mousewheel</b> Move controller x/z axis<br/>
                <b>Shift + mousewheel</b> Rotate controller<br/>
                <b>RED DOTS</b> show where your controllers are pointing<br/>
              </p>
              <p style="margin: 0; font-size: 18px;">
                <i>To continue, click the <b>NEXT BUTTON</b> with your <b>TRIGGER</b>:</i>
              </p>
            ` : `\
              <p>You're using a headset, so you can interact with the world with your controllers!</p>
              <p><b>PRESS A BUTTON</b> on your controllers to <b>WAKE</b> them. <b>RED DOTS</b> show where your controllers are pointing.</p>
              <div style="display: flex; margin-top: -20px; justify-content: center; align-items: center;">
                <img src="${imgs.controller}" width="200" height="200" />
              </div>
              <p style="margin: 0; font-size: 18px;">
                <i>To continue, click the <b>NEXT BUTTON</b> with your <b>TRIGGER</b>:</i>
              </p>
            `}
          </div>
          <div style="display: flex; width: 100%;">
            <a style="margin-left: auto; padding: 10px 15px; border: 1px solid; border-radius: 5px; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="hub:next">Next: Modules &gt;</a>
          </div>
        </div>
      `;
      case 1: return `\
        <div style="display: flex; padding: 30px 100px; justify-content: center; align-items: center; flex-direction: column; flex-grow: 1">
          <div style="font-size: 30px; font-weight: 400;">Discover your superpowers</div>
          <div style="display: flex;">
            <img src="${imgs.menu}" width="256" height="128" style="margin: 10px 0; margin-right: 28px;" />
            <img src="${imgs.teleport}" width="256" height="128" style="margin: 10px 0;" />
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
          <div style="display: flex; width: 100%;">
            <a style="padding: 10px 15px; border: 1px solid; border-radius: 5px; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="hub:back">&lt; Back</a>
            <a style="margin-left: auto; padding: 10px 15px; border: 1px solid; border-radius: 5px; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="hub:next">Next: Servers &gt;</a>
          </div>
        </div>
      `;
      case 2: return `\
        <div style="display: flex; padding: 30px 100px; justify-content: center; align-items: center; flex-direction: column; flex-grow: 1">
          <div style="font-size: 30px; font-weight: 400;">The cake is real</div>
          <img src="${imgs.cake}" width="256" height="128" style="margin: 10px 0;" />
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
          <div style="display: flex; width: 100%;">
            <a style="padding: 10px 15px; border: 1px solid; border-radius: 5px; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="hub:back">&lt; Back</a>
            <a style="margin-left: auto; padding: 10px 15px; border: 1px solid; border-radius: 5px; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="hub:next">Next: Servers &gt;</a>
          </div>
        </div>
      `;
      case 3: return `\
        <div style="display: flex; padding: 30px 100px; justify-content: center; align-items: center; flex-direction: column; flex-grow: 1">
          <div style="font-size: 30px; font-weight: 400;">It's dangerous to go alone!</div>
          <img src="${imgs.server}" width="256" height="128" style="margin: 10px 0;" />
          <div style="width: 540px; margin-bottom: auto; font-size: 15px; font-weight: 400; flex-grow: 1">
            <p>Zeo VR lets you connect to multiplayer world servers.</p>
            <p>Look at the <b>LINK ORBS</b> around you. Each Link Orb is a server you can join. To connect to a server, <b>POINT</b> at it and click your <b>TRIGGER</b>.</p>
            <p>Some servers are <b>LOCKED</b> until you get permission from the owner. Contact info for each server is written above the server, but you can <i>sneak a peek</i> through the orb.</p>
            <p style="margin-bottom: 0; font-size: 18px;">
              <i>
                To <b>LEARN</b> how to code your own worlds, read the <a onclick="hub:apiDocs"><b>API Docs</b></a>.<br/>
                To <b>HIDE</b> the tutorial, click the <b>NEXT BUTTON</b>.<br/>
              </i>
            </p>
          </div>
          <div style="display: flex; width: 100%;">
            <a style="padding: 10px 15px; border: 1px solid; border-radius: 5px; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="hub:back">&lt; Back</a>
            <a style="margin-left: auto; padding: 10px 15px; border: 1px solid; border-radius: 5px; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="hub:next">Next: Finish Tutorial &gt;</a>
          </div>
        </div>
      `;
      case 4: return `\
        <div style="display: flex; height: 500px; justify-content: center; align-items: center;">
          <a style="display: flex; width: 200px; height: 200px; margin-right: 30px; border: 1px solid; border-radius: 5px; font-weight: 400; text-decoration: none; flex-direction: column; justify-content: center; align-items: center;" onclick="hub:remoteServers">
            <div style="margin-bottom: 15px; font-size: 24px;">Remote servers</div>
            <img src="${earthBoxImgSrc}" width="100" height="100" />
          </a>
          <a style="display: flex; width: 200px; height: 200px; margin-right: 30px; border: 1px solid; border-radius: 5px; font-weight: 400; text-decoration: none; flex-direction: column; justify-content: center; align-items: center;" onclick="hub:tutorial">
            <div style="margin-bottom: 15px; font-size: 24px;">Tutorial</div>
            <img src="${viewCarouselImgSrc}" width="100" height="100" />
          </a>
          ${flags.localServers ?
            `<a style="display: flex; width: 200px; height: 200px; margin-right: 30px; border: 1px solid; border-radius: 5px; font-weight: 400; text-decoration: none; flex-direction: column; justify-content: center; align-items: center;" onclick="hub:localServers">
              <div style="margin-bottom: 15px; font-size: 24px;">Local servers</div>
              <img src="${serverPlusImgSrc}" width="100" height="100" />
            </a>`
          :
            ''
          }
        </div>
      `;
      /* `\
        <div style="display: flex; height: 200px; justify-content: center; align-items: center;">
          <div style="font-size: 50px;">Choose a server</div>
        </div>
        <div style="position: relative; display: flex; justify-content: center; align-items: center; flex-direction: column;">
          <div style="width: 640px;">
            ${!loading ? `\
              ${error ? `\
                <div style="display: flex; position: absolute; left: 0; right: 0; margin-top: ${-50 - 80}px; height: 80px; background-color: #F44336; color: #FFF; font-size: 30px; font-weight: 400; justify-content: center; align-items: center;">
                  <div style="display: flex; width: 640px;">
                    <div style="flex: 1;">
                      ${error === 'EINPUT' ? 'Enter a token.' : ''}
                      ${error === 'EAUTH' ? 'Invalid token.' : ''}
                    </div>
                    <a style="display: flex; width: 80px; border: 1px solid; border-radius: 5px; text-decoration: none; justify-content: center; align-items: center;" onclick="error:close">X</a>
                  </div>
                </div>
              ` : ''}
              <a style="position: relative; display: block; margin-bottom: 30px; background-color: #EEE; font-size: 40px; text-decoration: none; overflow: hidden;" onclick="hub:focus:search">
                ${focusType === 'search' ? `<div style="position: absolute; width: 2px; top: 2px; bottom: 2px; left: ${inputValue}px; background-color: #333;"></div>` : ''}
                <div>${searchText}</div>
                ${!searchText ? `<div style="color: #AAA;">Search servers</div>` : ''}
              </a>
            ` : `\
              <div style="font-size: 40px;">Loading...</div>
            `}
          </div>
        </div>
        <div style="display: flex; margin-top: auto; padding: 100px; justify-content: center; align-items: center;">
          <a style="display: inline-block; padding: 10px 15px; border: 1px solid; border-radius: 5px; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="hub:tutorial">Start tutorial</a>
        </div>
      `; */
      default: return '';
    }
  })();

  return `\
    <div style="display: flex; width: ${WIDTH}px; height: ${HEIGHT}px; flex-direction: column;">
      <div style="display: flex; height: 100px; padding: 20px; background-color: #000; font-size: 40px; color: #FFF; box-sizing: border-box; align-items: center;">
        <img src="${imgs.logo}" width="${100 / 2}" height="${158 / 2}" style="margin-right: 30px;" />
        <div>zeo vr</div>
      </div>
      ${content}
    </div>
  `;
};

const getServerSrc = (server, index, prefix) => {
  const {worldname, url, running, users} = server;

  return `\
    <a style="display: flex; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #EEE; text-decoration: none;" onclick="${prefix}:${index}">
      <img src="${creatureUtils.makeStaticCreature('server:' + worldname)}" width="80" height="80" style="display: flex; width: 80px; height: 80px; margin-right: 10px; image-rendering: -moz-crisp-edges; image-rendering: pixelated;" />
      <div style="display: flex; margin-right: auto; padding: 5px; flex-direction: column;">
        <div style="font-size: 20px; font-weight: 600;">${worldname}</div>
        <div style="font-size: 13px; font-weight: 400;">
          ${url ?
            `<i>https://${url}</i>`
          :
            ''
          }
        </div>
      </div>
      <div style="width: 300px; padding: 5px; box-sizing: border-box;">
        ${users.length > 0 ?
          users.map(user =>
            `<div style="display: inline-block; margin-right: 5px; padding: 2px 10px; background-color: #F7F7F7; font-size: 13px; font-weight: 400;">${user}</div>`
          ).join('')
        :
          'No users'
        }
      </div>
      <div style="display: flex; width: 80px; height: 80px; justify-content: center; align-items: center;">
        <img src="${running ? lanConnectImgSrc : lanDisconnectImgSrc}" width="24px" height="24px" />
      </div>
    </a>
  `;
};
const getServersSrc = (servers, loading, prefix) => {
  if (!loading) {
    if (servers.length > 0) {
      return `<div style="display: flex; width: ${WIDTH - 250}px; height: ${HEIGHT - 100}px; padding: 0 30px; flex-direction: column; box-sizing: border-box;">
        ${servers.map((server, index) => getServerSrc(server, index, prefix)).join('')}
      </div>`;
    } else {
      return `<div style="padding: 0 30px; font-size: 30px;">No servers</div>`;
    }
  } else {
    return `<div style="padding: 0 30px; font-size: 30px;">Loading...</div>`;
  }
};

const getRemoteServersSrc = (servers, pageIndex, loading) => {
  const leftSrc = (() => {
    return `\
      <div style="display: flex; margin-right: auto; flex-direction: column;">
        <div style="display: flex; height: 100px; justify-content: center; align-items: center;">
          <a style="display: block; width: 100px;" onclick="hub:menu">
            <img src="${chevronLeftIconSrc}" width="80" height="80" />
          </a>
          <div style="margin-right: auto; font-size: 40px;">Remote servers</div>
        </div>
        ${getServersSrc(servers.slice(pageIndex * SERVERS_PER_PAGE, (pageIndex + 1) * SERVERS_PER_PAGE), loading, 'remoteServer')}
      </div>
    `;
  })();
  const rightSrc = (() => {
    const showUp = pageIndex > 0;
    const showDown = servers.length >= ((pageIndex + 1) * SERVERS_PER_PAGE);

    return `\
      <div style="display: flex; width: 250px; height: inherit; flex-direction: column; box-sizing: border-box;">
        <a style="position: relative; display: flex; margin: 0 30px; margin-top: 20px; margin-bottom: auto; border: 1px solid; border-radius: 5px; text-decoration: none; justify-content: center; align-items: center; ${showUp ? '' : 'visibility: hidden;'}" onclick="servers:up">
          ${upImg}
        </a>
        <a style="position: relative; display: flex; margin: 0 30px; margin-bottom: 20px; border: 1px solid; border-radius: 5px; text-decoration: none; justify-content: center; align-items: center; ${showDown ? '' : 'visibility: hidden;'}" onclick="servers:down">
          ${downImg}
        </a>
      </div>
    `;
  })();

  return `\
    <div style="display: flex; height: ${HEIGHT}px;">
      ${leftSrc}
      ${rightSrc}
    </div>
  `;
};

const getLocalServersSrc = (servers, pageIndex, loading) => {
  const leftSrc = (() => {
    return `\
      <div style="display: flex; margin-right: auto; flex-direction: column;">
        <div style="display: flex; height: 100px; justify-content: center; align-items: center;">
          <a style="display: block; width: 100px;" onclick="hub:menu">
            <img src="${chevronLeftIconSrc}" width="80" height="80" />
          </a>
          <div style="margin-right: auto; font-size: 40px;">Local servers</div>
        </div>
        ${getServersSrc(servers.slice(pageIndex * SERVERS_PER_PAGE, (pageIndex + 1) * SERVERS_PER_PAGE), loading, 'localServer')}
      </div>
    `;
  })();
  const rightSrc = (() => {
    const showUp = pageIndex > 0;
    const showDown = servers.length >= ((pageIndex + 1) * SERVERS_PER_PAGE);

    return `\
      <div style="display: flex; width: 250px; height: inherit; flex-direction: column; box-sizing: border-box;">
        <a style="display: flex; margin: 30px; padding: 20px 0; border: 1px solid; border-radius: 5px; font-weight: 400; text-decoration: none; flex-direction: column; justify-content: center; align-items: center;" onclick="localServers:createServer">
          <div style="font-size: 24px;">Create server</div>
          <img src="${serverPlusImgSrc}" width="80" height="80" />
        </a>
        <a style="position: relative; display: flex; margin: 0 30px; margin-bottom: auto; border: 1px solid; border-radius: 5px; text-decoration: none; justify-content: center; align-items: center; ${showUp ? '' : 'visibility: hidden;'}" onclick="servers:up">
          ${upImg}
        </a>
        <a style="position: relative; display: flex; margin: 0 30px; margin-bottom: 20px; border: 1px solid; border-radius: 5px; text-decoration: none; justify-content: center; align-items: center; ${showDown ? '' : 'visibility: hidden;'}" onclick="servers:down">
          ${downImg}
        </a>
      </div>
    `;
  })();

  return `\
    <div style="display: flex; height: ${HEIGHT}px;">
      ${leftSrc}
      ${rightSrc}
    </div>
  `;
};

const getCreateServerSrc = (inputText, inputIndex, inputValue, focusType) => {
  return `\
    <div>
      <div style="display: flex; height: 100px; justify-content: center; align-items: center;">
        <a style="display: block; width: 100px;" onclick="hub:menu">
          <img src="${chevronLeftIconSrc}" width="80" height="80" />
        </a>
        <div style="margin-right: auto; font-size: 40px;">Create server</div>
      </div>
      <div style="display: flex; width: ${WIDTH}px; height: ${HEIGHT - 100}px; flex-direction: column; justify-content: center; align-items: center;">
        <a style="position: relative; display: block; width: 600px; margin-bottom: 20px; border-bottom: 3px solid #000; font-size: 40px; line-height: 1.4; text-decoration: none; overflow: hidden;" onclick="createServer:focus">
          ${focusType === 'createServer' ? `<div style="position: absolute; width: 2px; top: 2px; bottom: 2px; left: ${inputValue}px; background-color: #333;"></div>` : ''}
          <div>${inputText}</div>
          ${!inputText ? `<div style="color: #AAA;">Choose a name</div>` : ''}
        </a>
        <div style="display: flex; justify-content: center; align-items: center;">
          <a style="display: flex; margin: 30px; padding: 20px; border: 1px solid; border-radius: 5px; font-weight: 400; text-decoration: none; flex-direction: column; justify-content: center; align-items: center;" onclick="createServer:submit">
            <div style="font-size: 24px;">Create server</div>
            <img src="${serverPlusImgSrc}" width="80" height="80" />
          </a>
        </div>
      </div>
    </div>
  `;
};

const getServerTagSrc = ({worldname, url, running, local}) => {
  return `\
    <div style="display: flex; width: ${SERVER_WIDTH}px; height: ${SERVER_HEIGHT}px; padding: 50px; background-color: #EEE; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box;">
      <div style="display: flex; width: 100%;">
        <a style="display: flex; position: absolute; top: 0; right: 0; width: 100px; height: 100px; justify-content: center; align-items: center;" onclick="server:close:${worldname}">
          <img src="${closeBoxImgSrc}" width="80" height="80" />
        </a>
        <img src="${creatureUtils.makeStaticCreature('server:' + worldname)}" width="${SERVER_HEIGHT}" height="${SERVER_HEIGHT}" style="width: ${SERVER_HEIGHT}px; height: ${SERVER_HEIGHT}px; margin: -50px; margin-right: 50px; image-rendering: -moz-crisp-edges; image-rendering: pixelated;" />
        <div style="display: flex; flex-grow: 1; flex-direction: column;">
          <div style="flex-grow: 1;">
            <div style="font-size: 60px; font-weight: 400;">${worldname}</div>
            ${url ?
              `<div style="font-size: 30px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${url}</div>`
            :
              ''
            }
          </div>
          ${local ? `\
            ${running ?
              `<a style="display: flex; margin-bottom: 20px; padding: 10px; background-color: #4CAF50; color: #FFF; font-size: 40px; text-decoration: none; justify-content: center; align-items: center;" onclick="server:copyUrl:${worldname}">Copy URL</a>`
            :
              ''
            }
            <a style="display: flex; align-items: center; text-decoration: none;" onclick="server:toggleRunning:${worldname}">
              <div style="display: flex; margin-right: 30px; align-items: center;">
                ${running ?
                  `<div style="display: flex; justify-content: center; align-items: center;">
                    <div style="display: flex; width: ${(60 * 2) - (5 * 2)}px; height: 60px; padding: 5px; border: 5px solid #333; justify-content: flex-end; align-items: center; box-sizing: border-box;">
                      <div style="width: ${60 - ((5 * 2) + (5 * 2))}px; height: ${60 - ((5 * 2) + (5 * 2))}px; background-color: #333;"></div>
                    </div>
                  </div>`
                :
                  `<div style="display: flex; justify-content: center; align-items: center;">
                    <div style="display: flex; width: ${(60 * 2) - (5 * 2)}px; height: 60px; padding: 5px; border: 5px solid #CCC; justify-content: flex-start; align-items: center; box-sizing: border-box;">
                      <div style="width: ${60 - ((5 * 2) + (5 * 2))}px; height: ${60 - ((5 * 2) + (5 * 2))}px; background-color: #CCC;"></div>
                    </div>
                  </div>`
                }
              </div>
              <div style="font-size: 60px; font-weight: 400; ${running ? 'color: #000;' : 'color: #CCC;'}">${running ? 'Running' : 'Not running'}</div>
            </a>
          `
          :
            ''
          }
        </div>
      </div>
    </div>
  `;
};

return {
  getHubMenuSrc,
  getServerTagSrc,
};

};

module.exports = {
  makeRenderer,
};
