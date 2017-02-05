const getContractSrc = ({name, author}) => `\
  <div style="display: flex;">
    <div style="display: flex;">
      <div style="margin: 0; font-size: 20px; flex-grow: 1;">${name} by ${author}</div>
      <svg xmlns="http://www.w3.org/2000/svg" version="1.1">
        <defs>
          <linearGradient id="contract-gradient" x1="0" x2="0" y1="1" y2="0">
            <stop offset="10%" stop-color="#d6e685"></stop>
            <stop offset="33%" stop-color="#8cc665"></stop>
            <stop offset="66%" stop-color="#44a340"></stop>
            <stop offset="90%" stop-color="#1e6823"></stop>
          </linearGradient>
        </defs>
        <text fill="url(#contract-gradient)" font-size="32" font-family="Open Sans" x="0" y="50">
          $350
        </text>
      </svg>
   </div>
    <div style="display: flex;">
      <div style="padding: 20px; border: 1px solid; color: #2196F3;">Post Offer</div>
      <div style="padding: 20px; border: 1px solid; color: #F44336;">Cancel</div>
    </div>
  </div>
`;

module.exports = {
  getContractSrc,
};
