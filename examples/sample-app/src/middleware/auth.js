const { logger } = require('../utils/logger');

function authMiddleware(req, res, next) {
  const token = req.headers.authorization;
  if (!token) {
    logger.debug('auth rejected: no token');
    return res.status(401).json({ error: 'unauthorized' });
  }
  req.user = { id: token };
  next();
}

module.exports = { authMiddleware };
