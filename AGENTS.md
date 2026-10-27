# AGENTS.md

Guide for AI agents and contributors working in this repository.

## Project snapshot

- **What it is:** SterBot, a single-guild Discord economy bot for the "SterCoin" currency.
- **Stack:** Node.js >= 20, CommonJS (`require`/`module.exports`), discord.js v14, dotenv, JSON file storage.
- **No build step, no TypeScript, no database.** Data lives in `data/data.json` (gitignored).
- **Command surfaces:** every user-facing command supports both `/slash` and `.` prefix (configurable prefix).
- **Entry point:** `index.js`. Commands are registered in `src/commands/index.js`.

## Commands

```bash
npm install        # required on a clean checkout (node_modules is gitignored)
npm start          # node index.js
npm run deploy     # optional manual slash-command registration
npm test           # node --test
node debug_inv.js  # ad-hoc inventory smoke script (writes to a temp store)
```

Copy `.env.example` to `.env` and set:

- `DISCORD_TOKEN`
- `CLIENT_ID`
- `LOG_LEVEL` (optional, defaults to `info`)

Fill in the guild, channel, drop, and role IDs directly in the relevant `config/*.js` module. There is a single config layer: `config/index.js` just assembles the sections.

Slash commands are registered automatically on every startup via `guild.commands.set()` in `src/events/ready.js`; `npm run deploy` is only a fallback.

## Runtime flow

1. `index.js` loads `.env`, validates the assembled `config/` object through `src/utils/config-validate/`, checks `DISCORD_TOKEN` and `CLIENT_ID`, awaits `store.load()`, creates the client, wires events, and logs in.
2. `src/events/ready.js` registers slash commands, starts the backup timer, starts the role-expiry timer, and initializes/verifies random drops.
3. `src/events/messageCreate.js` filters bots/other guilds/webhooks/system messages, records drop activity, grants silent activity rewards, then routes `.pick` to `drops.pick()` or routes other prefix commands by name/alias.
4. `src/events/interactionCreate.js` handles chat-input commands only, applies channel restrictions, and calls `executeSlash()`.
5. `src/events/shutdown.js` stops timers, flushes the store, destroys the client, and exits.

## File map

| Path | Responsibility |
|---|---|
| `index.js` | Boot, validation, Discord client, event wiring |
| `config/index.js` | Assembles the section modules into one object |
| `config/core.js` | Discord IDs, channels, currency, command access, appeal URL |
| `config/economy.js` | Starting balance, activity, daily, gifts, leaderboard |
| `config/drops.js` | Drop scheduling, activity model, reward table |
| `config/games.js` | Coinflip/blackjack bets, payouts, house edge |
| `config/inventory.js` | Shop items and roles |
| `config/storage.js` | Persistence and backup settings |
| `deploy-commands.js` | Manual guild slash-command registration |
| `debug_inv.js` | Manual inventory debugging against a temp store |
| `src/commands/index.js` | Ordered command registry |
| `src/commands/*.js` | One module per command, slash + prefix handlers |
| `src/commands/shared/gambling.js` | Shared gambling limits, error text, and house-edge labels |
| `src/economy/store.js` | In-memory JSON store, process lock, debounced atomic flush, checksummed backups |
| `src/economy/wallet.js` | Balances, credit/debit/transfer, daily, leaderboard |
| `src/economy/activity.js` | Silent message-activity rewards |
| `src/economy/drops.js` | Random drop scheduler, activity model, claim flow |
| `src/economy/inventory.js` | Shop catalog, buy/sell/use/give item, role grants/expiry |
| `src/economy/games/common.js` | Shared bet validation, cooldowns, and house-edge math |
| `src/economy/games/coinflip.js` | Stateless coinflip game logic |
| `src/economy/games/blackjack.js` | Blackjack deck, hands, in-memory games, settlement |
| `src/events/ready.js` | Startup timers, command registration |
| `src/events/messageCreate.js` | Prefix commands, activity and drop observation |
| `src/events/interactionCreate.js` | Slash command dispatch |
| `src/events/guildMemberRemove.js` | Ban/kick DM with appeal link |
| `src/events/shutdown.js` | Graceful shutdown and store flush |
| `src/utils/config-validate/` | Per-section startup config validation |
| `src/utils/format.js` | `formatAmount`, `formatDuration` |
| `src/utils/logger.js` | Leveled JSON-context logger with token/secret redaction |
| `src/utils/random.js` | CSPRNG-backed `randomInt`, `randomFloat`, `weightedPick`, `shuffle` |
| `src/utils/command-rate-limit.js` | Per-user command window throttle |
| `src/utils/permissions.js` | Optional channel and role-based command gates |
| `src/utils/mentions.js` | Explicit-mention parsing for prefix commands |
| `src/utils/time.js` | `now`, cooldowns, random intervals |
| `*.test.js` | `node:test` unit tests at repo root |
| `.kilo/plans/*.md`, `sterbot-plan.md` | Historical design/implementation plans |
| `README.md` | Short user-facing setup notes |

`content.md` is an older snapshot of selected files and is **not** authoritative.

## Command module contract

Every file in `src/commands/` exports:

```js
module.exports = {
  name: "example",
  aliases: ["ex"], // optional
  slash: new SlashCommandBuilder()/* ... */,
  async executeSlash(interaction) {},
  async executePrefix(message, args) {},
};
```

Rules:

- Register the module in `src/commands/index.js`; otherwise it cannot be invoked or deployed.
- Implement **both** handlers. Share core logic instead of duplicating rules.
- Keep game/economy rules in `src/economy/`, not in command files.
- Add category/example metadata in `src/commands/help.js` (`COMMAND_META`); unmapped commands default to the "Info" category.
- User-facing failures are ephemeral (`MessageFlags.Ephemeral`) for slash commands; prefix replies should use `allowedMentions: { repliedUser: false }`.
- Suppress accidental pings with `allowedMentions: { parse: [] }` on public replies.

Current commands:

| Command | Aliases | Module |
|---|---|---|
| `balance` | `bal` | `balance.js` |
| `daily` | - | `daily.js` |
| `give` | `pay` | `give.js` |
| `leaderboard` | `lb` | `leaderboard.js` |
| `coinflip` | `cf` | `coinflip.js` |
| `blackjack` | `bj` | `blackjack.js` |
| `buy` | `shop` | `buy.js` |
| `inventory` | `inv` | `inventory.js` |
| `use` | - | `use.js` |
| `sell` | - | `sell.js` |
| `giveitem` | `gitem` | `giveitem.js` |
| `help` | - | `help.js` |
| `ping` | - | `ping.js` |

## Economy and persistence rules

- `store.data` shape: `{ schemaVersion: 1, createdAt, updatedAt, users: { [discordId]: user } }`.
- User records include `balance`, cooldowns, totals (`totalEarned`, `totalGifted`, `totalReceived`, `totalWagered`, `totalWon`, `totalLost`), `inventory`, and `ownedRoles`.
- Always use `store.ensureUser(userId)` outside a transaction and `store.ensureUserIn(data, userId)` inside `store.update(fn)`. When adding a user field, also backfill it in `ensureUserIn()` for old records.
- Mutate through `store.update(fn)` (or ensure the helper you call does) so a debounced flush is scheduled. Perform check-then-mutate sequences inside one `store.update` callback. Never write `data/data.json` directly.
- `ensureUserIn()` sanitizes legacy records: balances/stat counters become non-negative safe integers and missing cooldown/inventory/role fields are backfilled.
- `store.load()` takes an exclusive `data/data.json.lock` (stale locks from dead PIDs are reclaimed), writes through a `.tmp` file, fsyncs, then renames, and releases the lock on shutdown.
- Corrupt JSON is copied to `data/backups/corrupt-*.json`; when `storage.restoreFromBackup` is true the newest valid checksummed backup is restored automatically, otherwise startup exits. Newer `schemaVersion` values are refused.
- Periodic backups run from `ready.js`, get a `.sha256` sidecar, and are pruned to `storage.backupsToKeep`.
- Domain helpers return result objects such as `{ ok: false, code: "INSUFFICIENT_FUNDS", balance }`. Commands translate codes into friendly messages.
- Wallet amounts must be positive integers. Negative drop losses are clamped so balances never go below zero.
- Tests override `config.storage.path` **before** requiring `store.js`, so require order matters.

## Configuration rules

- All configuration lives in feature-specific `config/*.js` modules; there is one config layer and no local override file. Guild/channel/role IDs and the appeal URL are set directly in those modules. Never put secrets (tokens, keys) in them — those belong in `.env`.
- Any new tunable belongs in the relevant `config/*.js` module; add matching validation in its `src/utils/config-validate/*.js` counterpart. Startup aborts on validation errors.
- `gambling.houseEdge` (0–0.25, default `0.05`) is withheld from every winning gross return. `blackjack.houseEdge` optionally overrides it; `null` inherits the shared value.
- `config.commands.allowedChannelIds` restricts all commands when non-empty (both slash and prefix). `.pick` is intentionally handled before that check because drops have their own `drops.channelIds` and `drops.pickCooldownSeconds`.
- `config.commands.rateLimit` is a per-user window/max throttle (`max: 0` disables it). `commands.allowedRoleIds` and `commands.deniedRoleIds` are optional role gates; leave both empty to allow every member.
- `config.gift.maxPerDay` caps outgoing gifts per UTC day; `gift.minAccountAgeDays` blocks young sender accounts.
- All economy-critical randomness uses `src/utils/random.js` (`node:crypto`); do not reintroduce `Math.random()` for payouts, drops, or rewards. Tests can inject an RNG into `blackjack.start` and `coinflip.play`.
- `config.blackjack` is optional to the validator, but game code falls back to `config.gambling` limits/cooldown.
- Shop inventory lives in `config.inventory` and is fully validated at startup:
  - `items`: `{ id, name, description, price, sellPrice?, type: "item", useEffect?: { type: "coins", amount } }`
  - `roles`: adds `roleId` and `durationMs` (`null` = permanent)
  - Missing `sellPrice` falls back to 50% of `price`; negative/NaN prices are rejected.
  - Role purchases require the member, run pre-flight permission/hierarchy checks, await the grant, and refund on failure.

## Games, timers, and in-memory state

- **Coinflip:** stateless; cooldown stored on `lastFlipAt`; gross payout defaults to 2x total return and is configurable via `gambling.coinflipPayout` (1-2). `gambling.houseEdge` is then withheld, so the default 5% edge returns 1.9x on a win. Uses `node:crypto` randomness; `play(userId, bet, guess, { rng })` accepts a test RNG.
- **Blackjack:** active games live in an in-memory `Map` keyed by user ID. One game per user. `blackjack.start(userId, bet, { rng, onTimeout })` accepts a test RNG and a timeout callback. A server-side per-turn timer (`blackjack.timeoutMs`) settles abandoned games even if the reply or collector fails; graceful shutdown refunds active stakes. `settle()` treats any player total over 21 as a bust in every path. Winning payouts use `blackjack.houseEdge` when set, otherwise `gambling.houseEdge`.
- **Shared game helpers:** `src/economy/games/common.js` owns bet validation, cooldown math, and `applyHouseEdge`; keep game rules there or in the individual game modules, not in commands.
- **Drops:** in-memory `drops`, `channelActivity`, and `channelClocks` maps. A tick runs every `drops.tickSeconds`; quiet channels do not progress; per-user contributions are capped; claims and expiry edit/delete Discord messages. `.pick` is restricted to `drops.channelIds` and throttled by `drops.pickCooldownSeconds`. Negative table entries are filtered at runtime when `drops.allowNegativeAmounts` is false. Requires Send Messages, Embed Links, Read Message History, and Manage Messages where relevant.
- **Activity rewards:** silent, per-user global cooldown (`activity.cooldownSeconds`), ignored channels via `activity.ignoredChannelIds`.
- **Role expiry:** `inventory.startRoleExpiryTimer()` checks every 60 seconds and removes expired roles.
- Stop timers during shutdown; do not leave intervals that keep the process alive.

## Conventions

- CommonJS only; no transpilation or path aliases.
- 2-space indentation, double-quoted strings, semicolons. Match the surrounding file (some older files are compact).
- Prefer `node:fs` / `node:path` in new code (the codebase currently mixes both styles).
- Keep guild scoping explicit: every guild-scoped event must check `config.discord.guildId`.
- Use `formatAmount` / `formatDuration` for user-facing currency and time.
- Use `logger.info/warn/error` with context objects for operational logs; command handlers currently use `console.error` for caught failures.
- Tests use `node:test` + `node:assert`, with fake Discord message objects and no mocking library.
- Restore any mutated `config` values in `test.after()` so test files do not leak state.
- Add or extend a root-level `*.test.js` when changing game/economy/store/config behavior.

## Gotchas

- Drop images live in `assets/` and `drops.imagePath` must stay inside it; the runtime also allow-lists image extensions and resolves symlinks before uploading.
- `drops.imageUrl` and `drops.claimedText` exist in config but are currently unused; `expiredText` is optional and falls back to a hardcoded message.
- Slash commands are guild-scoped. The bot must be invited with both `bot` and `applications.commands` scopes.
- `data/` and `.env` are gitignored; `node_modules` is absent on a fresh clone, so run `npm install` before `npm test` or `npm start`.
- `debug_inv.js` creates a private `mkdtempSync` directory and removes it on exit.
- `store.start()` only marks the store as started; the backup timer is started separately in `ready.js`.
- `inventory.cleanupExpiredRoles()` collects expired entries synchronously from live data, then re-checks live state and mutates through `store.update()` per role. Role purchases and removals are serialized per user.
- `config/index.js` is loaded by nearly every module; changing config while processes run has no effect until restart.

## Change checklist

1. Add tunables to the relevant `config/*.js` module and validation to its `src/utils/config-validate/*.js` counterpart.
2. Put economy/game rules in `src/economy/`.
3. Add command modules and register them in `src/commands/index.js`.
4. Add help metadata in `src/commands/help.js`.
5. Add/extend tests and run `npm test`.
6. For persistence changes, update `ensureUser()` defaults/backfills and the store schema handling.
7. For runtime features, wire timers/events in `index.js` or `ready.js` and clean them up in `shutdown.js`.
