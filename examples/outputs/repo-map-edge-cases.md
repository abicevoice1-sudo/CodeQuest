# CodeQuest repo map

- Modules: 11   Edges: 9
- Languages: python (4), typescript (7)
- Generated: 2026-10-10T00:21:01.004Z (codequest 1.0.0, deterministic static scan)

## Entry points
- pkg/cli.py (python)

## Most central modules (by dependents)
| Module | Layer | Dependents | Risk |
|---|---|---|---|
| src/services/userService.ts | Service | 2 | [MEDIUM RISK] |
| pkg/core.py | Domain | 1 | [LOW RISK] |
| pkg/helpers.py | Domain | 1 | [LOW RISK] |
| src/a.ts | Domain | 1 | [LOW RISK] |
| src/b.ts | Domain | 1 | [LOW RISK] |
| src/barrel.ts | Domain | 1 | [LOW RISK] |
| src/types.ts | Domain | 1 | [LOW RISK] |
| src/util.ts | Domain | 1 | [LOW RISK] |
| pkg/__init__.py | Domain | 0 | [LOW RISK] |
| pkg/cli.py | Entry | 0 | [LOW RISK] |

## All modules
| Module | Lang | Layer | Exports | In/Out | Risk |
|---|---|---|---|---|---|
| pkg/__init__.py | python | Domain | 0 | 0/0 | [LOW RISK] |
| pkg/cli.py | python | Entry | 1 | 0/2 | [LOW RISK] |
| pkg/core.py | python | Domain | 0 | 1/0 | [LOW RISK] |
| pkg/helpers.py | python | Domain | 1 | 1/0 | [LOW RISK] |
| src/a.ts | typescript | Domain | 1 | 1/1 | [LOW RISK] |
| src/b.ts | typescript | Domain | 1 | 1/1 | [LOW RISK] |
| src/barrel.ts | typescript | Domain | 1 | 1/2 | [LOW RISK] |
| src/index.ts | typescript | Domain | 1 | 0/3 | [LOW RISK] |
| src/services/userService.ts | typescript | Service | 1 | 2/0 | [MEDIUM RISK] |
| src/types.ts | typescript | Domain | 0 | 1/0 | [LOW RISK] |
| src/util.ts | typescript | Domain | 1 | 1/0 | [LOW RISK] |

## Circular imports (1)
- src/a.ts → src/b.ts → src/a.ts