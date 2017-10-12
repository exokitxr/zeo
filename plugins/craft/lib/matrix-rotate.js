module.exports = matrix => {
  const n = Math.sqrt(matrix.length);
  const result = Array(matrix.length);
  for (let i = 0; i < n; ++i) {
    for (let j = 0; j < n; ++j) {
      result[i * n + j] = matrix[(n - j - 1) * n + i];
    }
  }
  return result;
};
