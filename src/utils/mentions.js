const MENTION_PATTERN = /<@!?(\d+)>/g;

function getExplicitMentionedUsers(message) {
  const content = typeof message?.content === "string" ? message.content : "";
  const ids = new Set();
  for (const match of content.matchAll(MENTION_PATTERN)) {
    ids.add(match[1]);
  }

  const collection = message?.mentions?.users;
  const users = [];
  for (const id of ids) {
    const user = collection?.get?.(id) || collection?.cache?.get?.(id) || null;
    if (user) users.push(user);
  }
  return users;
}

function firstExplicitMentionedUser(message) {
  return getExplicitMentionedUsers(message)[0] || null;
}

function stripMentionTokens(tokens) {
  return tokens.filter((token) => !/^<@!?\d+>$/.test(token));
}

module.exports = { getExplicitMentionedUsers, firstExplicitMentionedUser, stripMentionTokens };
