# SterBot: SterCoin Economy Bot — Full Plan (Phase 1)

**Status:** Planning document. No code has been written.
**Target:** Single Discord server, 10 to 50 concurrently active members (hard ceiling 50).
**Host:** bot-hosting.net (persistent file storage confirmed).
**Stack:** Node.js (LTS), discord.js v14, JSON file storage, no database.

---

## 1. Goals and Non-Goals

### 1.1 Goals (Phase 1)
- A working economy skeleton that users can earn, hold, check, and give SterCoins with.
- Two ways to earn passively (message activity, random drops) and one active earn (daily).
- Every value a human might want to tune lives in `config.js`. Nothing tunable is hardcoded.
- Both slash commands (`/balance`) and prefix commands (`.balance`) for every user-facing command.
- Data is never silently lost or corrupted by a crash, restart, or concurrent command.
- Easy to extend in later phases (shop, roles, blackjack, trading) without rewriting Phase 1.

### 1.2 Non-Goals (Phase 1)
- No shop, items, or item effects.
- No role purchases.
- No blackjack or any other gambling.
- No trading between members.
- No gift or trade fees.
- No in-Discord admin commands. Changes are made by editing `config.js` (and `data.json` only in emergencies).
- No multi-server support. The bot is locked to one guild ID.
- No web dashboard, no external database, no analytics.

---

## 2. Confirmed Decisions (from planning conversation)

| Topic | Decision |
|---|---|
| Currency name | SterCoin (plural SterCoins) |
| Activity reward | One reward per 5 minutes per user, silent (no message, reaction, or DM) |
| Daily reward | Low amount, once per 24 hours, configurable |
| Random drops | General chat only, interval randomized 3 to 25 minutes, first click claims |
| Gambling | Deferred (blackjack later) |
| Items and roles | Deferred (no items or roles in Phase 1) |
| Gift and trade fees | None |
| Storage | JSON file, persistent on bot-hosting.net |
| Admin tools | None in Discord. All config through `config.js` |
| Command style | Slash and `.` prefix |
| Server size | 10 to 50 active members |
| Configurability | Every numeric value, name, channel, and toggle is in `config.js` |

---

## 3. Discord Application Setup

### 3.1 Developer Portal
1. Create an application at the Discord Developer Portal.
2. Under **Bot**:
   - Create the bot user.
   - Copy the **Token** into `.env` as `DISCORD_TOKEN`. Never commit it.
   - Enable the **Message Content Intent** (privileged). Required for `.` prefix commands to read message text.
   - Server Members Intent: not required in Phase 1 (we fetch users on demand). Leave off unless a later phase needs it.
   - Presence Intent: off.
3. Under **General Information**, copy the **Application ID** into `.env` as `CLIENT_ID`.

### 3.2 Gateway Intents (in code)
- `Guilds`: required to receive guild and channel data.
- `GuildMessages`: required for the `messageCreate` event (activity rewards and prefix commands).
- `MessageContent`: required to read text of messages for `.` prefix parsing.

Note: Activity rewards only count messages. They do not inspect content. Without `MessageContent`, `messageCreate` would still fire, but prefix commands would not work, so we keep it enabled.

### 3.3 Bot Invite Permissions
Scopes: `bot`, `applications.commands`.

Minimum bot permissions:
- View Channels
- Send Messages
- Embed Links
- Read Message History (needed to edit the drop message when it expires)
- Use Application Commands

Not needed in Phase 1: Manage Roles (added in Phase 2 for role purchases), Manage Messages, Administrator.

Invite URL is generated in the Developer Portal under OAuth2 → URL Generator with the scopes and permissions above.

### 3.4 Channel Setup
- The bot must be able to see and send messages in the general chat channel (the one set in `channels.generalChatId`).
- Drops are only posted there. The bot does not need access to other channels for drops, but it does need to respond to commands wherever they are used.

---

## 4. Environment and Secrets

### 4.1 `.env` (never committed)
```
DISCORD_TOKEN=your-bot-token
CLIENT_ID=your-application-id
```

### 4.2 Guild ID
The guild (server) ID is not secret but is needed for guild-scoped command registration. It is stored in `config.js` under `discord.guildId`, so it is editable without touching secrets.

### 4.3 `.gitignore`
```
node_modules/
.env
data/data.json
data/data.json.tmp
data/backups/
```

---

## 5. Project Structure (Phase 1)

```
sterbot/
├── index.js                     # Entry point: loads config, store, commands, events, starts bot
├── config.js                    # ALL tunable values (see section 6)
├── deploy-commands.js           # Registers slash commands to the guild (run manually on change)
├── .env                         # Secrets (not committed)
├── .gitignore
├── package.json
├── README.md                    # Setup and run instructions
├── data/
│   ├── data.json                # Live economy data (created on first run)
│   ├── data.json.tmp            # Transient write file (only exists during a save)
│   └── backups/                 # Rolling backups of data.json
└── src/
    ├── commands/
    │   ├── index.js             # Registry: exports all command definitions
    │   ├── balance.js           # /balance and .balance
    │   ├── daily.js             # /daily and .daily
    │   ├── give.js              # /give and .give
    │   └── leaderboard.js       # /leaderboard and .leaderboard
    ├── events/
    │   ├── ready.js             # Startup: log, start drop scheduler, start backup timer
    │   ├── messageCreate.js     # Activity rewards + prefix command routing
    │   ├── interactionCreate.js # Slash command routing + drop claim button routing
    │   └── shutdown.js          # SIGINT / SIGTERM: flush store before exit
    ├── economy/
    │   ├── store.js             # Load, queue, debounced atomic save, backup rotation
    │   ├── wallet.js            # Balance reads, credits, debits, transfers, daily checks
    │   ├── activity.js          # Activity reward logic (cooldown check + credit)
    │   └── drops.js             # Drop table, weighted pick, drop lifecycle, claim logic
    └── utils/
        ├── config-validate.js   # Startup validation of config.js
        ├── logger.js            # Timestamped console logging with levels
        ├── format.js            # Currency formatting, number formatting, time formatting
        ├── time.js              # Cooldown math, duration formatting, random interval
        └── random.js            # Random integer and weighted pick helpers
```

Note: `games/` is intentionally absent until gambling is scheduled. `shop/` and `roles/` are also absent until Phase 2.

---

## 6. Configuration (`config.js`)

Every value below is editable. Nothing tunable is hardcoded anywhere else in the code.

```js
module.exports = {
  discord: {
    guildId: "PASTE_GUILD_ID",          // Required. Server ID for guild-scoped commands.
  },

  channels: {
    generalChatId: "PASTE_CHANNEL_ID",  // Required. Drops post here.
  },

  currency: {
    name: "SterCoin",
    plural: "SterCoins",
    emoji: "🪙",
    thousandsSeparator: ",",            // "," gives 1,250. Set "" for 1250.
  },

  commands: {
    prefix: ".",                        // Prefix for legacy commands.
  },

  economy: {
    startingBalance: 0,                 // Balance for a user the first time they appear.
  },

  activity: {
    enabled: true,
    cooldownSeconds: 300,               // 5 minutes per user.
    amountMin: 1,                       // Inclusive. Integer.
    amountMax: 3,                       // Inclusive. Integer.
    ignoredChannelIds: [],              // Messages in these channels earn nothing. Optional.
  },

  daily: {
    enabled: true,
    amountMin: 20,
    amountMax: 50,
    cooldownHours: 24,
  },

  drops: {
    enabled: true,
    intervalMinMinutes: 3,              // Shortest gap between drops.
    intervalMaxMinutes: 25,             // Longest gap between drops.
    claimWindowMinutes: 10,             // How long a drop can be claimed before it expires.
    table: [                            // Weighted. Higher weight = more likely.
      { weight: 70, min: 5,  max: 15 },
      { weight: 25, min: 16, max: 40 },
      { weight: 5,  min: 41, max: 100 },
    ],
    embedTitle: "A SterCoin drop appeared!",
    embedDescription: "First to claim it gets the SterCoins.",
    claimButtonLabel: "Claim",
    expiredText: "This drop expired.",
  },

  gift: {
    enabled: true,
    minAmount: 1,
    maxAmount: null,                    // null = no cap per transfer.
    allowSelf: false,
    allowBots: false,
  },

  leaderboard: {
    size: 10,                           // Entries shown.
  },

  storage: {
    path: "data/data.json",
    flushIntervalMs: 3000,              // Debounce window for saves. See section 9.
    backupsEnabled: true,
    backupIntervalMinutes: 60,
    backupsToKeep: 24,                  // 24 hourly backups = 1 day of history.
  },
};
```

### 6.1 Config Validation (runs at startup, before anything connects)
The bot refuses to start and prints the exact key that is wrong if any of these fail:

- `discord.guildId` is set and is a numeric string.
- `channels.generalChatId` is set, numeric, and not the placeholder text.
- `currency.name` and `currency.plural` are non-empty strings.
- `commands.prefix` is a non-empty string with no spaces.
- `economy.startingBalance` is a non-negative integer.
- `activity.cooldownSeconds` is a positive integer.
- `activity.amountMin` and `activity.amountMax` are non-negative integers and `amountMin <= amountMax`.
- `activity.ignoredChannelIds` is an array of numeric strings.
- `daily.amountMin` and `daily.amountMax` are non-negative integers and `amountMin <= amountMax`.
- `daily.cooldownHours` is a positive number.
- `drops.intervalMinMinutes` and `drops.intervalMaxMinutes` are positive and `min <= max`.
- `drops.claimWindowMinutes` is positive and shorter than `intervalMinMinutes` is not required, but a warning is logged if the claim window is longer than the minimum interval (overlapping drops are allowed but noted).
- `drops.table` is a non-empty array. Each entry has `weight > 0` (integer), `min` and `max` non-negative integers, `min <= max`.
- `drops.table` total weight is greater than 0.
- `gift.minAmount` is a positive integer. `gift.maxAmount` is `null` or an integer `>= minAmount`.
- `leaderboard.size` is an integer between 1 and 25.
- `storage.flushIntervalMs` is an integer of at least 500.
- `storage.backupIntervalMinutes` and `storage.backupsToKeep` are positive integers.

Environment validation (also at startup):
- `DISCORD_TOKEN` exists and is non-empty.
- `CLIENT_ID` exists and is numeric.

---

## 7. Data Model (`data/data.json`)

### 7.1 Top-level shape
```json
{
  "schemaVersion": 1,
  "createdAt": "2026-10-23T12:00:00.000Z",
  "updatedAt": "2026-10-23T12:34:56.000Z",
  "users": {
    "123456789012345678": {
      "balance": 245,
      "lastDailyAt": 1729680000000,
      "lastActivityRewardAt": 1729681000000,
      "totalEarned": 1020,
      "totalGifted": 40,
      "totalReceived": 15,
      "createdAt": 1729600000000
    }
  }
}
```

### 7.2 Field rules
- User keys are Discord user IDs as strings.
- `balance`: integer, never negative. Enforced by the wallet layer, not just by UI.
- `lastDailyAt`: epoch milliseconds, or `null` if never claimed.
- `lastActivityRewardAt`: epoch milliseconds, or `null`. Persisted so a restart does not give a free reward.
- `totalEarned`, `totalGifted`, `totalReceived`: lifetime counters for leaderboard stats and debugging. Not used for gating.
- `createdAt`: epoch milliseconds when the user first appeared.
- All timestamps use epoch milliseconds (UTC) to avoid timezone bugs.

### 7.3 Schema versioning
- `schemaVersion` is `1` in Phase 1.
- On load, if `schemaVersion` is missing or lower than the code expects, a migration runs (none exist yet) and a backup is written before migrating.
- If `schemaVersion` is higher than the code knows, the bot refuses to start (prevents an old bot from damaging newer data).

### 7.4 Users are created lazily
- A user record is created the first time the bot sees them (activity, command, or receiving a gift).
- Users who never interact have no record. They show as nonexistent, which is correct.
- Leaving the server does not delete the record. Balance is preserved.

---

## 8. Store Layer (`src/economy/store.js`)

This is the most important file for data safety.

### 8.1 Responsibilities
- Hold the live economy object in memory.
- Serialize all writes through a single queue.
- Persist to disk with atomic writes.
- Debounce saves so many quick changes produce one disk write.
- Rotate backups.
- Refuse to overwrite a file it could not parse.

### 8.2 Startup load
1. Ensure `data/` and `data/backups/` exist. Create them if missing.
2. If `data/data.json` does not exist, create a fresh structure in memory and save it.
3. If it exists, read and `JSON.parse` it.
4. If parse fails:
   - Do NOT overwrite the file.
   - Copy it to `data/backups/corrupt-<timestamp>.json`.
   - Log a fatal error and exit.
   - Human decides what to do (restore a backup, or fix the file).
5. Validate the structure (top-level keys, `users` is an object). Fail the same way on invalid structure.
6. Run migrations if needed (section 7.3).

### 8.3 Mutation pattern
- All changes go through a function like `store.update(fn)` where `fn` receives the live object and mutates it.
- `update` is synchronous on the in-memory object (JavaScript is single-threaded, so there is no race inside a single synchronous block).
- After mutation, `store` marks itself dirty and schedules a flush.
- Any multi-step operation (for example, a transfer that debits one user and credits another) must happen inside one `update` call so it is all-or-nothing in memory.
- Validation happens before any mutation. If a check fails, the function returns an error and nothing changes.

### 8.4 Save queue and debounce
- Each `update` call sets `dirty = true` and starts a timer if one is not already running.
- The timer fires after `storage.flushIntervalMs` and calls `flush()`.
- `flush()` is serialized: if a flush is already in progress, the next one waits for it to finish. No two writes run at the same time.
- Updates during a flush mark dirty again and schedule another flush after the current one.

Why debounce: with up to 50 active users, the activity reward can fire many times per minute. Writing the file on every change would be wasteful and risky. One write every few seconds is plenty.

### 8.5 Atomic write procedure
1. Serialize the object with `JSON.stringify(data, null, 2)`.
2. Write the string to `data/data.json.tmp`.
3. `fsync` the temp file (ensures bytes are on disk, not just in OS cache).
4. Rename `data.json.tmp` to `data.json` (atomic on the same filesystem).
5. Update `updatedAt` before serializing.

If the process dies during step 2 or 3, the old `data.json` is intact. If it dies between 3 and 4, a `.tmp` file remains and the next startup should treat the valid `data.json` as authoritative and delete the stray `.tmp`.

### 8.6 Shutdown flush
- On `SIGINT` and `SIGTERM`, the store cancels its timer, waits for any in-progress flush, performs a final flush if dirty, then exits.
- Give it a bounded time (for example 5 seconds). If it hangs, exit anyway and log it.

### 8.7 Backups
- A timer runs every `storage.backupIntervalMinutes`.
- It copies the current `data.json` to `data/backups/data-<timestamp>.json`.
- It keeps only the newest `storage.backupsToKeep` files and deletes older ones.
- Backups are skipped if `data.json` has not changed since the last backup (compare `updatedAt`).
- A backup is also taken before any schema migration.

### 8.8 Public API (what other modules call)
- `store.getUser(userId)`: returns the user record, creating it with defaults if missing. This is a read but may create a record, so it goes through `update` internally when creation is needed.
- `store.update(fn)`: runs a mutation and schedules a save.
- `store.snapshot()`: returns a deep copy for read-only use (leaderboard, admin debugging). Prevents accidental mutation from read paths.
- `store.flushNow()`: forces an immediate save (used during shutdown).
- `store.start()` and `store.stop()`: lifecycle hooks used by `index.js`.

---

## 9. Wallet Layer (`src/economy/wallet.js`)

All balance changes go through this module. Commands and events never touch `store` balances directly.

### 9.1 Functions
- `getBalance(userId)`: returns integer balance.
- `credit(userId, amount, reason)`: adds `amount` (positive integer). Updates `balance` and `totalEarned` if the reason is an earning reason.
- `debit(userId, amount, reason)`: subtracts `amount`. Fails with `INSUFFICIENT_FUNDS` if balance would go negative. Never partially debits.
- `transfer(fromId, toId, amount)`: debit and credit in one `store.update` call. Fails the whole operation if either check fails.
- `canClaimDaily(userId, now)`: returns `{ ok, remainingMs }`.
- `claimDaily(userId, now)`: checks cooldown, credits a random amount in `[daily.amountMin, daily.amountMax]`, sets `lastDailyAt`.
- `getLeaderboard(size)`: returns top users by balance, excluding zero-balance users, sorted descending, ties broken by `createdAt` (older first).

### 9.2 Reason tags (for logging and stats)
Used in the logger, not stored per transaction in Phase 1:
- `activity`
- `daily`
- `drop`
- `gift_sent`
- `gift_received`

### 9.3 Error codes
Returned as values, not thrown, so command handlers can present friendly messages:
- `INSUFFICIENT_FUNDS`
- `INVALID_AMOUNT`
- `SELF_TRANSFER`
- `BOT_TARGET`
- `ON_COOLDOWN`
- `AMOUNT_OVER_CAP`
- `AMOUNT_UNDER_MIN`

### 9.4 Amount rules
- Must be an integer. Decimals are rejected, not rounded.
- Must be positive.
- Must not exceed `Number.MAX_SAFE_INTEGER`. Practically unreachable but cheap to check.

---

## 10. Activity Rewards (`src/economy/activity.js` and `messageCreate.js`)

### 10.1 Trigger conditions (all must be true)
- `activity.enabled` is `true`.
- Message is in a guild (not a DM).
- Message is in the configured guild (`discord.guildId`). Other guilds are ignored.
- Author is not a bot.
- Author is not a webhook (`message.webhookId` is null).
- Channel is not in `activity.ignoredChannelIds`.
- Message is not a system message.

Prefix commands still count as activity. A `.balance` message can earn activity, which is intentional and simple. If this becomes an exploit, a later config flag can exclude command messages.

### 10.2 Cooldown logic
1. Get the user record.
2. If `lastActivityRewardAt` is `null`, or `now - lastActivityRewardAt >= cooldownSeconds * 1000`:
   - Pick a random integer in `[activity.amountMin, activity.amountMax]`.
   - In one `store.update`: credit the amount and set `lastActivityRewardAt = now`.
3. Otherwise do nothing.

The cooldown is per user, not per channel, not per server.

### 10.3 Silence
- No reply, no reaction, no DM, no typing indicator.
- Errors are logged to the console only.

### 10.4 Performance
- The handler does one lookup and at most one `store.update`. No Discord API calls. Negligible cost even at 50 users chatting.

---

## 11. Daily Reward (`src/commands/daily.js`)

### 11.1 Behavior
- Check `lastDailyAt`.
- If never claimed, or `now - lastDailyAt >= cooldownHours * 3600 * 1000`: award a random amount in `[daily.amountMin, daily.amountMax]` and set `lastDailyAt = now`.
- If on cooldown: reply with the remaining time in a human format, for example "You can claim again in 5h 12m."

### 11.2 Response
- Visible reply (not ephemeral) on success, so people see the reward. Example: "You claimed 34 🪙 SterCoins. New balance: 279 SterCoins."
- Ephemeral on cooldown, so the channel is not cluttered. This is a decision to confirm in section 19.

### 11.3 Disabled state
- If `daily.enabled` is `false`, the command replies with a short "Daily rewards are disabled" message and the command still registers (so it does not break existing command lists).

---

## 12. Gifting (`src/commands/give.js`)

### 12.1 Syntax
- Slash: `/give user:@someone amount:25`
- Prefix: `.give @someone 25`
- Prefix parsing: first mention is the recipient, the next token is the amount. Reject if no mention or no valid number.

### 12.2 Validation (in order, first failure returns)
1. `gift.enabled` is true.
2. Target is provided.
3. Target is not the sender (unless `gift.allowSelf` is true).
4. Target is not a bot (unless `gift.allowBots` is true).
5. Amount is a positive integer.
6. Amount is at least `gift.minAmount`.
7. Amount is at most `gift.maxAmount` if set.
8. Sender balance is at least the amount.

### 12.3 Execution
- `wallet.transfer(sender, target, amount)` runs as one `store.update`.
- Reply is visible in the channel: "@sender gave @target 25 🪙 SterCoins."

### 12.4 Notes
- No fee in Phase 1 (`gift.feePercent` is intentionally not in config yet to avoid clutter; add when wanted).
- The recipient is not pinged beyond the mention in the reply. The reply mentions them, which notifies them. This is the normal Discord behavior.

---

## 13. Leaderboard (`src/commands/leaderboard.js`)

- Shows the top `leaderboard.size` users by balance, excluding zero balances.
- Format: rank, mention, balance. Example line: `1. @Name, 1,250 🪙 SterCoins`.
- Uses `allowedMentions: { parse: [] }` so mentions render as names without pinging anyone.
- If no users have a balance, reply "Nobody has any SterCoins yet."
- Visible in channel.

---

## 14. Balance (`src/commands/balance.js`)

- `/balance` shows the caller's balance. `/balance user:@someone` shows another user's balance.
- `.balance` and `.balance @someone` behave the same.
- Visible in channel.
- If the target has no record, show `startingBalance` (the value they would have).
- Bots are rejected as a target.

---

## 15. Random Drops (`src/economy/drops.js`)

This is the most logic-heavy feature. Read this section carefully.

### 15.1 Scheduler
- On `ready`, if `drops.enabled`, call `scheduleNextDrop()`.
- `scheduleNextDrop()` picks a random delay in milliseconds between `intervalMinMinutes * 60000` and `intervalMaxMinutes * 60000` (uniform), sets a `setTimeout`, and stores the handle.
- When the timer fires, `postDrop()` runs, then `scheduleNextDrop()` is called again. The next interval starts after the current drop is posted, not after it is claimed or expired.
- Drops do not stack. The next timer is not scheduled until the current drop is posted. Expiry of a previous drop does not block the next one, but the scheduler is strictly sequential.

Clarification on overlap: because the next drop is scheduled after posting, and the minimum gap is 3 minutes, a drop can overlap with the previous one if `claimWindowMinutes` is longer than the gap. This is allowed. Each drop has its own ID, its own message, and its own claim state. Overlap is logged as a warning at startup if `claimWindowMinutes > intervalMinMinutes`.

### 15.2 Weighted amount selection
1. Sum all `weight` values in `drops.table`.
2. Pick a random integer `r` in `[1, total]`.
3. Walk the table, subtracting each weight from `r`. The first entry where `r` drops to 0 or below wins.
4. Within that entry, pick a random integer in `[min, max]` inclusive.

This is the probability distribution the user asked for. Default table gives 70% chance of 5 to 15, 25% of 16 to 40, 5% of 41 to 100.

### 15.3 Drop posting
1. Generate a drop ID (a short random string or incrementing integer).
2. Create an in-memory record:
   ```
   { id, amount, messageId, channelId, createdAt, expiresAt, claimed: false, claimedBy: null, timeout }
   ```
   The amount is decided at posting time and stored. Players cannot influence it.
3. Build an embed using `drops.embedTitle` and `drops.embedDescription`. The amount is NOT shown in the embed. Hidden amount makes claiming a surprise. (Decision to confirm in section 19: show or hide the amount.)
4. Build a button with customId `drop:<id>` and label `drops.claimButtonLabel`.
5. Send to `channels.generalChatId`.
6. Store the message ID on the drop record.
7. Set an expiry timer for `claimWindowMinutes`.

If sending fails (missing channel, missing permission), log the error, do not credit anything, and still schedule the next drop.

### 15.4 Claim flow
When a user clicks the button, `interactionCreate` routes it to `drops.claim(interaction)`.

1. Parse the drop ID from the customId. If the ID is unknown (old drop, after restart), reply ephemerally: "This drop is no longer active."
2. Check `claimed`. If already claimed, reply ephemerally: "Already claimed."
3. Check that the current time is before `expiresAt`. If expired, reply ephemerally and mark the drop as expired.
4. Set `claimed = true` and `claimedBy = userId` synchronously, before any `await`. This is the atomicity guarantee: Node runs one JavaScript block at a time, so two clicks cannot both pass step 2 and step 4 in the same tick. The second click always sees `claimed = true`.
5. Credit the drop amount through `wallet.credit` inside `store.update`.
6. Clear the expiry timer.
7. Edit the original drop message: disable the button, update the embed to say "Claimed by @user" (and optionally show the amount here, after claim).
8. Reply to the claimer ephemerally: "You claimed X 🪙 SterCoins!" Ephemeral keeps the channel clean.

The claim must acknowledge the interaction within 3 seconds, so step 4 and 5 happen first, then the Discord API calls. If edits are slow, defer the reply.

### 15.5 Expiry flow
1. When the expiry timer fires, if `claimed` is false:
   - Set `expired = true`.
   - Edit the message: disable the button, embed says `drops.expiredText`.
   - Do not credit anything.
2. Clean up the in-memory drop record after a short grace period (for example 1 minute) so a late click gets "no longer active" instead of a crash.

### 15.6 Restart behavior
- Active drops are in memory only. If the bot restarts during a live drop, the drop is gone.
- The old message still shows a button. Clicking it gets "This drop is no longer active."
- No money is lost or duplicated. Acceptable for Phase 1.
- Optional later improvement: persist active drops in `data.json`. Not in Phase 1 to keep the save surface small.

### 15.7 Channel edge cases
- If `generalChatId` is not found, or the bot lacks permission, log an error and reschedule the next drop.
- If the channel is not a text channel, treat as misconfiguration and log at startup during validation (the bot can fetch the channel on ready and verify it).

### 15.8 Startup check for drop channel
On `ready`, fetch `channels.generalChatId`. Verify it exists, is in the configured guild, and is text-based. Log a clear warning if not. The bot still starts so the economy works, but drops are paused until fixed.

---

## 16. Command Registration (`deploy-commands.js`)

- A standalone script, run manually with `node deploy-commands.js` whenever a command's name, description, or options change.
- Registers commands to the guild (`discord.guildId`) using `Routes.applicationGuildCommands`. Guild commands update instantly. Global commands can take up to an hour.
- Reads `CLIENT_ID` and `DISCORD_TOKEN` from `.env`.
- Removes stale guild commands by overwriting the full list (the PUT replaces all).
- Not run automatically on bot startup, to avoid rate-limit hits and to keep startup fast.

### 16.1 Slash command definitions (Phase 1)

| Command | Options | Notes |
|---|---|---|
| `/balance` | `user` (optional, User) | Shows own or other user's balance |
| `/daily` | none | Claims daily reward |
| `/give` | `user` (required, User), `amount` (required, Integer, min 1) | Gifts SterCoins |
| `/leaderboard` | none | Shows top users |

Descriptions are short, lowercase-ish, and shown in the Discord picker.

### 16.2 Prefix command parsing
- Message must start with `commands.prefix` (default `.`).
- Ignore messages where the text after the prefix is empty.
- Split on whitespace. First token is the command name, lowercased.
- Unknown command names are ignored silently (no "unknown command" reply, to avoid noise in general chat).
- Arguments are parsed per command (for example `.give @user 25`).

### 16.3 Command module shape
Each file in `src/commands/` exports:
```
{
  name: "balance",
  slash: SlashCommandBuilder definition,
  async executeSlash(interaction),
  async executePrefix(message, args),
}
```
Both entry points call the same underlying logic function so behavior matches. Example: `executeSlash` and `executePrefix` both call `getBalanceReply(userId, targetId)` which returns a structured result. Each entry point formats it for its medium.

### 16.4 Reply format consistency
- Slash replies: `interaction.reply` or `interaction.editReply`.
- Prefix replies: `message.reply` with `allowedMentions` set to avoid pinging unless intended.
- Errors shown to users are short and friendly. Stack traces go to the console only.

---

## 17. Event Handling

### 17.1 `ready`
- Log the bot tag and guild.
- Verify the guild exists and the bot is in it. If not, log a fatal error and exit.
- Verify the drop channel (section 15.8).
- Start the drop scheduler if enabled.
- Start the backup timer.

### 17.2 `messageCreate`
1. Ignore bots, webhooks, DMs, and other guilds.
2. Run activity reward logic (section 10).
3. If the message starts with the prefix, route to prefix command handling.
4. Wrap everything in try/catch. Log errors. Never let a thrown error crash the process.

Order matters: activity is checked first so a prefix command still earns activity, as decided in section 10.1.

### 17.3 `interactionCreate`
- If `isChatInputCommand()`: find the command by name, call `executeSlash`.
- If `isButton()` and customId starts with `drop:`: call `drops.claim`.
- Unknown interactions are ignored with a short ephemeral "Unknown action."
- Errors: reply ephemerally with a generic message if the interaction has not been replied to, or `followUp` if it has.

### 17.4 Process signals (`shutdown.js`)
- `SIGINT` and `SIGTERM`: flush store (section 8.6), clear timers, destroy the Discord client, exit 0.
- `unhandledRejection` and `uncaughtException`: log the error and attempt a store flush. Do not exit immediately on unhandled rejections; log them. For uncaught exceptions, flush and exit with code 1 so the host can restart cleanly.

---

## 18. Utilities

### 18.1 `format.js`
- `formatAmount(n)`: returns `"🪙 1,250 SterCoins"` (or `"1 SterCoin"` when exactly 1). Uses `currency.emoji`, `currency.name`, `currency.plural`, and `currency.thousandsSeparator`.
- `formatDuration(ms)`: returns `"5h 12m"` or `"45s"` for short durations.

### 18.2 `time.js`
- `now()`: returns `Date.now()`. Centralized so tests can stub time.
- `cooldownRemaining(lastAt, cooldownMs, now)`: returns milliseconds left, or 0.
- `randomIntervalMs(minMinutes, maxMinutes)`: uniform random in milliseconds.

### 18.3 `random.js`
- `randomInt(min, max)`: inclusive integer random.
- `weightedPick(entries)`: implements the weighted selection from section 15.2 and returns the chosen entry.

### 18.4 `logger.js`
- Levels: `debug`, `info`, `warn`, `error`.
- Each line: ISO timestamp, level, message, optional context object.
- `debug` is suppressed unless `LOG_LEVEL=debug` in `.env`.
- Economy events are logged at `info` with a short tag, for example `[credit] activity userId=... amount=2 balance=57`. Useful when debugging a complaint like "I didn't get my coins."

### 18.5 `config-validate.js`
- Implements all rules from section 6.1.
- Returns a list of errors. If any, log each one and exit.

---

## 19. Open Decisions (Need Your Input or Confirm Defaults)

These are small choices I have made defaults for. Confirm or change any of them.

1. **Drop amount visibility:** Hidden until claimed (default) or shown in the embed?
2. **Daily reward response:** Public (default) or ephemeral?
3. **Daily cooldown reply:** Ephemeral (default) or public?
4. **Drop claim window:** 10 minutes (default). Keep?
5. **Overlapping drops:** Allowed (default), logged as a warning. Or should a new drop wait until the previous one is claimed or expired?
6. **Prefix commands earn activity:** Yes (default). Or exclude command messages?
7. **Unknown prefix commands:** Silent (default). Or a short reply?
8. **Leaderboard and balance reply style:** Visible (default).
9. **Starting balance for new users:** 0 (default).
10. **Restart-lost drops:** Accepted for Phase 1 (default). Persist later?
11. **Activity cooldown across restarts:** Persisted (default, uses `lastActivityRewardAt`).
12. **Backup frequency:** Hourly, keep 24 (default). Adjust?
13. **Guild-only commands:** Yes (default). Commands do not work in DMs.

### 19.1 Items still needed from you before first run
- General chat channel ID → `channels.generalChatId`.
- Guild (server) ID → `discord.guildId`.
- Bot token → `.env` as `DISCORD_TOKEN`.
- Application ID → `.env` as `CLIENT_ID`.
- Confirm or edit the drop table and daily range (defaults in section 6).

---

## 20. Dependencies

| Package | Purpose | Notes |
|---|---|---|
| `discord.js` | Discord API client | v14, pinned to a major version |
| `dotenv` | Load `.env` | Used at startup only |

Dev dependencies (optional, for tests):
- None required. Use Node's built-in `node:test` and `node:assert`.

`package.json` scripts:
- `start`: `node index.js`
- `deploy`: `node deploy-commands.js`
- `test`: `node --test`

Node version: LTS (20 or 22). Declared in `package.json` under `engines`.

---

## 21. Error Handling Summary

| Situation | Behavior |
|---|---|
| Config invalid at startup | Print each error, exit 1 |
| `.env` missing token | Print error, exit 1 |
| `data.json` unparseable | Copy to `corrupt-<time>.json`, log fatal, exit 1, do not overwrite |
| `data.json` has unknown newer schema | Refuse to start, exit 1 |
| Save fails (disk full, permissions) | Log error, keep data in memory, retry on next flush, alert in logs |
| Guild not found on ready | Log fatal, exit 1 |
| Drop channel missing | Log error, pause drops, economy keeps running |
| Drop post fails | Log error, schedule next drop anyway |
| Command throws | Log with stack, ephemeral generic error to user |
| Unhandled promise rejection | Log, continue |
| Uncaught exception | Flush store, log, exit 1 (host restarts) |
| Double-click claim | Second click gets "Already claimed" |
| Claim after expiry | "This drop expired." |
| Claim after restart | "This drop is no longer active." |
| Gift to self | Rejected (unless `allowSelf`) |
| Gift to bot | Rejected (unless `allowBots`) |
| Insufficient funds | Friendly reply with current balance |
| Daily on cooldown | Friendly reply with time remaining |

---

## 22. Security and Abuse Considerations

- **Token safety:** Token only in `.env`. Never logged. Logger redacts any string matching the token pattern.
- **Mention abuse:** Leaderboard and balance use `allowedMentions` to prevent mass pings.
- **Spam earning:** Limited by the 5-minute activity cooldown. A user sending 1,000 messages in an hour earns 12 rewards at most (1 per 5 minutes).
- **Drop sniping:** Only the first click wins. Single-threaded handler prevents double credit.
- **Gift laundering:** No fees in Phase 1, so transferring is free. Acceptable for a small trusted server.
- **Inflation:** Money is created from activity, daily, and drops with no sink in Phase 1. Expect balances to climb. Sinks (shop, fees, roles) are Phase 2 and should be planned with this in mind.
- **Alt accounts:** A user with alts can earn more total activity. Not solved in Phase 1. Mitigation options later: account age gate, role gate.
- **Input validation:** All amounts are integers, all user IDs come from Discord, never from user text parsed as IDs unless matched against a mention pattern.
- **Data file exposure:** `data/` is inside the bot directory. Ensure bot-hosting.net does not expose it publicly (it should not, but confirm in host docs).

---

## 23. Testing Plan

### 23.1 Automated (Node built-in test runner)
Target files: `wallet.js`, `drops.js` (weighted pick and claim logic), `activity.js` (cooldown), `time.js`, `format.js`, `config-validate.js`.

Key test cases:
- Weighted pick: over 100,000 samples, distribution matches weights within a small tolerance.
- Weighted pick: with a single entry, always returns that entry.
- Claim: two claims in sequence, only the first succeeds.
- Claim: claim after expiry fails.
- Transfer: insufficient funds leaves both balances unchanged.
- Transfer: self-transfer rejected.
- Daily: exactly at cooldown boundary, allowed. One ms before, rejected.
- Activity: first message rewards, message within cooldown does not, message after cooldown does.
- Config validation: each rule in section 6.1 has a failing example.
- Store: atomic write leaves a valid file if a simulated crash happens between temp write and rename.
- Store: corrupt file is copied to a corrupt backup and startup fails without overwriting.

### 23.2 Manual (in a private test server before the real one)
- Send messages from a test account: confirm silent credit after 5 minutes, no credit within the window.
- Run `/daily`, then `/daily` again: second should show remaining time.
- Run `.daily` and `/daily` mixed: same cooldown applies.
- `/give` to another user, `/give` more than balance, `/give` to self, `/give` to bot.
- `/leaderboard` with 0 users, 1 user, and several users.
- Drop: wait for or force a drop. Claim from two accounts at once. Only one should succeed.
- Drop: let one expire, confirm no credit and the message updates.
- Restart the bot mid-drop, click the old button, confirm the "no longer active" message.
- Restart the bot, confirm balances and cooldowns persisted.
- Kill the process with `kill -9` during activity, confirm the file is valid JSON on restart (at most a few seconds of activity may be lost, which is accepted).
- Confirm prefix commands work with and without spaces after the prefix.
- Confirm the bot does not respond to other guild channels' drops (drops only in general chat).
- Load test: simulate 50 users sending messages in a loop. Confirm no lag, no missed saves.

### 23.3 Pre-launch checklist
- [ ] `config.js` contains real IDs, no placeholders.
- [ ] `.env` contains real token and client ID, and is not committed.
- [ ] Message Content Intent enabled in the Developer Portal.
- [ ] Bot invited with the correct scopes and permissions.
- [ ] `node deploy-commands.js` run successfully and commands visible in Discord.
- [ ] Persistent storage confirmed on bot-hosting.net by restarting and checking that `data.json` is still present.
- [ ] Backup folder is being created.
- [ ] A test drop has been posted and claimed in general chat.

---

## 24. Deployment (bot-hosting.net)

1. Upload project files (excluding `node_modules`, `.env` if the panel offers a secrets field, and `data/`).
2. Set environment variables `DISCORD_TOKEN` and `CLIENT_ID` in the panel (or upload `.env` if that is the host's method).
3. Set the startup command to `node index.js`.
4. Confirm the host installs dependencies from `package.json` (`npm install`). If not, run it in the host console.
5. Run `node deploy-commands.js` once, either from the host console or locally with the same `.env`.
6. Start the bot. Check logs for: config validated, store loaded, guild found, drop channel verified, drop scheduler started, backup timer started.
7. Restart the bot once to confirm persistence.
8. Keep a manual copy of `data/data.json` off the host periodically. Persistence protects against restarts, not against bad edits or host-level failure.

### 24.1 Updating the bot
- Edit `config.js` or code locally, upload, restart.
- If command definitions changed, run `deploy-commands.js` again.
- Back up `data/` before any schema change.

---

## 25. Phase Roadmap

### Phase 1 (this plan)
Balance, daily, give, leaderboard, activity rewards, random drops, JSON store with backups.

### Phase 2 (planned, not built)
- Shop with items and item effects (message multiplier, drop chance boost, daily boost).
- Item inventory and `/inventory`, `/buy`, `/shop`.
- Roles for sale: needs Manage Roles permission, bot role above purchasable roles, `roles` section in config.
- Economy sinks to counter inflation (decision needed on fees or shop prices).

### Phase 3 (planned, not built)
- Blackjack using buttons (Hit, Stand), bet min and max in config, payouts configurable, push on tie.
- Gambling cooldowns and bet caps.

### Phase 4 (planned, not built)
- Trading: two-party offer, both confirm via buttons, item and SterCoin combinations.
- Trade fee config.

### Later ideas (unscheduled)
- Persist active drops across restarts.
- Transaction log file for audit.
- Account-age or role gating for earning.
- Streak bonus for daily.

---

## 26. Glossary

- **Activity reward:** SterCoins credited silently for messages, once per cooldown.
- **Drop:** A posted message with a claim button, containing a hidden random SterCoin amount.
- **Claim window:** How long a drop can be claimed before it expires.
- **Debounced save:** Writing to disk after a short delay, batching several changes.
- **Atomic write:** Writing to a temp file and renaming it, so the real file is never half-written.
- **Schema version:** A number in the data file that tells the code how to read it.

---

## 27. Summary

Phase 1 delivers a single-server SterCoin economy with four commands (each in slash and prefix form), silent message rewards every 5 minutes per user, first-click random drops in general chat every 3 to 25 minutes, and a daily reward. Storage is a single JSON file with debounced atomic writes, rolling backups, and protection against overwriting corrupt data. Every tunable value lives in `config.js` and is validated on startup. Shop, roles, gambling, and trading are deliberately deferred and have clear places to plug in later.
