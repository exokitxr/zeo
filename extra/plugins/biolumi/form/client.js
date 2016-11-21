const creatureUtils = require('../../../utils/creatureUtils');
const textUtils = require('../../../utils/textUtils');

const client = archae => ({
  mount() {
    archae.requestEngines([
      '/core/engines/nedb',
      '/core/engines/biolumi',
      '/core/engines/multiplayer',
    ]).then(([
      nedb,
      biolumi,
      multiplayer,
    ]) => {
      // worlds
      nedb.ensureIndex({
        fieldName: 'lol',
        unique: true,
      }, err => {
        if (!err) {
          nedb.insert({
            lol: 'zol',
            // count: 0,
          }, err => {
            if (!err || err.errorType === 'uniqueViolated') {
              nedb.find({}, (err, result) => {
                if (!err) {
                  // console.log('got result', result);

                  const subscription = nedb.subscribe({
                    lol: 'zol',
                  }, o => {
                    console.log('got update', o);
                  });

                  nedb.update({
                    lol: 'zol',
                  }, {
                    $inc: {
                      count: 1,
                    }
                  }, (err, result) => {
                    if (!err) {
                      console.log('performed update', result);
                    } else {
                      console.warn(err);
                    }
                  });
                } else {
                  console.warn(err);
                }
              });
            } else {
              console.warn(err);
            }
          });
        } else {
          console.warn(err, JSON.stringify(err));
        }
      });
      const _makePage = () => {
        return {
          header: {
            img: creatureUtils.makeCreature(),
            text: textUtils.makePlanetName(),
            onclick: biolumi.getPages().length > 0 ? () => {
              biolumi.pop();
            } : null,
          },
          body: [
            {
              type: 'link',
              value: 'Click here',
              onclick: () => {
                biolumi.push(_makePage());
              },
            },
            {
              type: 'label',
              value: 'Name',
            },
            {
              type: 'input',
              value: 'Biolumi',
            },
            {
              type: 'label',
              value: 'Warning',
            },
            {
              type: 'text',
              value: `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

    Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`
            },
            {
              type: 'label',
              value: 'Button',
            },
            {
              type: 'button',
              value: 'Submit',
            },
            {
              type: 'label',
              value: 'Slider',
            },
            {
              type: 'slider',
              value: 100,
            },
            {
              type: 'label',
              value: 'Unitbox',
            },
            {
              type: 'unitbox',
              value: 100,
            },
            {
              type: 'link',
              value: 'New world',
              onclick: () => {
                biolumi.push(_makePage());
              },
            },
          ],
        }
      };
      biolumi.push(_makePage());

      // multiplayer
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
    })
    .catch(err => {
      console.warn(err);
    });

    this._cleanup = () => {};
  },
  unmount() {
    this._cleanup();
  },
});

module.exports = client;
