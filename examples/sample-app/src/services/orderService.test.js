const { createOrder } = require('../services/orderService');

test('createOrder computes total', async () => {
  const order = await createOrder({ items: [{ price: 10, qty: 2 }] });
  expect(order.total).toBe(20);
});
