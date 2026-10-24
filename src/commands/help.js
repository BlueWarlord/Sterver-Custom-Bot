const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const config = require("../../config");
const { formatDuration } = require("../utils/format");

const THEME_COLOR = 0xf1c40f;
const ERROR_COLOR = 0xe74c3c;
const CATEGORY_ORDER = ["Economy", "Games", "Info"];
const CATEGORY_ICONS = { Economy: "💰", Games: "🎲", Info: "📖" };

const COMMAND_META = {
  balance: { category: "Economy", example: ".balance @Sterver" },
  daily: { category: "Economy", example: ".daily" },
  give: { category: "Economy", example: ".give @Sterver 100" },
  leaderboard: { category: "Economy", example: ".leaderboard" },
  coinflip: { category: "Games", example: ".coinflip 100 heads" },
  blackjack: { category: "Games", example: ".blackjack 100" },
  help: { category: "Info", example: ".help coinflip" },
};

function allCommands() {
  return require("./index");
}

function slashJson(cmd) {
  try {
    return typeof cmd.slash.toJSON === "function" ? cmd.slash.toJSON() : cmd.slash;
  } catch (_) {
    return { name: cmd.name, description: "" };
  }
}

function optionList(cmd) {
  const options = slashJson(cmd).options;
  return Array.isArray(options) ? options : [];
}

function coin(n) {
  const sep = config.currency.thousandsSeparator;
  const s = sep ? n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep) : n.toString();
  return `${config.currency.emoji} ${s}`;
}

function slashUsage(cmd) {
  const parts = optionList(cmd).map(o => o.required ? `<${o.name}>` : `[${o.name}]`);
  return `/${cmd.name}${parts.length ? " " + parts.join(" ") : ""}`;
}

function prefixUsage(cmd) {
  const parts = optionList(cmd).map(o => {
    const label = o.type === 6 ? "@user" : o.name;
    return o.required ? `<${label}>` : `[${label}]`;
  });
  return `${config.commands.prefix}${cmd.name}${parts.length ? " " + parts.join(" ") : ""}`;
}

function optionLines(cmd) {
  return optionList(cmd).map(o => {
    const notes = [];
    if (o.required) notes.push("required");
    if (Array.isArray(o.choices) && o.choices.length) {
      notes.push(o.choices.map(c => c.name).join(", "));
    }
    const note = notes.length ? ` (${notes.join(" · ")})` : "";
    return `**${o.name}**${note} — ${o.description || "No description"}`;
  });
}

function limitsFor(cmd) {
  switch (cmd.name) {
    case "coinflip":
      if (!config.gambling.enabled) return "Gambling is currently disabled.";
      return `Bet ${coin(config.gambling.minBet)} – ${coin(config.gambling.maxBet)} · ${formatDuration(config.gambling.cooldownSeconds * 1000)} cooldown`;
    case "blackjack": {
      const bj = config.blackjack || {};
      if (!config.gambling.enabled) return "Gambling is currently disabled.";
      const min = bj.minBet != null ? bj.minBet : config.gambling.minBet;
      const max = bj.maxBet != null ? bj.maxBet : config.gambling.maxBet;
      const cooldown = bj.cooldownSeconds != null ? bj.cooldownSeconds : config.gambling.cooldownSeconds;
      return `Bet ${coin(min)} – ${coin(max)} · ${formatDuration(cooldown * 1000)} cooldown · ${formatDuration(bj.timeoutMs || 60000)} per turn`;
    }
    case "daily":
      if (!config.daily.enabled) return "Daily rewards are currently disabled.";
      return `${coin(config.daily.amountMin)} – ${coin(config.daily.amountMax)} every ${config.daily.cooldownHours}h`;
    case "give": {
      if (!config.gift.enabled) return "Gifting is currently disabled.";
      const max = config.gift.maxAmount != null ? ` · max ${coin(config.gift.maxAmount)}` : "";
      return `Min ${coin(config.gift.minAmount)}${max} · self-gifting ${config.gift.allowSelf ? "allowed" : "blocked"}`;
    }
    case "leaderboard":
      return `Top ${config.leaderboard.size} balances`;
    default:
      return null;
  }
}

function commandLine(cmd) {
  const aliases = Array.isArray(cmd.aliases) ? cmd.aliases : [];
  const aliasText = aliases.length ? ` · ${aliases.map(a => `\`${config.commands.prefix}${a}\``).join(", ")}` : "";
  const description = slashJson(cmd).description || "No description";
  return `**/${cmd.name}**${aliasText} — ${description}`;
}

function avatarOf(client) {
  return client && client.user ? client.user.displayAvatarURL() : undefined;
}

function overviewEmbed(client) {
  const commands = allCommands();
  const groups = new Map(CATEGORY_ORDER.map(c => [c, []]));
  for (const cmd of commands) {
    const category = (COMMAND_META[cmd.name] && COMMAND_META[cmd.name].category) || "Info";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(cmd);
  }

  const embed = new EmbedBuilder()
    .setColor(THEME_COLOR)
    .setAuthor({ name: "SterBot Command Guide", iconURL: avatarOf(client) })
    .setDescription(
      `Earn and spend ${config.currency.plural}, then climb the leaderboard.\n` +
      `Every command works as a **slash command** or with the \`${config.commands.prefix}\` prefix.`
    )
    .setFooter({ text: `${commands.length} commands · ${config.commands.prefix}help <command> for details` })
    .setTimestamp();

  for (const [category, list] of groups) {
    if (!list.length) continue;
    embed.addFields({
      name: `${CATEGORY_ICONS[category] || "📖"} ${category}`,
      value: list.map(commandLine).join("\n"),
    });
  }

  embed.addFields({
    name: "💡 Getting started",
    value: `Chat to earn ${config.currency.plural}, claim drops when they appear, and grab \`${config.commands.prefix}daily\` for a bonus.`,
  });

  return embed;
}

function detailEmbed(client, cmd) {
  const meta = COMMAND_META[cmd.name] || {};
  const embed = new EmbedBuilder()
    .setColor(THEME_COLOR)
    .setAuthor({ name: `/${cmd.name}`, iconURL: avatarOf(client) })
    .setDescription(slashJson(cmd).description || "No description")
    .addFields({ name: "Usage", value: `\`${slashUsage(cmd)}\`\n\`${prefixUsage(cmd)}\`` });

  const aliases = Array.isArray(cmd.aliases) ? cmd.aliases : [];
  if (aliases.length) {
    embed.addFields({ name: "Aliases", value: aliases.map(a => `\`${config.commands.prefix}${a}\``).join(", ") });
  }

  const options = optionLines(cmd);
  if (options.length) embed.addFields({ name: "Options", value: options.join("\n") });

  const limits = limitsFor(cmd);
  if (limits) embed.addFields({ name: "Details", value: limits });
  if (meta.example) embed.addFields({ name: "Example", value: `\`${meta.example}\`` });

  embed
    .setFooter({ text: `${meta.category || "Info"} · ${config.commands.prefix}help to see all commands` })
    .setTimestamp();

  return embed;
}

function notFoundEmbed(query, commands) {
  const suggestion = findClosest(query, commands);
  const hint = suggestion ? ` Did you mean \`${suggestion}\`?` : "";
  return new EmbedBuilder()
    .setColor(ERROR_COLOR)
    .setDescription(`No command named \`${query}\`.${hint}`)
    .setFooter({ text: `${config.commands.prefix}help to see all commands` });
}

function resolveCommand(query) {
  const name = query.trim().toLowerCase().replace(/^[/.]/, "");
  return allCommands().find(cmd =>
    cmd.name === name || (Array.isArray(cmd.aliases) && cmd.aliases.some(a => a.toLowerCase() === name))
  ) || null;
}

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = temp;
    }
  }
  return row[b.length];
}

function findClosest(query, commands) {
  const needle = query.trim().toLowerCase();
  if (!needle) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const cmd of commands) {
    for (const candidate of [cmd.name, ...(Array.isArray(cmd.aliases) ? cmd.aliases : [])]) {
      const distance = editDistance(needle, candidate.toLowerCase());
      if (distance < bestDistance) {
        bestDistance = distance;
        best = cmd.name;
      }
    }
  }
  return bestDistance <= Math.max(2, Math.floor(needle.length / 2)) ? best : null;
}

function buildEmbed(client, query) {
  const commands = allCommands();
  if (!query) return overviewEmbed(client);
  const cmd = resolveCommand(query);
  return cmd ? detailEmbed(client, cmd) : notFoundEmbed(query.trim(), commands);
}

module.exports = {
  name: "help",
  aliases: [],
  slash: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all commands or details for one")
    .addStringOption(o => o.setName("command").setDescription("Command to get details for").setRequired(false)),
  async executeSlash(interaction) {
    const query = interaction.options.getString("command");
    await interaction.reply({ embeds: [buildEmbed(interaction.client, query)], flags: MessageFlags.Ephemeral });
  },
  async executePrefix(message, args) {
    const query = args && args.length ? args[0] : null;
    await message.reply({ embeds: [buildEmbed(message.client, query)], allowedMentions: { repliedUser: false } });
  },
};
