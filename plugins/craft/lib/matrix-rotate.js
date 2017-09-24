module.exports = function (mat) {
	// Our rotation algorithm involves two steps.
	transpose(mat);
	reverseRows(mat);
	return mat;
}

function getIndex(x, y, n) {
  return x + y * n;
}

/**
 * Swap each colum with it's n-i corresponding element
 */
function reverseRows(mat) {
	var n = Math.sqrt(mat.length);
	for (var i = 0; i < n; i++)
		for (var j = 0; j < n; j++)
			if (j%2===0) {
        var index1 = getIndex(i, n - j - 1, n);
        var index2 = getIndex(i, j, n);
				var temp = mat[index1];
				mat[index1] = mat[index2]
				mat[index2] = temp;
			}
}

/**
 * Transpose a 2d matrix
 */
function transpose(mat) {

	// For NxN matrix
	var n = Math.sqrt(mat.length);

	// Walk through columns
	for (var i = 0, j = 0; i < n; i++) {
		j = i;
		// Walk through rows
		while (j < n) {
			if (i != j) {
        var index1 = getIndex(i, j, n);
        var index2 = getIndex(j, i, n);
				var temp = mat[index1];
				mat[index1] = mat[index2];
				mat[index2] = temp;
			}
			j++;
		}
	}
}
