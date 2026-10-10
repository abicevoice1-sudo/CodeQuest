const express = require('express');
const { createOrder, getOrder } = require('../services/orderService');

const orderRouter = express.Router();

orderRouter.post('/', async (req, res) => {
  const order = await createOrder(req.body);
  res.status(201).json(order);
});

orderRouter.get('/:id', async (req, res) => {
  const order = await getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'not found' });
  res.json(order);
});

module.exports = { orderRouter };
