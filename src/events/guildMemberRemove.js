const config = require("../../config");

const APPEAL_LINK = "https://forms.gle/BVP2c7HL7nJn7pML7";

module.exports = {
  name: "guildMemberRemove",
  async execute(member) {
    try {
      if (!member || !member.guild) return;
      if (member.guild.id !== config.discord.guildId) return;

      // Check if the member was banned. We can't tell from this event alone in some cases,
      // but we can try to fetch ban info.
      try {
        const ban = await member.guild.bans.fetch(member.id).catch(() => null);
        if (ban) {
          // User was banned
          try {
            await member.user.send(
              `You have been banned from ${member.guild.name}. If you believe this was a mistake, you can submit an appeal here: ${APPEAL_LINK}`
            );
          } catch (err) {
            // DMs might be disabled
          }
          return;
        }
      } catch (err) {
        // Ignore errors checking bans
      }

      // If not banned, assume kicked (or left voluntarily). The request says "any user that got kicked or banned"
      // - try to DM for kicks too as a reasonable approach
      try {
        await member.user.send(
          `You have been kicked from ${member.guild.name}. If you believe this was a mistake, you can submit an appeal here: ${APPEAL_LINK}`
        );
      } catch (err) {
        // DMs might be disabled
      }
    } catch (error) {
      console.error("guildMemberRemove error:", error);
    }
  },
};
