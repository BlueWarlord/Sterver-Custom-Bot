const { AuditLogEvent, PermissionFlagsBits } = require("discord.js");
const config = require("../../config");
const logger = require("../utils/logger");

function appealSuffix() {
  const url = config.appeal?.url;
  return url ? ` If you believe this was a mistake, you can submit an appeal here: ${url}` : "";
}

async function sendDirectMessage(user, content) {
  if (!user || typeof user.send !== "function") return;
  try {
    await user.send({ content });
  } catch (_) {
    // DMs are commonly disabled.
  }
}

module.exports = {
  name: "guildMemberRemove",
  async execute(member) {
    try {
      if (!member || !member.guild) return;
      if (member.guild.id !== config.discord.guildId) return;

      const guild = member.guild;
      const me = guild.members?.me;
      if (!me) return;

      // Without Ban Members we cannot distinguish a ban from a voluntary
      // leave, so stay silent instead of sending a misleading DM.
      if (!me.permissions?.has?.(PermissionFlagsBits.BanMembers)) {
        logger.warn("departure DM skipped: Ban Members permission is missing", {
          userId: member.id,
        });
        return;
      }

      let ban;
      try {
        ban = await guild.bans.fetch(member.id);
      } catch (error) {
        // 10026 = Unknown Ban, which means the user is not banned.
        if (error.code === 10026) {
          ban = null;
        } else {
          logger.warn("ban lookup failed; departure DM skipped", {
            userId: member.id,
            error,
          });
          return;
        }
      }

      if (ban) {
        await sendDirectMessage(
          member.user,
          `You have been banned from ${guild.name}.${appealSuffix()}`
        );
        return;
      }

      // Not banned. Only claim a kick when the audit log confirms one.
      if (!me.permissions?.has?.(PermissionFlagsBits.ViewAuditLog)) {
        return;
      }

      let logs;
      try {
        logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 5 });
      } catch (error) {
        logger.warn("audit log lookup failed; departure DM skipped", {
          userId: member.id,
          error,
        });
        return;
      }

      const recentKick = logs.entries.find(
        (entry) =>
          entry.target?.id === member.id &&
          Date.now() - entry.createdTimestamp < 15000
      );
      if (!recentKick) return;

      await sendDirectMessage(
        member.user,
        `You have been kicked from ${guild.name}.${appealSuffix()}`
      );
    } catch (error) {
      logger.error("guildMemberRemove error", { error });
    }
  },
};
