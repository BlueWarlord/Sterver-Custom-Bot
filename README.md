# Sterver-Custom-Bot
A custom economy discord bot for a discord server

## Commands
Every command works as a slash command (`/balance`) and with the `.` prefix (`.balance`).
Slash commands are registered automatically each time the bot starts.
`npm run deploy` still works if you want to register them without starting the bot.

## Setup
1. Copy `.env.example` to `.env` and fill in `DISCORD_TOKEN` and `CLIENT_ID`.
2. Fill in your guild, channel, drop, and role IDs in the `config/` modules.
3. `npm install`
4. `npm start`

Configuration lives in the `config/` folder only, split by feature area:

| File | Contents |
|---|---|
| `config/core.js` | Discord IDs, channels, currency, command access, appeal URL |
| `config/economy.js` | Starting balance, activity, daily, gifts, leaderboard |
| `config/drops.js` | Drop scheduling, activity model, and reward table |
| `config/games.js` | Coinflip and blackjack bets, payouts, and house edge |
| `config/inventory.js` | Shop items and roles |
| `config/storage.js` | JSON persistence and backup behavior |
| `config/index.js` | Assembles every section into one object |

## Slash commands not showing up?
- Re-invite the bot using a link with **both** the `bot` and `applications.commands` scopes.
- Check `config.discord.guildId` is the right server and `CLIENT_ID` in `.env` is the application ID.
- Look for `slash commands registered` in the startup log.

## Security notes
- All gambling, drop, daily, and activity randomness uses Node's `crypto` module.
- Gambling payouts include a configurable house edge: `gambling.houseEdge` (default `0.05`, i.e. 5%). A fair 2x coinflip therefore returns 1.9x on a win.
- `blackjack.houseEdge` can override the shared edge for blackjack; `null` inherits `gambling.houseEdge`.
- Gifting is capped by `gift.maxPerDay` and `gift.minAccountAgeDays`.
- `commands.rateLimit`, `commands.allowedRoleIds`, and `commands.deniedRoleIds` provide optional throttling and role gates.
- The JSON store uses a process lock, atomic writes, checksummed backups, and automatic restore from the newest valid backup.
- `.pick` only works in configured drop channels and is rate-limited per user.
