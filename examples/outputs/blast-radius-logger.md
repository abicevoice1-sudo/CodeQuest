# Blast radius — src/utils/logger.js
Layer: Shared Utility   Risk: [HIGH RISK]   fan-in 4 / fan-out 0

## Upstream (what this module imports)
- (none — leaf or external-only)

## 1st-degree downstream (4 modules)
- src/index.js
- src/middleware/auth.js
- src/models/order.js
- src/services/orderService.js

## 2nd-degree downstream (2 modules)
- src/routes/orders.js
- src/services/orderService.test.js

## Affected tests
- src/services/orderService.test.js

## Flow
[src/utils/logger.js]
   ↑ imported by src/index.js
   ↑ imported by src/middleware/auth.js
   ↑ imported by src/models/order.js
   ↑ imported by src/services/orderService.js
