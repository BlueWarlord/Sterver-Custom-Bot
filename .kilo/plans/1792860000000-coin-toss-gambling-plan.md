# SterBot: Coin Toss Gambling — Plan

**Goal:** Add gambling to SterBot, starting with a coin toss game. No source or doc changes are made by this plan; it is implementation-ready for another agent.

## Context (from codebase review)

- Stack: Node.js >=20, discord.js v14, JSON file storage (`data/data.json`), no DB.
- Commands are dual-interface: every command has `slash` (SlashCommandBuilder) + `executeSlash(interaction)` + `executePrefix(message, args)`. Registered in `src/commands/index.js`; deployed via `deploy-commands.js` (guild-scoped, re-run when definitions change).
- Economy layer: `src/economy/wallet.js` (credit/debit/transfer/daily/leaderboard) over `src/economy/store.js` (debounced atomic JSON writes). All balance changes go through wallet.
- Existing user record: `{ balance, lastDailyAt, lastActivityRewardAt, totalEarned, totalGifted, totalReceived, createdAt }`.
- `config.js` holds every tunable value; `src/utils/config-validate.js` validates at startup.
- Test runner: `npm test` = `node --test`. No lint/typecheck scripts exist (plain JS).
- Gambling was explicitly deferred in Phase 1 (`sterbot-plan.md`); `games/` is intentionally absent until now.

## Decisions (all resolved)

| Topic | Decision |
|---|---|
| Payout | Even money, fair 50/50 coin. Bet `X`: win = net +`X` (stake returned + `X` profit), loss = net -`X`. No house edge. |
| Config | `config.gambling = { enabled: true, minBet: 1, maxBet: 1000, cooldownSeconds: 5 }`. All validated at startup. |
| Command | `/coinflip` with integer `amount` (min/max from config) and string choice `guess` (Heads/Tails). Prefix `.coinflip <amount> <heads|tails>`, case-insensitive, order-independent. Name `coinflip`, prefix alias `flip`. |
| Cooldown | Per-user, `gambling.cooldownSeconds` (default 5s). Cooldown checked and consumed inside one `store.update`. On cooldown: ephemeral reply with remaining time via `formatDuration`. |
| Stats | Per-user `totalWagered`, `totalWon` (profit), `totalLost`, `lastFlipAt`. Additive fields; `ensureUser` initializes them, old records default to 0. `schemaVersion` stays `1`. |
| Visibility | Flip result (coin side, win/loss, amount, new balance) public in channel. Failures (disabled, invalid bet, insufficient funds, cooldown) ephemeral. |
| Logic location | New module `src/economy/games/coinflip.js` exporting `play(userId, bet, guess)`. Both slash and prefix entry points call the same `play` and only format output. Game module does its own atomic `store.update` (debit + credit + stats) — does NOT use `wallet.credit/debit` (those add earning-reason side effects). Logging reasons `coinflip_win` / `coinflip_loss` via existing logger. |

## Implementation tasks (in order)

1. `config.js` — add `gambling: { enabled: true, minBet: 1, maxBet: 1000, cooldownSeconds: 5 }`.
2. `src/utils/config-validate.js` — add rules: `gambling.enabled` boolean; `gambling.minBet` integer >= 1; `gambling.maxBet` integer >= `minBet`; `gambling.cooldownSeconds` integer > 0.
3. `src/economy/store.js` — `ensureUser` initializes `totalWagered: 0`, `totalWon: 0`, `totalLost: 0`, `lastFlipAt: null`.
4. `src/economy/games/coinflip.js` (new) — `play(userId, bet, guess)`:
   - Validate: `gambling.enabled`; bet is integer, `minBet <= bet <= maxBet`; guess is heads/tails.
   - One `store.update`: ensure user, cooldown check vs `lastFlipAt`, `balance >= bet`, then `balance -= bet`; on win `balance += bet * 2`; update `totalWagered += bet`, `totalWon += bet` (win) or `totalLost += bet` (loss); set `lastFlipAt = now()`.
   - Return `{ ok, code?, won?, result, guess, bet, balance, totalWagered, totalWon, totalLost, remainingMs? }`. Error codes: `GAMBLING_DISABLED`, `INVALID_BET`, `BET_TOO_SMALL`, `BET_TOO_LARGE`, `INSUFFICIENT_FUNDS`, `ON_COOLDOWN`.
5. `src/commands/coinflip.js` (new) — command module: slash builder (`amount` integer min/max from config, `guess` string choices Heads/Tails) + prefix parsing (extract integer bet + heads/tails token from args, either order). Slash: `executeSlash`; prefix: `executePrefix`. Both call `coinflip.play` and format: public result message; ephemeral errors/cooldowns.
6. `src/commands/index.js` — add `coinflip` to the exported array.
7. Tests (`node --test`): `coinflip.play` win path, loss path, insufficient funds, cooldown enforcement, invalid bet, disabled gambling, guess case-insensitivity/order-independence; config-validate new rules; `ensureUser` new fields default to 0.
8. Re-run `node deploy-commands.js` so the new slash command registers (requires real `.env`).

## Verification

- `npm test` (`node --test`) must pass.
- Manual (private test server): `/coinflip 25 heads` and `.coinflip tails 25` both work; result public, new balance correct; betting > balance rejected with current balance; bet below min/above max rejected; second flip within cooldown replies ephemerally with time remaining; gambling disabled (config toggle) rejects; balances and stats persist across restart.
- Note: no lint/typecheck script exists in `package.json`; none to run.

## Out of scope for this plan

- House edge, multipliers, bet caps beyond `minBet`/`maxBet`, daily/weekly gambling loss limits, gambling leaderboard, blackjack or other games (Phase 3 in `sterbot-plan.md`).
- Documentation updates (`sterbot-plan.md`, `README.md`) — flagged as follow-up for the implementation agent.

## Open questions

None. All decisions resolved; plan is implementation-ready.
