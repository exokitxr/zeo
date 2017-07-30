class Anchor {
  constructor(left, right, top, bottom, onclick, onmousedown, onmouseup) {
    this.left = left;
    this.right = right;
    this.top = top;
    this.bottom = bottom;
    this.onclick = onclick;
    this.onmousedown = onmousedown;
    this.onmouseup = onmouseup;
  }
}

module.exports = Anchor;
