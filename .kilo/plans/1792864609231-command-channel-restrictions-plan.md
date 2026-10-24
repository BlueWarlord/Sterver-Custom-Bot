# Plan: Add channel restrictions for commands

## Problem statement recap
Add a config that shows the bot where the commands can be used (ignoring .pick and the random chat drops) in specific channels. Example:
- in general chat: `.balance` -> response = false
- in bot commands chat: `.balance` -> response = true

## Current behavior
- Prefix commands routed in `src/events/messageCreate.js`: checks prefix, handles `pick` specially (via `drops.pick`), then looks up command in `src/commands/index.js` and calls `executePrefix`. No channel restriction logic.
- Slash commands routed in `src/events/interactionCreate.js`: looks up command by name and calls `executeSlash`. No channel restriction logic.
- `.pick` is explicitly ignored from restrictions.
- Random drops are not commands - triggered separately by activity/drops system.

## Design
Add config in `config.js` (and validate in `src/utils/config-validate.js`). Suggested config:
```js
commands: { 
  prefix: ".",
  // If non-empty array, only allow commands in these channels (ignoring .pick)
  allowedChannelIds: ["123...", "456..."] 
}
```
Whitelist model - if array is non-empty, only allow commands in listed channels. Empty array means no restrictions (current behavior).

Skip restrictions for:
- `.pick` prefix command (handled before command lookup)
- Random drops are not commands

For slash commands, Discord requires a response - so if blocked, reply ephemerally explaining commands not allowed here.

## Implementation locations
1. `config.js` - add `commands.allowedChannelIds: []`
2. `src/utils/config-validate.js` - validate if present (array of numeric strings)
3. `src/events/messageCreate.js` - enforce for prefix commands (after pick check, before executing other commands). If restricted and not in allowed list, do nothing (no response).
4. `src/events/interactionCreate.js` - enforce for slash commands. If restricted and not allowed, reply ephemeral.

## Steps
1. Update config
2. Update validation  
3. Add enforcement in messageCreate
4. Add enforcement in interactionCreate
5. Test manually

Let us also add a helper function maybe in utils or just inline. Keep it simple.
