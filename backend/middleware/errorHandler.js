function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.error(err);

  if (res.headersSent) {
    return next(err);
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body is not valid JSON' });
  }

  if (err.code === 'ER_DUP_ENTRY') {
    const match = /Duplicate entry '(.*)' for key/.exec(err.sqlMessage || '');
    return res.status(409).json({
      message: match ? `"${match[1]}" already exists` : 'That record already exists',
    });
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ message: 'A selected item does not exist' });
  }

  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({ message: 'This item is in use and cannot be removed' });
  }

  if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
    return res.status(400).json({ message: 'These values are not allowed together' });
  }

  res.status(500).json({ message: 'Something went wrong. Please try again.' });
}

module.exports = errorHandler;