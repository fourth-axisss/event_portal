// Copy only the allowed columns from a request body ('' becomes NULL).
function pick(source, columns) {
  const row = {};
  for (const col of columns) {
    if (source[col] !== undefined) {
      row[col] = source[col] === '' ? null : source[col];
    }
  }
  return row;
}

module.exports = { pick };