const creatureUtils = require('./lib/creatureUtils'); 
const textUtils = require('./lib/textUtils'); 

const client = ({engines: {nedb, biolumi, multiplayer}}) => ({
  mount() {
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
    biolumi.push({
      header: {
        img: creatureUtils.makeCreature()[0],
        text: textUtils.makePlanetName(),
      },
      body: [
        {
          type: 'input',
          label: 'Name',
          value: 'Biolumi',
        },
        {
          type: 'button',
          label: 'Button',
          value: 'Submit',
        },
        {
          type: 'slider',
          label: 'Slider',
          value: 100,
        },
        {
          type: 'unitbox',
          label: 'Unitbox',
          value: 100,
        },
        {
          type: 'link',
          value: 'New world',
        },
      ],
    });

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
  },
  unmount() {
    this._cleanup();
  },
});

module.exports = client;
