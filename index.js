require("dotenv").config();
const { Client, GatewayIntentBits, Events } = require("discord.js");
const config = require("./config");
const { validate } = require("./src/utils/config-validate");
const store = require("./src/economy/store");
const logger = require("./src/utils/logger");
const readyEvent = require("./src/events/ready");
const messageCreateEvent = require("./src/events/messageCreate");
const interactionCreateEvent = require("./src/events/interactionCreate");
const guildMemberRemoveEvent = require("./src/events/guildMemberRemove");
const guildCreateEvent = require("./src/events/guildCreate");

const errors = validate(config);
if (errors.length) {
  errors.forEach((error) => console.error("CONFIG ERROR:", error));
  process.exit(1);
}
if (!process.env.DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN missing");
  process.exit(1);
}
if (!process.env.CLIENT_ID || !/^\d+$/.test(process.env.CLIENT_ID)) {
  console.error("CLIENT_ID missing/invalid");
  process.exit(1);
}

(async () => {
  await store.load();
  store.start();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
    ],
  });

  client.once(Events.ClientReady, () => readyEvent.execute(client));
  client.on("messageCreate", (message) => messageCreateEvent.execute(message));
  client.on("interactionCreate", (interaction) => interactionCreateEvent.execute(interaction));
  client.on("guildMemberRemove", (member) => guildMemberRemoveEvent.execute(member));
  client.on("guildCreate", (guild) => guildCreateEvent.execute(guild));
  client.on("error", (error) => logger.error("discord client error", { error }));

  const shutdown = require("./src/events/shutdown");
  const doShutdown = () => shutdown(client);
  process.on("SIGINT", doShutdown);
  process.on("SIGTERM", doShutdown);

  process.on("unhandledRejection", (error) => {
    logger.error("unhandled rejection", { error });
  });
  process.on("uncaughtException", (error) => {
    logger.error("uncaught exception", { error });
    store.flushNow().finally(() => process.exit(1));
  });

  await client.login(process.env.DISCORD_TOKEN);
})().catch(async (error) => {
  logger.error("startup failed", { error });
  try {
    await store.flushNow();
  } catch (_) {}
  process.exit(1);
});
