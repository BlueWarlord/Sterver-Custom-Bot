=== config.js ===
module.exports = {
  discord: { guildId: "PASTE_GUILD_ID" },
  channels: { generalChatId: "PASTE_CHANNEL_ID" },
  currency: { name: "SterCoin", plural: "SterCoins", emoji: "🪙", thousandsSeparator: "," },
  commands: { prefix: "." },
  economy: { startingBalance: 0 },
  activity: { enabled: true, cooldownSeconds: 300, amountMin: 1, amountMax: 3, ignoredChannelIds: [] },
  daily: { enabled: true, amountMin: 20, amountMax: 50, cooldownHours: 24 },
  drops: {
  enabled: true,
  eligibleChannelIds: [],     
  intervalMinMinutes: 3,
  intervalMaxMinutes: 25,
  delaySkew: 2,
  minGapMinutes: 3,     
  tickSeconds: 10,
  density: {
    windowSeconds: 120,
    perUserCap: 5,               
    minDensity: 0.05,            
    refDensity: 0.1,             
    maxMultiplier: 3,
  },
  claimWindowMinutes: 10,
  table: [ { weight: 70, min: 5, max: 15 }, { weight: 25, min: 16, max: 40 }, { weight: 5, min: 41, max: 100 } ],
  embedTitle: "A SterCoin drop appeared!",
  embedDescription: "First to claim it gets the SterCoins.",
  claimButtonLabel: "Claim",
  expiredText: "This drop expired.",
},
  gift: { enabled: true, minAmount: 1, maxAmount: null, allowSelf: false, allowBots: false },
  leaderboard: { size: 10 },
  storage: { path: "data/data.json", flushIntervalMs: 3000, backupsEnabled: true, backupIntervalMinutes: 60, backupsToKeep: 24 },
};

=== deploy-commands.js ===
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

=== index.js ===
require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const config = require("./config");
const { validate } = require("./src/utils/config-validate");
const store = require("./src/economy/store");
const readyEvent = require("./src/events/ready");
const messageCreateEvent = require("./src/events/messageCreate");
const interactionCreateEvent = require("./src/events/interactionCreate");

const errors = validate(config);
if (errors.length) { errors.forEach(e => console.error("CONFIG ERROR:", e)); process.exit(1); }
if (!process.env.DISCORD_TOKEN) { console.error("DISCORD_TOKEN missing"); process.exit(1); }
if (!process.env.CLIENT_ID || !/^\d+$/.test(process.env.CLIENT_ID)) { console.error("CLIENT_ID missing/invalid"); process.exit(1); }

(async () => {
  await store.load();
  store.start();
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
  client.once("ready", () => readyEvent.execute(client));
  client.on("messageCreate", (m) => messageCreateEvent.execute(m));
  client.on("interactionCreate", (i) => interactionCreateEvent.execute(i));
  const shutdown = require("./src/events/shutdown");
  const doShutdown = () => shutdown(client);
  process.on("SIGINT", doShutdown);
  process.on("SIGTERM", doShutdown);
  process.on("unhandledRejection", (e) => console.error(e));
  process.on("uncaughtException", (e) => { console.error(e); store.flushNow().finally(()=>process.exit(1)); });
  await client.login(process.env.DISCORD_TOKEN);
})();

=== package-lock.json ===
{
  "name": "sterbot",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "sterbot",
      "version": "1.0.0",
      "dependencies": {
        "discord.js": "^14.27.0",
        "dotenv": "^18.0.9"
      },
      "engines": {
        "node": ">=20"
      }
    },
    "node_modules/@discordjs/builders": {
      "version": "1.14.1",
      "resolved": "https://registry.npmjs.org/@discordjs/builders/-/builders-1.14.1.tgz",
      "integrity": "sha512-gSKkhXLqs96TCzk66VZuHHl8z2bQMJFGwrXC0f33ngK+FLNau4hU1PYny3DNJfNdSH+gVMzE85/d5FQ2BpcNwQ==",
      "license": "Apache-2.0",
      "dependencies": {
        "@discordjs/formatters": "^0.6.2",
        "@discordjs/util": "^1.2.0",
        "@sapphire/shapeshift": "^4.0.0",
        "discord-api-types": "^0.38.40",
        "fast-deep-equal": "^3.1.3",
        "ts-mixer": "^6.0.4",
        "tslib": "^2.6.3"
      },
      "engines": {
        "node": ">=16.11.0"
      },
      "funding": {
        "url": "https://github.com/discordjs/discord.js?sponsor"
      }
    },
    "node_modules/@discordjs/collection": {
      "version": "1.5.3",
      "resolved": "https://registry.npmjs.org/@discordjs/collection/-/collection-1.5.3.tgz",
      "integrity": "sha512-SVb428OMd3WO1paV3rm6tSjM4wC+Kecaa1EUGX7vc6/fddvw/6lg90z4QtCqm21zvVe92vMMDt9+DkIvjXImQQ==",
      "license": "Apache-2.0",
      "engines": {
        "node": ">=16.11.0"
      }
    },
    "node_modules/@discordjs/formatters": {
      "version": "0.6.2",
      "resolved": "https://registry.npmjs.org/@discordjs/formatters/-/formatters-0.6.2.tgz",
      "integrity": "sha512-y4UPwWhH6vChKRkGdMB4odasUbHOUwy7KL+OVwF86PvT6QVOwElx+TiI1/6kcmcEe+g5YRXJFiXSXUdabqZOvQ==",
      "license": "Apache-2.0",
      "dependencies": {
        "discord-api-types": "^0.38.33"
      },
      "engines": {
        "node": ">=16.11.0"
      },
      "funding": {
        "url": "https://github.com/discordjs/discord.js?sponsor"
      }
    },
    "node_modules/@discordjs/rest": {
      "version": "2.6.3",
      "resolved": "https://registry.npmjs.org/@discordjs/rest/-/rest-2.6.3.tgz",
      "integrity": "sha512-wvOylxNYJkwKjctS/Mn5GP1w9r3/rzyH+ThD1JlAca6zEdlHs8QWBBUQJpU5Q+W6DoIj/Ljh1IPlZs7hTU+UAg==",
      "license": "Apache-2.0",
      "dependencies": {
        "@discordjs/collection": "^2.1.1",
        "@discordjs/util": "^1.2.0",
        "@sapphire/async-queue": "^1.5.3",
        "@sapphire/snowflake": "^3.5.5",
        "@vladfrangu/async_event_emitter": "^2.4.6",
        "discord-api-types": "^0.38.50",
        "magic-bytes.js": "^1.13.0",
        "tslib": "^2.6.3",
        "undici": "^6.27.0"
      },
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "url": "https://github.com/discordjs/discord.js?sponsor"
      }
    },
    "node_modules/@discordjs/rest/node_modules/@discordjs/collection": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/@discordjs/collection/-/collection-2.1.1.tgz",
      "integrity": "sha512-LiSusze9Tc7qF03sLCujF5iZp7K+vRNEDBZ86FT9aQAv3vxMLihUvKvpsCWiQ2DJq1tVckopKm1rxomgNUc9hg==",
      "license": "Apache-2.0",
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "url": "https://github.com/discordjs/discord.js?sponsor"
      }
    },
    "node_modules/@discordjs/util": {
      "version": "1.2.0",
      "resolved": "https://registry.npmjs.org/@discordjs/util/-/util-1.2.0.tgz",
      "integrity": "sha512-3LKP7F2+atl9vJFhaBjn4nOaSWahZ/yWjOvA4e5pnXkt2qyXRCHLxoBQy81GFtLGCq7K9lPm9R517M1U+/90Qg==",
      "license": "Apache-2.0",
      "dependencies": {
        "discord-api-types": "^0.38.33"
      },
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "url": "https://github.com/discordjs/discord.js?sponsor"
      }
    },
    "node_modules/@discordjs/ws": {
      "version": "1.2.3",
      "resolved": "https://registry.npmjs.org/@discordjs/ws/-/ws-1.2.3.tgz",
      "integrity": "sha512-wPlQDxEmlDg5IxhJPuxXr3Vy9AjYq5xCvFWGJyD7w7Np8ZGu+Mc+97LCoEc/+AYCo2IDpKioiH0/c/mj5ZR9Uw==",
      "license": "Apache-2.0",
      "dependencies": {
        "@discordjs/collection": "^2.1.0",
        "@discordjs/rest": "^2.5.1",
        "@discordjs/util": "^1.1.0",
        "@sapphire/async-queue": "^1.5.2",
        "@types/ws": "^8.5.10",
        "@vladfrangu/async_event_emitter": "^2.2.4",
        "discord-api-types": "^0.38.1",
        "tslib": "^2.6.2",
        "ws": "^8.17.0"
      },
      "engines": {
        "node": ">=16.11.0"
      },
      "funding": {
        "url": "https://github.com/discordjs/discord.js?sponsor"
      }
    },
    "node_modules/@discordjs/ws/node_modules/@discordjs/collection": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/@discordjs/collection/-/collection-2.1.1.tgz",
      "integrity": "sha512-LiSusze9Tc7qF03sLCujF5iZp7K+vRNEDBZ86FT9aQAv3vxMLihUvKvpsCWiQ2DJq1tVckopKm1rxomgNUc9hg==",
      "license": "Apache-2.0",
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "url": "https://github.com/discordjs/discord.js?sponsor"
      }
    },
    "node_modules/@sapphire/async-queue": {
      "version": "1.5.5",
      "resolved": "https://registry.npmjs.org/@sapphire/async-queue/-/async-queue-1.5.5.tgz",
      "integrity": "sha512-cvGzxbba6sav2zZkH8GPf2oGk9yYoD5qrNWdu9fRehifgnFZJMV+nuy2nON2roRO4yQQ+v7MK/Pktl/HgfsUXg==",
      "license": "MIT",
      "engines": {
        "node": ">=v14.0.0",
        "npm": ">=7.0.0"
      }
    },
    "node_modules/@sapphire/shapeshift": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/@sapphire/shapeshift/-/shapeshift-4.0.0.tgz",
      "integrity": "sha512-d9dUmWVA7MMiKobL3VpLF8P2aeanRTu6ypG2OIaEv/ZHH/SUQ2iHOVyi5wAPjQ+HmnMuL0whK9ez8I/raWbtIg==",
      "license": "MIT",
      "dependencies": {
        "fast-deep-equal": "^3.1.3",
        "lodash": "^4.17.21"
      },
      "engines": {
        "node": ">=v16"
      }
    },
    "node_modules/@sapphire/snowflake": {
      "version": "3.5.5",
      "resolved": "https://registry.npmjs.org/@sapphire/snowflake/-/snowflake-3.5.5.tgz",
      "integrity": "sha512-xzvBr1Q1c4lCe7i6sRnrofxeO1QTP/LKQ6A6qy0iB4x5yfiSfARMEQEghojzTNALDTcv8En04qYNIco9/K9eZQ==",
      "license": "MIT",
      "engines": {
        "node": ">=v14.0.0",
        "npm": ">=7.0.0"
      }
    },
    "node_modules/@types/node": {
      "version": "26.6.5",
      "resolved": "https://registry.npmjs.org/@types/node/-/node-26.6.5.tgz",
      "integrity": "sha512-uMzsv9stDdofIZBx4UGh4Z9ZgXnGC9seRDscilBcTHAeOFk67MZg/k9bWVfO+bk4qZmG+l52hRnLwUiH2LnJTg==",
      "license": "MIT",
      "dependencies": {
        "undici-types": "~8.9.0"
      }
    },
    "node_modules/@types/ws": {
      "version": "8.18.2",
      "resolved": "https://registry.npmjs.org/@types/ws/-/ws-8.18.2.tgz",
      "integrity": "sha512-67MQl+fpWKVTT1NYdnmo3U4sc/xPo/zQBncVnI74qmQa0z/b+1g6iYqNmGCPbxO+zz2aklb08a0oHfegiVd0/w==",
      "license": "MIT",
      "dependencies": {
        "@types/node": "*"
      }
    },
    "node_modules/@vladfrangu/async_event_emitter": {
      "version": "2.4.7",
      "resolved": "https://registry.npmjs.org/@vladfrangu/async_event_emitter/-/async_event_emitter-2.4.7.tgz",
      "integrity": "sha512-Xfe6rpCTxSxfbswi/W/Pz7zp1WWSNn4A0eW4mLkQUewCrXXtMj31lCg+iQyTkh/CkusZSq9eDflu7tjEDXUY6g==",
      "license": "MIT",
      "engines": {
        "node": ">=v14.0.0",
        "npm": ">=7.0.0"
      }
    },
    "node_modules/discord-api-types": {
      "version": "0.38.57",
      "resolved": "https://registry.npmjs.org/discord-api-types/-/discord-api-types-0.38.57.tgz",
      "integrity": "sha512-R1CTSSt4RshqCq23j2Xq2ZscvzB4LzG9OB1CYQdKUGdw8Ti/oF/72EEtK2mNpagG/Vj9NcBT7dw9lKLf+Dacfg==",
      "license": "MIT"
    },
    "node_modules/discord.js": {
      "version": "14.27.0",
      "resolved": "https://registry.npmjs.org/discord.js/-/discord.js-14.27.0.tgz",
      "integrity": "sha512-qHbFlFG2N7y3LjPySYsL6A1+BnX6bkTVgo842EX0CqVPk/KTMwZkojPHEXKsQUpWZNyz5BISNHK1cPpQw0+m4A==",
      "license": "Apache-2.0",
      "dependencies": {
        "@discordjs/builders": "^1.14.1",
        "@discordjs/collection": "1.5.3",
        "@discordjs/formatters": "^0.6.2",
        "@discordjs/rest": "^2.6.2",
        "@discordjs/util": "^1.2.0",
        "@discordjs/ws": "^1.2.3",
        "@sapphire/snowflake": "3.5.5",
        "discord-api-types": "^0.38.49",
        "fast-deep-equal": "3.1.3",
        "lodash.snakecase": "4.1.1",
        "magic-bytes.js": "^1.13.0",
        "tslib": "^2.6.3",
        "undici": "^6.27.0"
      },
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "url": "https://github.com/discordjs/discord.js?sponsor"
      }
    },
    "node_modules/dotenv": {
      "version": "18.0.9",
      "resolved": "https://registry.npmjs.org/dotenv/-/dotenv-18.0.9.tgz",
      "integrity": "sha512-3fVOW4cB02R066PUSwn8O4TJyz9NckQl7F81blIbaq9jKBm2tSmOKky7ZHIXzGvkVPXCSn6jkpziBPZdGFs8Tw==",
      "license": "BSD-2-Clause",
      "bin": {
        "dotenv": "dist/index.cjs"
      },
      "engines": {
        "node": ">=12"
      },
      "funding": {
        "url": "https://dotenvx.com"
      }
    },
    "node_modules/fast-deep-equal": {
      "version": "3.1.3",
      "resolved": "https://registry.npmjs.org/fast-deep-equal/-/fast-deep-equal-3.1.3.tgz",
      "integrity": "sha512-f3qQ9oQy9j2AhBe/H9VC91wLmKBCCU/gDOnKNAYG5hswO7BLKj09Hc5HYNz9cGI++xlpDCIgDaitVs03ATR84Q==",
      "license": "MIT"
    },
    "node_modules/lodash": {
      "version": "4.18.1",
      "resolved": "https://registry.npmjs.org/lodash/-/lodash-4.18.1.tgz",
      "integrity": "sha512-dMInicTPVE8d1e5otfwmmjlxkZoUpiVLwyeTdUsi/Caj/gfzzblBcCE5sRHV/AsjuCmxWrte2TNGSYuCeCq+0Q==",
      "license": "MIT"
    },
    "node_modules/lodash.snakecase": {
      "version": "4.1.1",
      "resolved": "https://registry.npmjs.org/lodash.snakecase/-/lodash.snakecase-4.1.1.tgz",
      "integrity": "sha512-QZ1d4xoBHYUeuouhEq3lk3Uq7ldgyFXGBhg04+oRLnIz8o9T65Eh+8YdroUwn846zchkA9yDsDl5CVVaV2nqYw==",
      "license": "MIT"
    },
    "node_modules/magic-bytes.js": {
      "version": "1.13.1",
      "resolved": "https://registry.npmjs.org/magic-bytes.js/-/magic-bytes.js-1.13.1.tgz",
      "integrity": "sha512-x5sn4UX2k5gCWlcfmoFwG4TPie8+dctESyqOBdhB5p6MsgWXdBKGmt9nXPObj/JI50TTL928lc5Yt1WntMn1bw==",
      "license": "MIT"
    },
    "node_modules/ts-mixer": {
      "version": "6.0.4",
      "resolved": "https://registry.npmjs.org/ts-mixer/-/ts-mixer-6.0.4.tgz",
      "integrity": "sha512-ufKpbmrugz5Aou4wcr5Wc1UUFWOLhq+Fm6qa6P0w0K5Qw2yhaUoiWszhCVuNQyNwrlGiscHOmqYoAox1PtvgjA==",
      "license": "MIT"
    },
    "node_modules/tslib": {
      "version": "2.8.1",
      "resolved": "https://registry.npmjs.org/tslib/-/tslib-2.8.1.tgz",
      "integrity": "sha512-oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w==",
      "license": "0BSD"
    },
    "node_modules/undici": {
      "version": "6.29.1",
      "resolved": "https://registry.npmjs.org/undici/-/undici-6.29.1.tgz",
      "integrity": "sha512-EvRlUt/QqAEvXdQeRMYUfwOQsfzpDztykrG2owGEE/rBOBoYv9uF39ZzsNDh4lTFHhTr2XOZjKkYgueD12ZmGA==",
      "license": "MIT",
      "engines": {
        "node": ">=18.17"
      }
    },
    "node_modules/undici-types": {
      "version": "8.9.0",
      "resolved": "https://registry.npmjs.org/undici-types/-/undici-types-8.9.0.tgz",
      "integrity": "sha512-KTDyRTYX8sWmKXAikPHHSyc63CRPETMctyjKFupcC6OBLXT3xsN0e9aF7m+mIXutFWpUXuedtowG7iLOzp0kQg==",
      "license": "MIT"
    },
    "node_modules/ws": {
      "version": "8.22.0",
      "resolved": "https://registry.npmjs.org/ws/-/ws-8.22.0.tgz",
      "integrity": "sha512-Ydggc987+RO0AnWtZ/7Wq9FtNvcrL1b/RO0ud9mWjUPgDrsAAwQSF51sm2hm1XofbU/4jkpGEsLFsZZxU+1DOg==",
      "license": "MIT",
      "engines": {
        "node": ">=10.0.0"
      },
      "peerDependencies": {
        "bufferutil": "^4.0.1",
        "utf-8-validate": ">=5.0.2"
      },
      "peerDependenciesMeta": {
        "bufferutil": {
          "optional": true
        },
        "utf-8-validate": {
          "optional": true
        }
      }
    }
  }
}

=== package.json ===
{
  "name": "sterbot",
  "version": "1.0.0",
  "description": "SterCoin economy bot",
  "main": "index.js",
  "engines": { "node": ">=20" },
  "scripts": {
    "start": "node index.js",
    "deploy": "node deploy-commands.js",
    "test": "node --test"
  },
  "dependencies": {
    "discord.js": "^14.27.0",
    "dotenv": "^18.0.9"
  }
}

=== README.md ===
# Sterver-Custom-Bot
A custom economy discord bot for a discord server

=== src/commands/balance.js ===
const { SlashCommandBuilder } = require("discord.js");
const config = require("../../config");
const wallet = require("../economy/wallet");
const store = require("../economy/store");
const { formatAmount } = require("../utils/format");

module.exports = {
  name: "balance",
  slash: new SlashCommandBuilder().setName("balance").setDescription("Show balance").addUserOption(o=>o.setName("user").setDescription("User").setRequired(false)),
  async executeSlash(interaction) {
    const target = interaction.options.getUser("user") || interaction.user;
    if (target.bot) return interaction.reply({ content: "Bots don't have balances.", ephemeral: true });
    const bal = wallet.getBalance(target.id);
    await interaction.reply({ content: `${target}'s balance: ${formatAmount(bal)}` });
  },
  async executePrefix(message, args) {
    let target = message.mentions.users.first() || message.author;
    if (target.bot) return message.reply({ content: "Bots don't have balances.", allowedMentions: { repliedUser: false } });
    const bal = wallet.getBalance(target.id);
    await message.reply({ content: `${target}'s balance: ${formatAmount(bal)}`, allowedMentions: { parse: [] } });
  },
};

=== src/commands/daily.js ===
const { SlashCommandBuilder } = require("discord.js");
const config = require("../../config");
const wallet = require("../economy/wallet");
const { formatAmount, formatDuration } = require("../utils/format");
const { now } = require("../utils/time");

module.exports = {
  name: "daily",
  slash: new SlashCommandBuilder().setName("daily").setDescription("Claim daily reward"),
  async executeSlash(interaction) {
    if (!config.daily.enabled) return interaction.reply({ content: "Daily rewards are disabled.", ephemeral: true });
    const res = wallet.claimDaily(interaction.user.id, now());
    if (!res.ok) return interaction.reply({ content: `You can claim again in ${formatDuration(res.remainingMs)}.`, ephemeral: true });
    await interaction.reply({ content: `You claimed ${formatAmount(res.amount)}. New balance: ${formatAmount(res.balance)}.` });
  },
  async executePrefix(message) {
    if (!config.daily.enabled) return message.reply({ content: "Daily rewards are disabled.", allowedMentions: { repliedUser: false } });
    const res = wallet.claimDaily(message.author.id, now());
    if (!res.ok) return message.reply({ content: `You can claim again in ${formatDuration(res.remainingMs)}.`, allowedMentions: { repliedUser: false } });
    await message.reply({ content: `You claimed ${formatAmount(res.amount)}. New balance: ${formatAmount(res.balance)}.`, allowedMentions: { repliedUser: false } });
  },
};

=== src/commands/give.js ===
const { SlashCommandBuilder } = require("discord.js");
const config = require("../../config");
const wallet = require("../economy/wallet");
const { formatAmount } = require("../utils/format");

function validate(sender, target, amount) {
  if (!config.gift.enabled) return "Gifting is disabled.";
  if (!target) return "No target.";
  if (target.id === sender.id && !config.gift.allowSelf) return "Cannot gift yourself.";
  if (target.bot && !config.gift.allowBots) return "Cannot gift bots.";
  if (!Number.isInteger(amount) || amount <= 0) return "Invalid amount.";
  if (amount < config.gift.minAmount) return "Amount too small.";
  if (config.gift.maxAmount != null && amount > config.gift.maxAmount) return "Amount too large.";
  const bal = wallet.getBalance(sender.id);
  if (bal < amount) return `Insufficient funds. Balance: ${formatAmount(bal)}`;
  return null;
}

module.exports = {
  name: "give",
  slash: new SlashCommandBuilder().setName("give").setDescription("Gift SterCoins")
    .addUserOption(o=>o.setName("user").setDescription("Recipient").setRequired(true))
    .addIntegerOption(o=>o.setName("amount").setDescription("Amount").setRequired(true).setMinValue(1)),
  async executeSlash(interaction) {
    const target = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");
    const err = validate(interaction.user, target, amount);
    if (err) return interaction.reply({ content: err, ephemeral: true });
    const res = wallet.transfer(interaction.user.id, target.id, amount);
    if (!res.ok) return interaction.reply({ content: "Transfer failed.", ephemeral: true });
    await interaction.reply({ content: `${interaction.user} gave ${target} ${formatAmount(amount)}.` });
  },
  async executePrefix(message, args) {
    const target = message.mentions.users.first();
    const amtToken = args.find(t => /^\d+$/.test(t));
    const amount = amtToken ? parseInt(amtToken, 10) : NaN;
    const err = validate(message.author, target, amount);
    if (err) return message.reply({ content: err, allowedMentions: { repliedUser: false } });
    const res = wallet.transfer(message.author.id, target.id, amount);
    if (!res.ok) return message.reply({ content: "Transfer failed.", allowedMentions: { repliedUser: false } });
    await message.reply({ content: `${message.author} gave ${target} ${formatAmount(amount)}.`, allowedMentions: { parse: [] } });
  },
};

=== src/commands/help.js ===
const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  name: 'help',
  aliases: ['h'],
  slash: new SlashCommandBuilder().setName('help').setDescription('Show commands'),
  async executeSlash(interaction) {
    const cmds = require('./index').map(c => '`' + config.commands.prefix + c.name + '`').join(', ');
    await interaction.reply({ content: 'Commands: ' + cmds + '\nTip: Use `.help` or `.h`.', ephemeral: true });
  },
  async executePrefix(message) {
    const cmds = require('./index').map(c => '`' + config.commands.prefix + c.name + '`').join(', ');
    await message.reply({ content: 'Commands: ' + cmds + '\nTip: Use `.help` or `.h`.', allowedMentions: { repliedUser: false } });
  },
};

=== src/commands/index.js ===
const balance = require("./balance");
const daily = require("./daily");
const give = require("./give");
const leaderboard = require("./leaderboard");
const help = require("./help");
module.exports = [balance, daily, give, leaderboard, help];

=== src/commands/leaderboard.js ===
const { SlashCommandBuilder } = require("discord.js");
const config = require("../../config");
const wallet = require("../economy/wallet");
const { formatAmount } = require("../utils/format");

module.exports = {
  name: "leaderboard",
  aliases: ["lb"],
  slash: new SlashCommandBuilder().setName("leaderboard").setDescription("Top users"),
  async executeSlash(interaction) {
    const entries = wallet.getLeaderboard(config.leaderboard.size);
    if (entries.length === 0) return interaction.reply({ content: "Nobody has any SterCoins yet." });
    const lines = entries.map((e, i) => `${i+1}. <@${e.id}> â€” ${formatAmount(e.balance)}`).join("\n");
    await interaction.reply({ content: lines, allowedMentions: { parse: [] } });
  },
  async executePrefix(message) {
    const entries = wallet.getLeaderboard(config.leaderboard.size);
    if (entries.length === 0) return message.reply({ content: "Nobody has any SterCoins yet.", allowedMentions: { repliedUser: false } });
    const lines = entries.map((e, i) => `${i+1}. <@${e.id}> â€” ${formatAmount(e.balance)}`).join("\n");
    await message.reply({ content: lines, allowedMentions: { parse: [] } });
  },
};

=== src/economy/activity.js ===
const config = require("../../config");
const store = require("./store");
const wallet = require("./wallet");
const { now } = require("../utils/time");
const { randomInt } = require("../utils/random");

function tryReward(message) {
  if (!config.activity.enabled) return;
  if (!message.guild || message.guild.id !== config.discord.guildId) return;
  if (message.author.bot) return;
  if (message.webhookId) return;
  if (config.activity.ignoredChannelIds.includes(message.channel.id)) return;
  if (message.system) return;
  const userId = message.author.id;
  const u = store.getUser(userId);
  const last = u ? u.lastActivityRewardAt : null;
  const cooldownMs = config.activity.cooldownSeconds * 1000;
  const t = now();
  if (last != null && t - last < cooldownMs) return;
  const amount = randomInt(config.activity.amountMin, config.activity.amountMax);
  const rec = store.ensureUser(userId);
  rec.balance += amount;
  rec.totalEarned += amount;
  rec.lastActivityRewardAt = t;
  store.update(() => {});
}

module.exports = { tryReward };

=== src/economy/density.js ===
const config = require("../../config");

const cfg = config.drops.density;
const events = new Map(); // channelId -> [{ t: timestampMs, u: userId }], oldest first

function channelIds() {
  const ids = config.drops.eligibleChannelIds;
  return ids && ids.length ? ids : [config.channels.generalChatId];
}
const eligible = new Set(channelIds());

function prune(arr, now) {
  const cutoff = now - cfg.windowSeconds * 1000;
  let i = 0;
  while (i < arr.length && arr[i].t < cutoff) i++;
  if (i > 0) arr.splice(0, i);
}

// Call for every incoming message. Only eligible channels are tracked.
function record(message, now = Date.now()) {
  if (!eligible.has(message.channel.id)) return;
  if (message.author.bot || message.webhookId || message.system) return;
  let arr = events.get(message.channel.id);
  if (!arr) { arr = []; events.set(message.channel.id, arr); }
  arr.push({ t: now, u: message.author.id });
  prune(arr, now);
}

// Messages per second over the sliding window, with each person's contribution capped.
function getDensity(channelId, now = Date.now()) {
  const arr = events.get(channelId);
  if (!arr) return 0;
  prune(arr, now);
  if (arr.length === 0) { events.delete(channelId); return 0; }
  let count = arr.length;
  if (cfg.perUserCap > 0) {
    const perUser = new Map();
    for (const e of arr) perUser.set(e.u, (perUser.get(e.u) || 0) + 1);
    count = 0;
    for (const n of perUser.values()) count += Math.min(n, cfg.perUserCap);
  }
  return count / cfg.windowSeconds;
}

// How fast a channel's drop clock runs: 0 below the threshold, 1x at refDensity, capped at maxMultiplier.
function multiplier(d) {
  if (d < cfg.minDensity) return 0;
  return Math.min(cfg.maxMultiplier, d / cfg.refDensity);
}

module.exports = { record, getDensity, multiplier, channelIds };

=== src/economy/drops.js ===
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const config = require("../../config");
const store = require("./store");
const wallet = require("./wallet");
const density = require("./density");
const logger = require("../utils/logger");
const { randomInt, weightedPick, skewedFloat } = require("../utils/random");

const drops = new Map();   // live drops by id (rebuilt from the saved copy after a restart)
const clocks = new Map();  // channelId -> { effectiveSec, targetSec, lastDropAt }
let pending = 0;           // drops currently being posted; they count against the cap
let tickHandle = null;
let lastTickAt = 0;
let clientRef = null;

// ---------- persistence (so a restart can't orphan a drop message) ----------
function persist(drop) {
  store.update((data) => {
    if (!data.drops) data.drops = {};
    data.drops[drop.id] = { id: drop.id, channelId: drop.channelId, messageId: drop.messageId, amount: drop.amount, createdAt: drop.createdAt, expiresAt: drop.expiresAt };
  });
}
function unpersist(id) {
  if (!store.data.drops || !store.data.drops[id]) return;
  store.update((data) => { delete data.drops[id]; });
}

// ---------- cap on simultaneous drops (all channels combined) ----------
function activeCount() {
  let n = pending;
  for (const d of drops.values()) if (!d.claimed && !d.expired) n++;
  return n;
}

// Base delay for the next drop, in "active-chat seconds". Longer delays are more likely than shorter ones.
function newTargetSec() {
  const { intervalMinMinutes, intervalMaxMinutes, delaySkew } = config.drops;
  return skewedFloat(intervalMinMinutes, intervalMaxMinutes, delaySkew) * 60;
}

// Runs every tickSeconds. Each channel has its own clock that only advances while people are chatting,
// and advances faster the busier the chat is. When it reaches its target, a drop is posted -
// unless the global cap is full, in which case the most overdue channel gets the next free slot.
function tick() {
  const now = Date.now();
  const dt = Math.min((now - lastTickAt) / 1000, config.drops.tickSeconds * 3); // cap so a stall/sleep can't skip ahead
  lastTickAt = now;

  const due = [];
  for (const [channelId, clock] of clocks) {
    const d = density.getDensity(channelId, now);
    const m = density.multiplier(d);
    if (m === 0) continue; // too quiet: clock paused, no drop possible
    clock.effectiveSec += dt * m;
    if (clock.effectiveSec < clock.targetSec) continue;
    if (now - clock.lastDropAt < config.drops.minGapMinutes * 60000) continue; // hard real-time floor
    due.push({ channelId, clock, d, m });
  }

  due.sort((a, b) => (b.clock.effectiveSec - b.clock.targetSec) - (a.clock.effectiveSec - a.clock.targetSec));
  const cap = config.drops.maxActiveDrops;
  for (const { channelId, clock, d, m } of due) {
    if (cap != null && activeCount() >= cap) break; // cap full: these clocks stay "due" and fire when a slot frees up
    clock.effectiveSec = 0;
    clock.targetSec = newTargetSec();
    clock.lastDropAt = now;
    pending++;
    postDrop(channelId, d, m);
  }
}

async function postDrop(channelId, d, m) {
  try {
    const channel = clientRef.channels.cache.get(channelId) || await clientRef.channels.fetch(channelId).catch(() => null);
    if (!channel) { logger.error("drop channel not found", { channelId }); return; }
    const entry = weightedPick(config.drops.table);
    const amount = randomInt(entry.min, entry.max);
    const id = Math.random().toString(36).slice(2, 10);
    const embed = new EmbedBuilder().setTitle(config.drops.embedTitle).setDescription(config.drops.embedDescription);
    const btn = new ButtonBuilder().setCustomId(`drop:${id}`).setLabel(config.drops.claimButtonLabel).setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder().addComponents(btn);
    const msg = await channel.send({ embeds: [embed], components: [row] });
    const expiresAt = Date.now() + config.drops.claimWindowMinutes * 60000;
    const drop = { id, amount, messageId: msg.id, channelId: channel.id, createdAt: Date.now(), expiresAt, claimed: false, claimedBy: null, expired: false, timer: null };
    drop.timer = setTimeout(() => expire(drop), config.drops.claimWindowMinutes * 60000);
    drops.set(id, drop);
    persist(drop);
    logger.info("drop posted", { channelId, amount, density: Number(d.toFixed(3)), speed: Number(m.toFixed(2)), active: activeCount() });
  } catch (e) {
    logger.error("drop post failed", { e: e.message });
  } finally {
    pending--;
  }
}

async function deleteDropMessage(channelId, messageId) {
  try {
    const channel = await clientRef.channels.fetch(channelId).catch(() => null);
    if (channel) await channel.messages.delete(messageId).catch(() => {});
  } catch (_) {}
}

async function expire(drop) {
  if (drop.claimed || drop.expired) return;
  drop.expired = true;
  await deleteDropMessage(drop.channelId, drop.messageId);
  unpersist(drop.id);
  setTimeout(() => drops.delete(drop.id), 60000);
}

async function claim(interaction) {
  const id = interaction.customId.split(":")[1];
  const drop = drops.get(id);
  if (!drop) {
    return interaction.reply({ content: "This drop is no longer active.", ephemeral: true });
  }
  if (drop.claimed) {
    return interaction.reply({ content: "Already claimed.", ephemeral: true });
  }
  if (Date.now() >= drop.expiresAt || drop.expired) {
    drop.expired = true;
    return interaction.reply({ content: config.drops.expiredText, ephemeral: true });
  }
  // atomic
  drop.claimed = true;
  drop.claimedBy = interaction.user.id;
  if (drop.timer) { clearTimeout(drop.timer); drop.timer = null; }
  unpersist(drop.id);
  await interaction.deferUpdate().catch(() => {});
  wallet.credit(drop.claimedBy, drop.amount, "drop");
  // edit message
  try {
    const embed = new EmbedBuilder().setTitle(config.drops.embedTitle).setDescription(`Claimed by <@${drop.claimedBy}> (+${drop.amount})`);
    const btn = new ButtonBuilder().setCustomId(`drop:${drop.id}`).setLabel(config.drops.claimButtonLabel).setStyle(ButtonStyle.Primary).setDisabled(true);
    const row = new ActionRowBuilder().addComponents(btn);
    await interaction.message.edit({ embeds: [embed], components: [row] }).catch(() => {});
  } catch (_) {}
  await interaction.followUp({ content: `You claimed ${drop.amount} 🪙 SterCoins!`, ephemeral: true }).catch(() => {});
  setTimeout(() => drops.delete(drop.id), 60000);
}

// After a restart: drops that are still inside their claim window come back to life (buttons keep working,
// they still expire on schedule); drops whose window ended while the bot was down get their message deleted.
function restoreDrops() {
  const saved = Object.values((store.data && store.data.drops) || {});
  if (!saved.length) return;
  const now = Date.now();
  const stale = [];
  for (const rec of saved) {
    if (rec.expiresAt <= now) { stale.push(rec); continue; }
    const drop = { ...rec, claimed: false, claimedBy: null, expired: false, timer: null };
    drop.timer = setTimeout(() => expire(drop), rec.expiresAt - now);
    drops.set(drop.id, drop);
  }
  logger.info("restored drops after restart", { live: saved.length - stale.length, expiredWhileDown: stale.length });
  (async () => {
    for (const rec of stale) {
      await deleteDropMessage(rec.channelId, rec.messageId);
      unpersist(rec.id);
    }
  })().catch((e) => logger.error("drop sweep failed", { e: e.message }));
}

function init(client) {
  clientRef = client;
  restoreDrops(); // always, even if drops are now disabled, so no old drop message is left behind
  if (!config.drops.enabled) return;
  const now = Date.now();
  for (const channelId of density.channelIds()) {
    clocks.set(channelId, { effectiveSec: 0, targetSec: newTargetSec(), lastDropAt: now });
  }
  lastTickAt = now;
  tickHandle = setInterval(tick, config.drops.tickSeconds * 1000);
}

function verifyChannel(client) {
  for (const channelId of density.channelIds()) {
    if (!client.channels.cache.get(channelId)) logger.warn("drop channel not cached; will fetch on post", { channelId });
  }
}

module.exports = { init, verifyChannel, claim };

=== src/economy/store.js ===
const fs = require("fs");
const path = require("path");
const config = require("../../config");
const logger = require("../utils/logger");

const store = {
  data: null,
  dirty: false,
  timer: null,
  flushing: null,
  backupTimer: null,
  lastBackupUpdatedAt: null,
  started: false,
};

function ensureDirs() {
  const dir = path.dirname(config.storage.path);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const bdir = path.join(dir, "backups");
  if (!fs.existsSync(bdir)) fs.mkdirSync(bdir, { recursive: true });
}

function fresh() {
  return { schemaVersion: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), users: {} };
}

function validateStructure(d) {
  return d && typeof d === "object" && d.users && typeof d.users === "object" && typeof d.schemaVersion === "number";
}

async function load() {
  ensureDirs();
  const tmp = config.storage.path + ".tmp";
  if (fs.existsSync(tmp)) { try { fs.unlinkSync(tmp); } catch(e){} }
  if (!fs.existsSync(config.storage.path)) {
    store.data = fresh();
    await flushNow();
    return;
  }
  let raw;
  try { raw = fs.readFileSync(config.storage.path, "utf8"); }
  catch (e) { logger.error("read failed", { e: e.message }); process.exit(1); }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) {
    const ts = Date.now();
    const corruptPath = `data/backups/corrupt-${ts}.json`;
    try { fs.copyFileSync(config.storage.path, corruptPath); } catch(_){}
    logger.error("data.json unparseable; copied to " + corruptPath);
    process.exit(1);
  }
  if (!validateStructure(parsed)) {
    logger.error("invalid structure");
    process.exit(1);
  }
  if (parsed.schemaVersion > 1) { logger.error("newer schema"); process.exit(1); }
  store.data = parsed;
}

function scheduleFlush() {
  store.dirty = true;
  if (store.timer) return;
  store.timer = setTimeout(() => { store.timer = null; flush(); }, config.storage.flushIntervalMs);
}

async function flush() {
  if (store.flushing) { await store.flushing; if (store.dirty) scheduleFlush(); return; }
  if (!store.dirty) return;
  store.dirty = false;
  const p = (async () => {
    try {
      store.data.updatedAt = new Date().toISOString();
      const tmp = config.storage.path + ".tmp";
      const str = JSON.stringify(store.data, null, 2);
      fs.writeFileSync(tmp, str);
      try { const fd = fs.openSync(tmp, "r+"); fs.fsyncSync(fd); fs.closeSync(fd); } catch(_){}
      fs.renameSync(tmp, config.storage.path);
    } catch (e) {
      store.dirty = true;
      logger.error("save failed", { e: e.message });
    }
  })();
  store.flushing = p;
  await p;
  store.flushing = null;
}

async function flushNow() {
  if (store.timer) { clearTimeout(store.timer); store.timer = null; }
  store.dirty = true;
  await flush();
}

function getUser(userId) {
  return store.data.users[userId];
}

function ensureUser(userId) {
  let u = store.data.users[userId];
  if (!u) {
    u = { balance: config.economy.startingBalance, lastDailyAt: null, lastActivityRewardAt: null, totalEarned: 0, totalGifted: 0, totalReceived: 0, createdAt: Date.now() };
    store.data.users[userId] = u;
    scheduleFlush();
  }
  return u;
}

function update(fn) {
  fn(store.data);
  scheduleFlush();
}

function snapshot() {
  return JSON.parse(JSON.stringify(store.data));
}

function start() {
  store.started = true;
}

function stop() {
  if (store.timer) { clearTimeout(store.timer); store.timer = null; }
}

function startBackupTimer() {
  if (!config.storage.backupsEnabled) return;
  store.backupTimer = setInterval(() => {
    try {
      if (!fs.existsSync(config.storage.path)) return;
      const cur = JSON.parse(fs.readFileSync(config.storage.path, "utf8"));
      if (store.lastBackupUpdatedAt === cur.updatedAt) return;
      const dir = path.dirname(config.storage.path);
      const bdir = path.join(dir, "backups");
      if (!fs.existsSync(bdir)) fs.mkdirSync(bdir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      fs.copyFileSync(config.storage.path, path.join(bdir, `data-${ts}.json`));
      // prune
      const files = fs.readdirSync(bdir).filter(f=>f.startsWith("data-")).sort();
      const keep = config.storage.backupsToKeep;
      if (files.length > keep) {
        for (const f of files.slice(0, files.length - keep)) {
          try { fs.unlinkSync(path.join(bdir, f)); } catch(_){}
        }
      }
      store.lastBackupUpdatedAt = cur.updatedAt;
    } catch (e) { logger.error("backup failed", { e: e.message }); }
  }, config.storage.backupIntervalMinutes * 60000);
}

store.load = load;
store.flush = flush;
store.flushNow = flushNow;
store.getUser = getUser;
store.ensureUser = ensureUser;
store.update = update;
store.snapshot = snapshot;
store.start = start;
store.stop = stop;
store.startBackupTimer = startBackupTimer;

module.exports = store;

=== src/economy/wallet.js ===
const config = require("../../config");
const store = require("./store");
const logger = require("../utils/logger");
const { randomInt } = require("../utils/random");

function getRecord(userId) { return store.getUser(userId); }

function getBalance(userId) {
  const u = store.getUser(userId);
  return u ? u.balance : config.economy.startingBalance;
}

function credit(userId, amount, reason) {
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, code: "INVALID_AMOUNT" };
  const u = store.ensureUser(userId);
  u.balance += amount;
  if (reason === "activity" || reason === "daily" || reason === "drop") u.totalEarned += amount;
  store.update(() => {}); logger.info("credit", { reason, userId, amount, balance: u.balance });
  return { ok: true, balance: u.balance };
}

function debit(userId, amount, reason) {
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, code: "INVALID_AMOUNT" };
  const u = store.ensureUser(userId);
  if (u.balance < amount) return { ok: false, code: "INSUFFICIENT_FUNDS", balance: u.balance };
  u.balance -= amount;
  if (reason === "gift_sent") u.totalGifted += amount;
  store.update(() => {}); logger.info("debit", { reason, userId, amount, balance: u.balance });
  return { ok: true, balance: u.balance };
}

function transfer(fromId, toId, amount) {
  if (fromId === toId) return { ok: false, code: "SELF_TRANSFER" };
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, code: "INVALID_AMOUNT" };
  let result;
  store.update((data) => {
    const from = data.users[fromId] || null;
    // ensure records
    if (!data.users[fromId]) data.users[fromId] = { balance: config.economy.startingBalance, lastDailyAt: null, lastActivityRewardAt: null, totalEarned: 0, totalGifted: 0, totalReceived: 0, createdAt: Date.now() };
    if (!data.users[toId]) data.users[toId] = { balance: config.economy.startingBalance, lastDailyAt: null, lastActivityRewardAt: null, totalEarned: 0, totalGifted: 0, totalReceived: 0, createdAt: Date.now() };
    const fu = data.users[fromId];
    const tu = data.users[toId];
    if (fu.balance < amount) { result = { ok: false, code: "INSUFFICIENT_FUNDS" }; return; }
    fu.balance -= amount;
    fu.totalGifted += amount;
    tu.balance += amount;
    tu.totalReceived += amount;
    result = { ok: true };
  });
  return result;
}

function canClaimDaily(userId, nowTs) {
  const u = store.getUser(userId);
  if (!u || u.lastDailyAt == null) return { ok: true, remainingMs: 0 };
  const cooldownMs = config.daily.cooldownHours * 3600 * 1000;
  const rem = (u.lastDailyAt + cooldownMs) - nowTs;
  if (rem <= 0) return { ok: true, remainingMs: 0 };
  return { ok: false, remainingMs: rem };
}

function claimDaily(userId, nowTs) {
  const check = canClaimDaily(userId, nowTs);
  if (!check.ok) return { ok: false, code: "ON_COOLDOWN", remainingMs: check.remainingMs };
  const amount = randomInt(config.daily.amountMin, config.daily.amountMax);
  const u = store.ensureUser(userId);
  u.balance += amount;
  u.totalEarned += amount;
  u.lastDailyAt = nowTs;
  store.update(() => {});
  // ensure persisted via ensureUser already scheduled? ensureUser schedules flush on create only; need schedule
  // schedule flush manually:
  // store.update already called above with no-op schedules flush
  logger.info("daily", { userId, amount, balance: u.balance });
  return { ok: true, amount, balance: u.balance };
}

function getLeaderboard(size) {
  const data = store.snapshot();
  const entries = Object.entries(data.users)
    .map(([id, u]) => ({ id, balance: u.balance, createdAt: u.createdAt }))
    .filter(e => e.balance > 0)
    .sort((a,b) => b.balance - a.balance || a.createdAt - b.createdAt)
    .slice(0, size);
  return entries;
}

module.exports = { getBalance, credit, debit, transfer, canClaimDaily, claimDaily, getLeaderboard };

=== src/events/interactionCreate.js ===
const commands = require("../commands");
const drops = require("../economy/drops");

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        const cmd = commands.find(c => c.name === interaction.commandName);
        if (!cmd) return interaction.reply({ content: "Unknown command.", ephemeral: true });
        await cmd.executeSlash(interaction);
      } else if (interaction.isButton() && interaction.customId.startsWith("drop:")) {
        await drops.claim(interaction);
      }
    } catch (e) {
      console.error(e);
      if (interaction.replied || interaction.deferred) {
        interaction.followUp({ content: "Something went wrong.", ephemeral: true }).catch(()=>{});
      } else {
        interaction.reply({ content: "Something went wrong.", ephemeral: true }).catch(()=>{});
      }
    }
  },
};

=== src/events/messageCreate.js ===
const density = require("../economy/density")
const config = require("../../config");
const activity = require("../economy/activity");
const commands = require("../commands");

module.exports = {
  name: "messageCreate",
  async execute(message) {
    try {
      if (message.author.bot) return;
      if (!message.guild || message.guild.id !== config.discord.guildId) return;
      if (message.webhookId) return;
      density.record(message);
      activity.tryReward(message);
      const prefix = config.commands.prefix;
      if (!message.content.startsWith(prefix)) return;
      const body = message.content.slice(prefix.length).trim();
      if (!body) return;
      const parts = body.split(/\s+/);
      const name = parts[0].toLowerCase();
      const args = parts.slice(1);
      const cmd = commands.find(c => c.name === name || (Array.isArray(c.aliases) && c.aliases.includes(name)));
      if (!cmd) return;
      await cmd.executePrefix(message, args);
    } catch (e) {
      console.error(e);
    }
  },
};

=== src/events/ready.js ===
const config = require("../../config");
const store = require("../economy/store");
const drops = require("../economy/drops");
const logger = require("../utils/logger");

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    logger.info("ready", { tag: client.user.tag });
    const guild = client.guilds.cache.get(config.discord.guildId);
    if (!guild) { logger.error("guild not found"); process.exit(1); }
    store.startBackupTimer();
    drops.init(client);
    drops.verifyChannel(client);
  },
};

=== src/events/shutdown.js ===
const store = require("../economy/store");

module.exports = async function shutdown(client) {
  try { store.stop(); await store.flushNow(); } catch(e){ console.error(e); }
  try { client.destroy(); } catch(_){}
  process.exit(0);
};

=== src/utils/config-validate.js ===
const config = require("../../config");
function isNumStr(v){ return typeof v === "string" && /^\d+$/.test(v); }
function validate(cfg) {
  const errors = [];
  const e = (msg) => errors.push(msg);
  if (!isNumStr(cfg.discord.guildId)) e("discord.guildId must be numeric string");
  if (!isNumStr(cfg.channels.generalChatId) || cfg.channels.generalChatId === "PASTE_CHANNEL_ID") e("channels.generalChatId invalid");
  if (typeof cfg.currency.name !== "string" || !cfg.currency.name) e("currency.name");
  if (typeof cfg.currency.plural !== "string" || !cfg.currency.plural) e("currency.plural");
  if (typeof cfg.commands.prefix !== "string" || !cfg.commands.prefix || /\s/.test(cfg.commands.prefix)) e("commands.prefix");
  if (!Number.isInteger(cfg.economy.startingBalance) || cfg.economy.startingBalance < 0) e("economy.startingBalance");
  if (!Number.isInteger(cfg.activity.cooldownSeconds) || cfg.activity.cooldownSeconds <= 0) e("activity.cooldownSeconds");
  if (!Number.isInteger(cfg.activity.amountMin) || cfg.activity.amountMin < 0) e("activity.amountMin");
  if (!Number.isInteger(cfg.activity.amountMax) || cfg.activity.amountMax < 0) e("activity.amountMax");
  if (cfg.activity.amountMin > cfg.activity.amountMax) e("activity amountMin>amountMax");
  if (!Array.isArray(cfg.activity.ignoredChannelIds) || !cfg.activity.ignoredChannelIds.every(isNumStr)) e("activity.ignoredChannelIds");
  if (!Number.isInteger(cfg.daily.amountMin) || cfg.daily.amountMin < 0) e("daily.amountMin");
  if (!Number.isInteger(cfg.daily.amountMax) || cfg.daily.amountMax < 0) e("daily.amountMax");
  if (cfg.daily.amountMin > cfg.daily.amountMax) e("daily amountMin>amountMax");
  if (typeof cfg.daily.cooldownHours !== "number" || cfg.daily.cooldownHours <= 0) e("daily.cooldownHours");
  if (!Number.isInteger(cfg.drops.intervalMinMinutes) || cfg.drops.intervalMinMinutes <= 0) e("drops.intervalMinMinutes");
  if (!Number.isInteger(cfg.drops.intervalMaxMinutes) || cfg.drops.intervalMaxMinutes <= 0) e("drops.intervalMaxMinutes");
  if (cfg.drops.intervalMinMinutes > cfg.drops.intervalMaxMinutes) e("drops intervalMin>intervalMax");
  if (!Number.isInteger(cfg.drops.claimWindowMinutes) || cfg.drops.claimWindowMinutes <= 0) e("drops.claimWindowMinutes");
  if (cfg.drops.claimWindowMinutes > cfg.drops.minGapMinutes) console.warn("[config] claim window longer than min gap (overlapping drops allowed)");
  if (!Array.isArray(cfg.drops.table) || cfg.drops.table.length === 0) e("drops.table");
  let total = 0;
  for (const t of cfg.drops.table || []) {
    if (!Number.isInteger(t.weight) || t.weight <= 0) e("drops.table weight");
    if (!Number.isInteger(t.min) || t.min < 0) e("drops.table min");
    if (!Number.isInteger(t.max) || t.max < 0) e("drops.table max");
    if (t.min > t.max) e("drops.table min>max");
    total += t.weight;
  }
  if (total <= 0) e("drops.table total weight");
  if (!Number.isInteger(cfg.gift.minAmount) || cfg.gift.minAmount <= 0) e("gift.minAmount");
  if (cfg.gift.maxAmount !== null && (!Number.isInteger(cfg.gift.maxAmount) || cfg.gift.maxAmount < cfg.gift.minAmount)) e("gift.maxAmount");
  if (!Number.isInteger(cfg.leaderboard.size) || cfg.leaderboard.size < 1 || cfg.leaderboard.size > 25) e("leaderboard.size");
  if (!Number.isInteger(cfg.storage.flushIntervalMs) || cfg.storage.flushIntervalMs < 500) e("storage.flushIntervalMs");
  if (!Number.isInteger(cfg.storage.backupIntervalMinutes) || cfg.storage.backupIntervalMinutes <= 0) e("storage.backupIntervalMinutes");
  if (!Number.isInteger(cfg.storage.backupsToKeep) || cfg.storage.backupsToKeep <= 0) e("storage.backupsToKeep");
  const dr = cfg.drops, dn = dr.density || {};
  const posNum = (x) => typeof x === "number" && Number.isFinite(x) && x > 0;
  if (!Array.isArray(dr.eligibleChannelIds) || !dr.eligibleChannelIds.every(isNumStr)) e("drops.eligibleChannelIds");
  if (!posNum(dr.delaySkew) || dr.delaySkew < 1) e("drops.delaySkew must be >= 1");
  if (typeof dr.minGapMinutes !== "number" || dr.minGapMinutes < 0) e("drops.minGapMinutes");
  if (!Number.isInteger(dr.tickSeconds) || dr.tickSeconds < 1) e("drops.tickSeconds");
  if (!posNum(dn.windowSeconds)) e("drops.density.windowSeconds");
  if (!Number.isInteger(dn.perUserCap) || dn.perUserCap < 0) e("drops.density.perUserCap");
  if (!posNum(dn.minDensity)) e("drops.density.minDensity");
  if (!posNum(dn.refDensity)) e("drops.density.refDensity");
  if (!posNum(dn.maxMultiplier)) e("drops.density.maxMultiplier");
  if (dn.perUserCap > 0 && dn.perUserCap / dn.windowSeconds >= dn.minDensity) console.warn("[config] drops.density: one person alone can reach minDensity");
  return errors;
}
module.exports = { validate };

=== src/utils/format.js ===
const config = require("../../config");
function formatAmount(n){ const sep = config.currency.thousandsSeparator; const s = sep ? n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep) : n.toString(); const label = n === 1 ? config.currency.name : config.currency.plural; return `${config.currency.emoji} ${s} ${label}`; }
function formatDuration(ms){ if (ms < 1000) return `${ms}ms`; const s = Math.floor(ms/1000); if (s < 60) return `${s}s`; const m = Math.floor(s/60); const remS = s % 60; if (m < 60) return remS ? `${m}m ${remS}s` : `${m}m`; const h = Math.floor(m/60); const remM = m % 60; return remM ? `${h}h ${remM}m` : `${h}h`; }
module.exports = { formatAmount, formatDuration };

=== src/utils/logger.js ===
const level = (process.env.LOG_LEVEL || "info").toLowerCase();
const order = { debug:0, info:1, warn:2, error:3 };
function log(lvl, msg, ctx){ if ((order[lvl]||1) < (order[level]||1)) return; const line = `${new Date().toISOString()} [${lvl.toUpperCase()}] ${msg}${ctx ? " " + JSON.stringify(ctx) : ""}`; console.log(line); }
module.exports = { debug:(m,c)=>log("debug",m,c), info:(m,c)=>log("info",m,c), warn:(m,c)=>log("warn",m,c), error:(m,c)=>log("error",m,c) };

=== src/utils/random.js ===
function randomInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function weightedPick(entries){ const total = entries.reduce((s,e)=>s+e.weight,0); let r = Math.floor(Math.random()*total)+1; for (const e of entries){ r -= e.weight; if (r <= 0) return e; } return entries[entries.length-1]; }
module.exports = { randomInt, weightedPick };
function skewedFloat(min, max, shape = 1){ return min + (max - min) * Math.pow(Math.random(), 1 / shape); }
module.exports = { randomInt, weightedPick, skewedFloat };

=== src/utils/time.js ===
const config = require("../../config");
function now(){ return Date.now(); }
function cooldownRemaining(lastAt, cooldownMs, n = now()){ if (lastAt == null) return 0; const rem = (lastAt + cooldownMs) - n; return rem > 0 ? rem : 0; }
function randomIntervalMs(minMinutes, maxMinutes){ return (minMinutes + Math.random()*(maxMinutes-minMinutes))*60000; }
module.exports = { now, cooldownRemaining, randomIntervalMs };
