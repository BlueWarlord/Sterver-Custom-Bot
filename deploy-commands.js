require("dotenv").config();
const { REST, Routes } = require("discord.js");
const config = require("./config");
const commands = require("./src/commands");
const { validate } = require("./src/utils/config-validate");

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
if (!token || !clientId) { console.error("DISCORD_TOKEN and CLIENT_ID must be set in .env"); process.exit(1); }
const configErrors = validate(config);
if (configErrors.length) {
  configErrors.forEach((error) => console.error("CONFIG ERROR:", error));
  process.exit(1);
}
const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  const body = commands.map(c => c.slash.toJSON());
  await rest.put(Routes.applicationGuildCommands(clientId, config.discord.guildId), { body });
  console.log(`Deployed ${body.length} commands to guild ${config.discord.guildId}.`);
})().catch(e => {
  if (e.code === 50001) console.error("Missing Access: invite the bot with the 'applications.commands' scope and make sure config.discord.guildId is correct.");
  else console.error("Deploy failed:", e.message || e);
  process.exit(1);
});
