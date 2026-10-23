require("dotenv").config();
const { REST, Routes } = require("discord.js");
const config = require("./config");
const commands = require("./src/commands");

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  const body = commands.map(c => c.slash.toJSON());
  await rest.put(Routes.applicationGuildCommands(clientId, config.discord.guildId), { body });
  console.log("Deployed commands.");
})();
