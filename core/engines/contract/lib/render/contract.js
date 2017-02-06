const makeRenderer = ({creatureUtils}) => {

const getContractSrc = ({id, name, author}) => `\
  <div>
    <div style="padding: 10px 30px; background-color: #000; color: #FFF; font-size: 50px;">Contract</div>
    <div style="padding: 10px 30px;">
      <div style="display: flex; align-items: flex-start;">
        <div style="flex-grow: 1;">
          <div style="margin: 0; font-size: 50px; line-height: 1.4;">${name}</div>
        </div>
        <div style="display: flex; position: absolute; top: -25px; right: -120px; width: 300px; padding-top: 50px; padding-bottom: 20px; background: #4CAF50; color: #FFF; font-size: 30px; justify-content: center; align-items: center; box-sizing: border-box; box-sizing: border-box; transform: rotate(45deg);">$350</div>
      </div>
      <div style="display: flex; margin: 0 -30px; margin-bottom: 30px; font-size: ${50 / 1.4}px; line-height: 1.4;">
        <img src="${creatureUtils.makeStaticCreature('user:' + author)}" width="50" height="50" style="margin-left: 30px; margin-right: 10px; image-rendering: pixelated;" />
        <div>${author}</div>
      </div>
      <div style="display: flex;">
        <a style="padding: 10px 30px; margin-right: 20px; border: 1px solid; color: #2196F3; border-radius: 100px; font-size: 30px; text-decoration: none;" onclick="contract:post:${id}">Post Offer</a>
        <a style="padding: 10px 30px; border: 1px solid; color: #F44336; border-radius: 100px; font-size: 30px; text-decoration: none;" onclick="contract:cancel:${id}">Cancel</a>
      </div>
    </div>
  </div>
`;

return  {
  getContractSrc,
};

};

module.exports = {
  makeRenderer,
};
