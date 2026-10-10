const { db } = require('../db');
const { Order } = require('../models/order');
const { logger } = require('../utils/logger');

async function createOrder(payload) {
  const order = new Order(payload);
  order.validate();
  await db.insert('orders', order.toJSON());
  logger.info('order created', { id: order.id });
  return order;
}

async function getOrder(id) {
  const row = await db.findOne('orders', { id });
  return row ? Order.fromRow(row) : null;
}

module.exports = { createOrder, getOrder };
