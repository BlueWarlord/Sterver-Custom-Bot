# Inventory System Plan

## Goal
Add an inventory system to Sterbot for purchasing equipment items and server roles with SterCoins, viewing/trading/selling them, and assigning Discord roles for role purchases.

## Decisions
- Catalog defined in `config.js` under `config.inventory` with `items` (equipment) and `roles` (server roles). Each entry: `id`, `name`, `description`, `price`, `sellPrice`, `type` (`item`/`role`), and for roles `roleId` (Discord role ID) plus `durationMs` (`null` = permanent).
- User records gain `inventory: { [itemId]: number }` and `ownedRoles: { [roleId]: { expiresAt: number|null } }`.
- No gameplay effects; items/roles are cosmetic/status only.
- Commands: `buy`, `inventory`, `use` (consume/use item), `sell`, `giveitem` (transfer item quantity).
- Role purchases auto-assign the Discord role via guild member; temporary roles tracked with expiry and removed by a periodic timer plus on command use.
- Sell price defaults to 50% of purchase price if not specified.

## Affected Files
- `config.js`: add `inventory` section.
- `src/economy/store.js`: `ensureUser` initializes `inventory`/`ownedRoles`; migration for existing users.
- New `src/economy/inventory.js`: catalog helpers, buy/sell/use/give, role expiry checks, role assignment.
- New commands: `src/commands/buy.js`, `inventory.js`, `use.js`, `sell.js`, `giveitem.js`.
- `src/commands/index.js`: register new commands.
- `src/events/ready.js`: start role-expiry timer.
- `src/events/shutdown.js`: clear timer.
- Tests: `inventory.test.js`.

## Data Flow
1. `buy` validates catalog entry, debits coins via wallet, increments inventory or grants role.
2. Role grant assigns Discord role and records ownership/expiry.
3. `inventory` lists owned items/roles with expiry.
4. `use` consumes one quantity or activates role (no effect beyond ownership).
5. `sell` removes quantity and credits coins.
6. `giveitem` transfers quantity between users.
7. Expiry timer removes expired Discord roles and cleans records.

## Failure Modes
- Insufficient funds -> reject.
- Unknown item/role -> reject.
- Role assignment fails (missing permissions/role) -> refund and reject.
- Temporary role expired -> remove role and record.
- Selling more than owned -> reject.

## Validation
- Run `npm test`.
- Manual: buy item/role, view inventory, sell, transfer, expiry removal.

## Open Questions
- None. Implementation requires an implementation-capable agent.