const { logger } = require('./utils/logger');

const store = new Map();

const db = {
  async insert(table, row) {
    const key = `${table}:${row.id}`;
    store.set(key, row);
    logger.debug('db insert', { key });
    return row;
  },
  async findOne(table, query) {
    return store.get(`${table}:${query.id}`) || null;
  },
};

module.exports = { db };
