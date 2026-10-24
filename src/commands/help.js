const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const config = require("../../config");

function helpText() {
  const list = require("./index")
    .map(c => `\`/${c.name}\` or \`${config.commands.prefix}${c.name}\``)
    .join("\n");
  return "**Commands**\n" + list + `\nTip: \`${config.commands.prefix}h\` also works for help, and \`${config.commands.prefix}lb\` for the leaderboard.`;
}

module.exports = {
  name: "help",
  aliases: ["h"],
  slash: new SlashCommandBuilder().setName("help").setDescription("Show commands"),
  async executeSlash(interaction) {
    await interaction.reply({ content: helpText(), flags: MessageFlags.Ephemeral });
  },
  async executePrefix(message) {
    await message.reply({ content: helpText(), allowedMentions: { repliedUser: false } });
  },
};
