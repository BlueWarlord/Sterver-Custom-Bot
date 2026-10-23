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
