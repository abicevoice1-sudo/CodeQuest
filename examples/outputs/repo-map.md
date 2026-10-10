# CodeQuest repo map

- Modules: 11   Edges: 12
- Languages: javascript (8), python (3)
- Generated: 2026-10-10T00:09:20.461Z (codequest 1.0.0, deterministic static scan)

## Entry points
- src/index.js (javascript)
- tools/seed.py (python)

## Most central modules (by dependents)
| Module | Layer | Dependents | Risk |
|---|---|---|---|
| src/utils/logger.js | Shared Utility | 4 | [HIGH RISK] |
| src/services/orderService.js | Service | 2 | [MEDIUM RISK] |
| src/db/index.js | Data Access | 1 | [LOW RISK] |
| src/middleware/auth.js | Middleware | 1 | [LOW RISK] |
| src/models/order.js | Model/Schema | 1 | [LOW RISK] |
| src/routes/orders.js | API Route | 1 | [LOW RISK] |
| tools/logger.py | Script | 1 | [LOW RISK] |
| tools/seed_data.py | Script | 1 | [LOW RISK] |
| src/index.js | Entry | 0 | [LOW RISK] |
| src/services/orderService.test.js | Test | 0 | [LOW RISK] |

## All modules
| Module | Lang | Layer | Exports | In/Out | Risk |
|---|---|---|---|---|---|
| src/db/index.js | javascript | Data Access | 1 | 1/0 | [LOW RISK] |
| src/index.js | javascript | Entry | 1 | 0/3 | [LOW RISK] |
| src/middleware/auth.js | javascript | Middleware | 1 | 1/1 | [LOW RISK] |
| src/models/order.js | javascript | Model/Schema | 1 | 1/1 | [LOW RISK] |
| src/routes/orders.js | javascript | API Route | 1 | 1/1 | [LOW RISK] |
| src/services/orderService.js | javascript | Service | 1 | 2/3 | [MEDIUM RISK] |
| src/services/orderService.test.js | javascript | Test | 0 | 0/1 | [LOW RISK] |
| src/utils/logger.js | javascript | Shared Utility | 1 | 4/0 | [HIGH RISK] |
| tools/logger.py | python | Script | 2 | 1/0 | [LOW RISK] |
| tools/seed.py | python | Entry | 1 | 0/2 | [LOW RISK] |
| tools/seed_data.py | python | Script | 0 | 1/0 | [LOW RISK] |