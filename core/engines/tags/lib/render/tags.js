const getTagSrc = () => `\
<div style="display: flex; width: 400px; height: 150px;">
  <div style="width: 100px;"></div>
  <div style="width: 300px; flex-grow: 1;">
    <h1 style="margin: 0; font-size: 32px; line-height: 1.4;">zeo-model</h1>
    <p style="margin: 0; font-size: 16px; line-height: 1.4;">Load 3D models from various formats and place them in the world scene.</p>
  </div>
</div>
`;

module.exports = {
  getTagSrc,
};
