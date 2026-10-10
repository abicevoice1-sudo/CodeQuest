const { logger } = require('../utils/logger');

class Order {
  constructor(payload) {
    this.id = payload.id || `ord_${Date.now()}`;
    this.items = payload.items || [];
    this.total = this.items.reduce((s, i) => s + i.price * i.qty, 0);
  }
  validate() {
    if (!this.items.length) throw new Error('order must have items');
  }
  toJSON() {
    return { id: this.id, items: this.items, total: this.total };
  }
  static fromRow(row) {
    return new Order({ id: row.id, items: row.items });
  }
}

module.exports = { Order };
