const {
  WIDTH,
  HEIGHT,

  SERVER_WIDTH,
  SERVER_HEIGHT,
} = require('../constants/menu');

const leftWhiteImg = require('../img/left-white');
const leftWhiteImgSrc = 'data:image/svg+xml;base64,' + btoa(leftWhiteImg);
const rightWhiteImg = require('../img/right-white');
const rightWhiteImgSrc = 'data:image/svg+xml;base64,' + btoa(rightWhiteImg);
const chipImg = require('../img/chip');
const chipImgSrc = 'data:image/svg+xml;base64,' + btoa(chipImg);
const earthImg = require('../img/earth');
const earthImgSrc = 'data:image/svg+xml;base64,' + btoa(earthImg);

const getHubSrc = ({page, searchText, inputIndex, inputValue, loading, error, vrMode, focusType, imgs}) => {
  return `\
    <div style="display: flex; width: ${WIDTH}px; height: ${HEIGHT}px; flex-direction: column;">
      <div style="display: flex; height: 100px; padding: 20px; background-color: #000; font-size: 40px; color: #FFF; box-sizing: border-box; align-items: center;">
        <img src="${imgs.logo}" width="${100 / 2}" height="${158 / 2}" style="margin-right: 30px;" />
        <div>zeo vr</div>
      </div>
      ${getPageSrc(page, searchText, inputIndex, inputValue, loading, error, focusType, vrMode, imgs)}
    </div>
  `;
};

const getPageSrc = (page, searchText, inputIndex, inputValue, loading, error, focusType, vrMode, imgs) => {
  const keyboardVrMode = vrMode === null || vrMode === 'keyboard';

  switch (page) {
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
    `;
    default: return '';
  }
};

const getServerSrc = ({worldname, description, serverIcon}) => {
  return `\
    <div style="display: flex; width: ${SERVER_WIDTH}px; height: ${SERVER_HEIGHT}px; padding: 50px; background-color: #EEE; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box;">
      <div style="display: flex; width: 100%;">
        <img src="${serverIcon}" width="${SERVER_HEIGHT}" height="${SERVER_HEIGHT}" style="margin: -50px; margin-right: 50px; image-rendering: pixelated;" />
        <div style="flex-grow: 1;">
          <div style="font-size: 60px; font-weight: 400;">${worldname}</div>
          <div style="min-height: 150px; font-size: 40px;">${description}</div>
        </div>
      </div>
    </div>
  `;
};

module.exports = {
  getHubSrc,
  getServerSrc,
};
