const client = ({engines: {biolumi, multiplayer}}) => ({
  mount() {
    biolumi.push({
      // XXX push the core UI here
    });

    const form = biolumi.getForm();
    const mousemove = e => {
      const {clientX, clientY} = e;
      const {left: startX, top: startY} = form.getBoundingClientRect();
      const x = clientX - startX;
      const y = clientY - startY;

      multiplayer.status({
        position: {
          x,
          y,
        },
      });
    };
    form.addEventListener('mousemove', mousemove);

    const cursors = new Map();
    multiplayer.on('status', m => {
      const {id, status} = m;

      if (status) {
        let cursor = cursors.get(id);
        if (!cursor) {
          cursor = biolumi.addCursor();
          cursors.set(id, cursor);
        }

        const {position: {x, y}} = status;
        cursor.setPosition(x, y);
      } else {
        const cursor = cursors.get(id);
        if (cursor) {
          cursor.remove();
          cursors.delete(id);
        }
      }
    });

    this._cleanup = () => {
      form.removeEventListener('mousemove', mousemove);
    };
  },
  unmount() {
    this._cleanup();
  },
});

module.exports = client;
