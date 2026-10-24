const { MessageFlags } = require("discord.js");
const commands = require("../commands");
const drops = require("../economy/drops");

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        const cmd = commands.find(c => c.name === interaction.commandName);
        if (!cmd) return interaction.reply({ content: "Unknown command.", flags: MessageFlags.Ephemeral });
        await cmd.executeSlash(interaction);
      } else if (interaction.isButton() && interaction.customId.startsWith("drop:")) {
        await drops.claim(interaction);
      }
    } catch (e) {
      console.error(e);
      if (interaction.replied || interaction.deferred) {
        interaction.followUp({ content: "Something went wrong.", flags: MessageFlags.Ephemeral }).catch(()=>{});
      } else {
        interaction.reply({ content: "Something went wrong.", flags: MessageFlags.Ephemeral }).catch(()=>{});
      }
    }
  },
};
