const functionUtils = {
  mount() {
    function sum(a) {
      let result = 0;
      for (let i = 0; i < a.length; i++) {
        result += a[i];
      }
      return result;
    }

    return {
      sum,
    };
  },
  unmount() {},
};

module.exports = functionUtils;
