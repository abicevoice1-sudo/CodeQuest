const express = require('express');
const { orderRouter } = require('./routes/orders');
const { authMiddleware } = require('./middleware/auth');
const { logger } = require('./utils/logger');

const app = express();
app.use(express.json());
app.use(authMiddleware);
app.use('/orders', orderRouter);

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.info(`listening on ${PORT}`));

module.exports = { app };
