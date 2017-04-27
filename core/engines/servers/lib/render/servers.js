const {
  WIDTH,
} = require('../constants/servers');

const getServersPageSrc = ({remoteServers, page}) => `\
  <div style="width: ${WIDTH}px;">
    <div style="display: flex; width: 640px; padding: 0 30px; box-sizing: border-box; flex-direction: column;">
      ${JSON.stringify({remoteServers, page}, null, 2)}
    </div>
  </div>
`;

module.exports = {
  getServersPageSrc,
};
