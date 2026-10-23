# SterBot — Phase 1 Implementation Plan

**Source of truth (detailed design):** `sterbot-plan.md` (repo root, 869 lines). This plan locks the open decisions, applies review changes, and gives an ordered task list for implementation.

**Status:** Implementation-ready.
**Target:** Single Discord server, 10–50 active members, hard ceiling 50.
**Host:** bot-hosting.net (persistent file storage).
**Stack:** Node.js LTS, discord.js v17, JSON file storage, no database.

---

## Changes applied vs. `sterbot-plan.md`

| # | Location | Change | Reason |
|---|----------|--------|--------|
| 1 | §1 Stack; §20 deps | discord.js v14 → v17 | v14 is EOL/no security support; v17 is current |
| 2 | §8.8 store API | `store.getUser(userId)` is now a pure read returning `undefined` when absent (never creates, never schedules save). New `store.ensureUser(userId)` creates-with-defaults through `update`. | Fixes contradiction with §7.4 ("users who never interact have no record"); balance lookups must not create records |
| 3 | §8.2 startup load | Step 1 now also deletes a stale `data/data.json.tmp` left from a crashed write; last good `data.json` stays authoritative. | §8.5 promised cleanup on next startup but §8.2 never did it |
| 4 | §19 | All 13 open decisions locked — defaults accepted as written (drop amount hidden, daily public/cooldown ephemeral, 10-min claim window, overlapping drops allowed, prefixes earn activity, unknown prefixes silent, visible replies, starting balance 0, restarts lose drops, activity persisted across restarts, hourly backups keep 24, guild-only commands). | Decisions needed before code can be written |
| 5 | §7.4 / §9 | Lazy record creation happens only via `ensureUser` on real interactions (activity, command, gift receipt). `.balance`/leaderboard for unknown users show `startingBalance` without creating a record. | Consistency with change #2 |

---

## Constraints & boundaries

- One guild ID only (`discord.guildId`); commands guild-scoped; no DM support.
- Privileged intents required: `Guilds`, `GuildMessages`, `MessageContent`. Server Members and Presence off.
- Permissions: View Channels, Send Messages, Embed Links, Read Message History, Use Application Commands. No Administrator.
- Storage: single `data/data.json` with debounced atomic writes (temp + fsync + rename), rolling backups, refuse-to-overwrite-corrupt, bounded shutdown flush.
- Every tunable value in `config.js`, validated at startup; bot refuses to start on invalid config.
- No shop/items/roles/gambling/trading in Phase 1. Money has no sink yet (inflation accepted; sinks are Phase 2).

---

## Key risks

- **Data loss on crash:** debounced flush (default 3s) can lose up to a few seconds of activity/credits on `kill -9`. Accepted per plan; mitigated by hourly backups + shutdown flush.
- **Drops lost on restart:** active in-memory drops vanish on restart; old buttons reply "no longer active." Accepted for Phase 1; persistence deferred.
- **Inflation:** no economy sink in Phase 1; balances will climb. Documented; Phase 2 to add sinks.
- **discord.js v17 API drift:** verify intent/option names and REST command registration against v17 docs during implementation.

---

## Ordered implementation task list

1. Scaffold project: `package.json` (engines Node LTS, scripts `start`/`deploy`/`test`), `.gitignore`, `.env` example, `index.js`, `config.js`.
2. Implement `src/utils/logger.js`, `time.js`, `random.js`, `format.js`, `config-validate.js` (all §18 / §6.1 rules).
3. Implement `src/economy/store.js` (load, update queue, debounced flush, atomic write, backups, shutdown flush, `.tmp` cleanup, `getUser`/`ensureUser`/`snapshot`/`flushNow`/`start`/`stop`).
4. Implement `src/economy/wallet.js` (getBalance/credit/debit/transfer/canClaimDaily/claimDaily/getLeaderboard, error codes, reason tags).
5. Implement `src/economy/activity.js` (cooldown + silent credit).
6. Implement `src/economy/drops.js` (scheduler, weighted pick, post, claim atomicity, expiry, restart behavior).
7. Implement commands: `balance.js`, `daily.js`, `give.js`, `leaderboard.js` (shared slash+prefix logic per §16.3).
8. Implement `src/commands/index.js` registry; `src/events/ready.js`, `messageCreate.js`, `interactionCreate.js`, `shutdown.js`.
9. Implement `deploy-commands.js` (guild-scoped registration, v17 REST).
10. Wire `index.js`: load `.env`, validate config, start store, register events, connect client, lifecycle.
11. Write automated tests (node:test) for wallet, drops (weighted pick + claim), activity cooldown, time, format, config-validate, store atomic write + corrupt-file handling.
12. Manual test in private test server per §23.2; run pre-launch checklist §23.3.
13. Deploy to bot-hosting.net per §24; verify persistence via restart.

---

## Validation

- Tests: `npm test` (node:test). Key cases: weighted-pick distribution over 100k samples; double-claim only first succeeds; transfer on insufficient funds leaves both unchanged; daily boundary (exactly-at allowed, 1ms before rejected); activity first/in-cooldown/after-cooldown; each config-validation rule has a failing example; corrupt file copied to backup and startup refuses to overwrite.
- Lint/typecheck: none configured yet — add if the implementation agent introduces them; at minimum run `node --check` on all JS files and `npm test`.
- Deploy checklist §23.3 and §24: real IDs in `config.js`, `.env` not committed, Message Content Intent enabled, bot invited with correct scopes/permissions, `deploy-commands.js` run, persistence confirmed by restart, backup folder created, test drop posted/claimed.

---

## Open questions (none blocking)

None — all §19 defaults are accepted. Revisit drop amount visibility, overlapping drops, and economy sinks in Phase 2.

---

## Handoff

This agent (Kilo, Plan Mode) does not write source code or run mutating commands. To build the bot, switch to an implementation-capable agent and point it at this plan file plus `sterbot-plan.md`.
