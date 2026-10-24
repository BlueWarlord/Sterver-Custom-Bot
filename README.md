# Sterver-Custom-Bot
A custom economy discord bot for a discord server

## Commands
Every command works as a slash command (`/balance`) and with the `.` prefix (`.balance`).
Slash commands are registered automatically each time the bot starts.
`npm run deploy` still works if you want to register them without starting the bot.

## Slash commands not showing up?
- Re-invite the bot using a link with **both** the `bot` and `applications.commands` scopes.
- Check `config.discord.guildId` is the right server and `CLIENT_ID` in `.env` is the application ID.
- Look for `slash commands registered` in the startup log.
