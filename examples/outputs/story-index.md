# Story — static dependency trace from src/index.js

1. [Entry] src/index.js  (entry point)
2. [API Route] src/routes/orders.js  (via src/index.js:2)
3. [Middleware] src/middleware/auth.js  (via src/index.js:3)
4. [Shared Utility] src/utils/logger.js  (via src/index.js:4)
5. [Service] src/services/orderService.js  (via src/routes/orders.js:2)
6. [Data Access] src/db/index.js  (via src/services/orderService.js:1)
7. [Model/Schema] src/models/order.js  (via src/services/orderService.js:2)

_Static dependency trace — data flow inferred from imports, not observed at runtime._
