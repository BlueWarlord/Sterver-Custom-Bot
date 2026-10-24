const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  name: "ping",
  aliases: [],
  slash: new SlashCommandBuilder().setName("ping").setDescription("Check bot latency"),
  async executeSlash(interaction) {
    const start = Date.now();
    await interaction.reply({ content: "Pinging..." });
    const rtt = Date.now() - start;
    await interaction.editReply({ content: `Pong! ${rtt}ms` });
  },
  async executePrefix(message, args) {
    const start = Date.now();
    const reply = await message.reply({ content: "Pinging...", allowedMentions: { repliedUser: false } });
    const rtt = Date.now() - start;
    await reply.edit({ content: `Pong! ${rtt}ms` });
  },
};
