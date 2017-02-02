const getFileSrc = ({name, instancing}) => `\
  <div style="display: flex; width: 400px; height: 150px; background-color: #F0F0F0; text-decoration: none; ${instancing ? 'filter: brightness(75%);' : ''}">
    <div style="width: 100px; height: 100px; margin: 0 10px;"></div>
    <div style="width: 270px; margin-right: 10px;">
      <div style="height: 100px;">
        <h1 style="margin: 0; margin-top: 10px; font-size: 28px; line-height: 1.4;">${name}</h1>
        <p style="margin: 0; font-size: 15px; line-height: 1.4;">File in /</p>
      </div>
      <div style="display: flex; height: 30px; margin-left: -110px; margin-bottom: 20px; justify-content: flex-end; align-items: center;">
        <div style="padding: 5px 20px; border: 1px solid; border-radius: 100px; box-sizing: border-box;">Open</div>
      </div>
    </div>
  </div>
`;

module.exports = {
  getFileSrc,
};
