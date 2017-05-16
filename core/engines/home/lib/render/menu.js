const {
  WIDTH,
  HEIGHT,
} = require('../constants/menu');

const chevronLeftImg = require('../img/chevron-left');
const chevronLeftImgSrc = 'data:image/svg+xml;base64,' + btoa(chevronLeftImg);
const playImg = require('../img/play');
const playImgSrc = 'data:image/svg+xml;base64,' + btoa(playImg);

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
  // const keyboardVrMode = vrMode === null || vrMode === 'keyboard';

  const content = (() => {
    switch (pageIndex) {
      case 0: return `\
        <div style="display: flex; padding: 0 50px; justify-content: center; align-items: center; flex-direction: column; flex-grow: 1;">
          <div style="display: flex; width: 100%; height: 100px; margin-top: auto; justify-content: center; align-items: center;">
            <a style="display: flex; margin-left: auto; margin-right: 40px; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="home:skipAll">Skip all tutorials</a>
            <a style="display: flex; padding: 10px 15px; border: 2px solid; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="home:next">Next: Modules</a>
          </div>
        </div>
      `;
      case 1: return `\
       <div style="display: flex; padding: 0 50px; justify-content: center; align-items: center; flex-direction: column; flex-grow: 1;">
          <div style="display: flex; width: 100%; height: 100px; margin-top: auto; justify-content: center; align-items: center;">
            <a style="display: flex; margin-left: auto; margin-right: 40px; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="home:skipAll">Skip all tutorials</a>
            <a style="display: flex; padding: 10px 15px; border: 2px solid; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="home:next">Next: Servers</a>
          </div>
        </div>
      `;
      case 2: return `\
        <div style="display: flex; padding: 0 50px; justify-content: center; align-items: center; flex-direction: column; flex-grow: 1;">
          <div style="display: flex; width: 100%; height: 100px; margin-top: auto; justify-content: center; align-items: center;">
            <a style="display: flex; margin-left: auto; margin-right: 40px; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="home:skipAll">Skip all tutorials</a>
            <a style="display: flex; padding: 10px 15px; border: 2px solid; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="home:next">Next: Multiplayer</a>
          </div>
        </div>
      `;
      case 3: return `\
        <div style="display: flex; padding: 0 50px; justify-content: center; align-items: center; flex-direction: column; flex-grow: 1;">
          <div style="display: flex; width: 100%; height: 100px; margin-top: auto; justify-content: center; align-items: center;">
            <a style="display: flex; margin-left: auto; margin-right: 40px; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="home:skipAll">Skip all tutorials</a>
            <a style="display: flex; padding: 10px 15px; border: 2px solid; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="home:next">Next: Host your own</a>
          </div>
        </div>
      `;
      case 4: return `\
        <div style="display: flex; padding: 0 50px; justify-content: center; align-items: center; flex-direction: column; flex-grow: 1;">
          <div style="display: flex; width: 100%; height: 100px; margin-top: auto; justify-content: center; align-items: center;">
            <a style="display: flex; margin-left: auto; margin-right: 40px; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="home:skipAll">Skip all tutorials</a>
  <a style="display: flex; padding: 10px 15px; border: 2px solid; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="home:next">Go to main menu</a>
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
          `<a style="display: flex; margin-right: 150px; padding: 10px 30px; padding-right: 0; text-decoration: none; align-items: center;" onclick="home:video:${index}">
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
