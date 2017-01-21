const getTagSrc = () => `\
<div style="display: flex; width: 400px; height: 150px;">
  <div style="width: 100px;"></div>
  <div style="width: 300px; flex-grow: 1;">
    <h1 style="margin: 0; font-size: 32px; line-height: 1.4;">Item tag</h1>
    <p style="margin: 0; font-size: 16px; line-height: 1.4;">Here is some random content. And here is some more of it.</p>
  </div>
</div>
`;

module.exports = {
  getTagSrc,
};
