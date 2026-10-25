require("dotenv").config();
const { Client, GatewayIntentBits, Events } = require("discord.js");
const config = require("./config");
const { validate } = require("./src/utils/config-validate");
const store = require("./src/economy/store");
const readyEvent = require("./src/events/ready");
const messageCreateEvent = require("./src/events/messageCreate");
const interactionCreateEvent = require("./src/events/interactionCreate");
const guildMemberRemoveEvent = require("./src/events/guildMemberRemove");

const errors = validate(config);
if (errors.length) { errors.forEach(e => console.error("CONFIG ERROR:", e)); process.exit(1); }
if (!process.env.DISCORD_TOKEN) { console.error("DISCORD_TOKEN missing"); process.exit(1); }
if (!process.env.CLIENT_ID || !/^\d+$/.test(process.env.CLIENT_ID)) { console.error("CLIENT_ID missing/invalid"); process.exit(1); }

(async () => {
  await store.load();
  store.start();
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });
  client.once(Events.ClientReady, () => readyEvent.execute(client));
  client.on("messageCreate", (m) => messageCreateEvent.execute(m));
  client.on("interactionCreate", (i) => interactionCreateEvent.execute(i));
  client.on("guildMemberRemove", (m) => guildMemberRemoveEvent.execute(m));
  const shutdown = require("./src/events/shutdown");
  const doShutdown = () => shutdown(client);
  process.on("SIGINT", doShutdown);
  process.on("SIGTERM", doShutdown);
  process.on("unhandledRejection", (e) => console.error(e));
  process.on("uncaughtException", (e) => { console.error(e); store.flushNow().finally(()=>process.exit(1)); });
  await client.login(process.env.DISCORD_TOKEN);
})();
