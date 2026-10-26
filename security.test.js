const assert = require("node:assert");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const config = require("./config");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sterbot-security-"));
config.storage.path = path.join(tempDir, "data.json");

const store = require("./src/economy/store");
const wallet = require("./src/economy/wallet");
const inventory = require("./src/economy/inventory");
const blackjack = require("./src/economy/games/blackjack");
const drops = require("./src/economy/drops");
const logger = require("./src/utils/logger");
const { validate } = require("./src/utils/config-validate");
const { channelAllowed, commandAccess } = require("./src/utils/permissions");
const { randomInt, randomFloat, weightedPick } = require("./src/utils/random");

const loading = store.load();

function fund(userId, amount) {
  const user = store.ensureUser(userId);
  user.balance = amount;
  store.update(() => {});
  return user;
}

test("security: all economy randomness is bounded and CSPRNG-backed helpers work", () => {
  for (let i = 0; i < 50; i++) {
    const value = randomInt(5, 10);
    assert.ok(value >= 5 && value <= 10);
    assert.ok(randomFloat() >= 0 && randomFloat() < 1);
  }
  assert.strictEqual(weightedPick([]), null);
  assert.strictEqual(weightedPick([{ weight: 1, value: "only" }]).value, "only");
});

test("security: gifting to a new user then claiming daily keeps statistics finite", () => {
  fund("gift-sender", 100);
  const transfer = wallet.transfer("gift-sender", "gift-recipient", 10);
  assert.strictEqual(transfer.ok, true);

  const recipient = store.getUser("gift-recipient");
  assert.ok(Number.isFinite(recipient.totalReceived));
  assert.ok(Number.isFinite(recipient.totalEarned));

  const daily = wallet.claimDaily("gift-recipient", Date.now());
  assert.strictEqual(daily.ok, true);
  assert.ok(Number.isFinite(store.getUser("gift-recipient").totalEarned));
});

test("security: daily gift cap blocks repeated transfers", () => {
  const original = config.gift.maxPerDay;
  config.gift.maxPerDay = 5;
  try {
    fund("gift-cap-sender", 100);
    assert.strictEqual(wallet.transfer("gift-cap-sender", "gift-cap-target", 3).ok, true);
    const second = wallet.transfer("gift-cap-sender", "gift-cap-target", 3);
    assert.strictEqual(second.ok, false);
    assert.strictEqual(second.code, "GIFT_LIMIT");
    assert.strictEqual(second.remaining, 2);
  } finally {
    config.gift.maxPerDay = original;
  }
});

test("security: legacy user records are backfilled with finite statistics", () => {
  store.data.users["legacy-user"] = {
    balance: 50,
    createdAt: Date.now(),
  };
  store.update(() => {});

  const user = store.ensureUser("legacy-user");
  for (const key of ["totalEarned", "totalGifted", "totalReceived", "totalWagered", "totalWon", "totalLost", "giftSentToday"]) {
    assert.strictEqual(user[key], 0, key);
  }
  assert.strictEqual(user.lastDailyAt, null);
  assert.strictEqual(user.lastActivityRewardAt, null);
  assert.strictEqual(user.lastFlipAt, null);
  assert.strictEqual(user.lastBlackjackAt, null);
  assert.deepStrictEqual(user.inventory, {});
  assert.deepStrictEqual(user.ownedRoles, {});
});

test("security: failed role grant is refunded and not recorded", async () => {
  fund("role-fail", 1000);
  const member = {
    roles: {
      add: async () => {
        throw new Error("missing permissions");
      },
      cache: { has: () => false },
    },
  };

  const res = await inventory.buyRole("role-fail", "temp_supporter", member);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, "ROLE_ASSIGN_FAILED");
  assert.strictEqual(store.getUser("role-fail").balance, 1000);
  assert.strictEqual(store.getUser("role-fail").ownedRoles.temp_supporter, undefined);
});

test("security: role expiry cleanup does not clobber concurrent mutations", async () => {
  const roleId = "expired-test-role";
  const user = fund("cleanup-user", 1000);
  user.ownedRoles[roleId] = { expiresAt: Date.now() - 1000 };
  store.update(() => {});

  let releaseFetch;
  const fetchGate = new Promise((resolve) => {
    releaseFetch = resolve;
  });

  const guild = {
    members: {
      fetch: async () => {
        await fetchGate;
        return {
          roles: {
            cache: { has: () => true },
            remove: async () => {},
          },
        };
      },
    },
  };

  const cleanup = inventory.cleanupExpiredRoles(guild);
  await new Promise((resolve) => setImmediate(resolve));

  // Mutate the live store while cleanup is awaiting Discord.
  const live = store.ensureUser("cleanup-user");
  live.balance = 5000;
  store.update(() => {});

  releaseFetch();
  await cleanup;

  assert.strictEqual(store.getUser("cleanup-user").balance, 5000);
  assert.strictEqual(store.getUser("cleanup-user").ownedRoles[roleId], undefined);
});

test("security: failed role removal keeps the ownership record for a retry", async () => {
  const roleId = "failing-removal-role";
  const user = fund("cleanup-fail", 1000);
  user.ownedRoles[roleId] = { expiresAt: Date.now() - 1000 };
  store.update(() => {});

  const guild = {
    members: {
      fetch: async () => ({
        roles: {
          cache: { has: () => true },
          remove: async () => {
            throw new Error("missing permissions");
          },
        },
      }),
    },
  };

  await inventory.cleanupExpiredRoles(guild);
  assert.ok(store.getUser("cleanup-fail").ownedRoles[roleId], "record must remain for retry");
});

test("security: a failed item purchase never debits the wallet", () => {
  const user = fund("item-overflow", 1000);
  user.inventory.wooden_sword = Number.MAX_SAFE_INTEGER;
  store.update(() => {});

  const res = inventory.buyItem("item-overflow", "wooden_sword");
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, "INVENTORY_OVERFLOW");
  assert.strictEqual(store.getUser("item-overflow").balance, 1000);
});

test("security: negative drop entries are rejected when negative drops are disabled", () => {
  const original = config.drops.allowNegativeAmounts;
  try {
    config.drops.allowNegativeAmounts = false;
    const errors = validate(config);
    assert.ok(
      errors.some((error) => error.includes("negative entries require drops.allowNegativeAmounts=true")),
      JSON.stringify(errors)
    );
  } finally {
    config.drops.allowNegativeAmounts = original;
  }
});

test("security: inventory validation rejects negative prices", () => {
  const item = {
    id: "invalid_negative_item",
    name: "Invalid",
    description: "invalid",
    price: 10,
    sellPrice: -1,
    type: "item",
  };
  config.inventory.items.push(item);
  try {
    const errors = validate(config);
    assert.ok(errors.some((error) => error.includes("inventory.items entry sellPrice")), JSON.stringify(errors));
  } finally {
    config.inventory.items.pop();
  }
});

test("security: logger redacts bot tokens and sensitive keys", () => {
  // Assembled at runtime so this fake token never appears as a literal in the
  // source and does not trip GitHub push protection's secret scanner.
  const token = [
    "MTIzNDU2Nzg5MDEyMzQ1Njc4",
    "GaBcDe",
    "abcdefghijklmnopqrstuvwxyz12",
  ].join(".");
  const original = process.env.DISCORD_TOKEN;
  process.env.DISCORD_TOKEN = token;
  try {
    const direct = logger.redactText(`token=${token}`);
    assert.ok(!direct.includes(token));
    assert.ok(direct.includes("[REDACTED]"));

    const structured = logger.redactText(JSON.stringify({ authorization: token, note: "ok" }));
    assert.ok(!structured.includes(token));
  } finally {
    if (original === undefined) delete process.env.DISCORD_TOKEN;
    else process.env.DISCORD_TOKEN = original;
  }
});

test("security: voluntary departures do not receive a false kick DM", async () => {
  const event = require("./src/events/guildMemberRemove");
  let directMessages = 0;
  const unknownBan = new Error("Unknown Ban");
  unknownBan.code = 10026;

  const member = {
    id: "voluntary-leaver",
    guild: {
      id: config.discord.guildId,
      name: "Test Guild",
      members: { me: { permissions: { has: () => true } } },
      bans: {
        fetch: async () => {
          throw unknownBan;
        },
      },
      fetchAuditLogs: async () => ({
        entries: { find: () => null },
      }),
    },
    user: {
      send: async () => {
        directMessages += 1;
      },
    },
  };

  await event.execute(member);
  assert.strictEqual(directMessages, 0);
});

test("security: help sanitizes user input and suppresses mentions", async () => {
  const help = require("./src/commands/help");
  let payload;
  const message = {
    client: { user: { displayAvatarURL: () => undefined } },
    reply: async (value) => {
      payload = value;
    },
  };

  await help.executePrefix(message, [
    "<@&123456789012345678>",
    "@everyone",
    "`evil`",
    "\nline",
  ]);

  const embed = payload.embeds[0].toJSON ? payload.embeds[0].toJSON() : payload.embeds[0];
  assert.ok(!/123456789012345678/.test(embed.description || ""));
  assert.ok(!/@everyone/i.test(embed.description || ""));
  assert.deepStrictEqual(payload.allowedMentions, { parse: [], repliedUser: false });
});

test("security: prefix gifts ignore reply mentions unless the user is mentioned explicitly", async () => {
  const give = require("./src/commands/give");
  let payload;
  const repliedUser = { id: "reply-target", bot: false };
  const message = {
    author: {
      id: "gift-source",
      bot: false,
      createdTimestamp: Date.now() - 30 * 24 * 60 * 60 * 1000,
    },
    content: ".give 50",
    mentions: { users: { get: () => repliedUser } },
    reply: async (value) => {
      payload = value;
    },
  };

  await give.executePrefix(message, ["50"]);
  assert.ok(String(payload.content).includes("No target"));
});

test("security: slash interactions from other guilds are rejected", async () => {
  const event = require("./src/events/interactionCreate");
  let payload;
  const interaction = {
    isChatInputCommand: () => true,
    user: { id: "interaction-user", bot: false },
    guildId: "999999999999999999",
    channelId: "888888888888888888",
    commandName: "daily",
    replied: false,
    deferred: false,
    reply: async (value) => {
      payload = value;
    },
  };

  await event.execute(interaction);
  assert.strictEqual(payload.content, "This bot is not available here.");
});

test("security: optional command role gates work", () => {
  const originalAllowed = config.commands.allowedRoleIds;
  const originalDenied = config.commands.deniedRoleIds;
  try {
    config.commands.allowedRoleIds = ["111111111111111111"];
    config.commands.deniedRoleIds = [];
    assert.strictEqual(commandAccess({ roles: ["111111111111111111"] }).ok, true);
    assert.strictEqual(commandAccess({ roles: ["222222222222222222"] }).ok, false);

    config.commands.allowedRoleIds = [];
    config.commands.deniedRoleIds = ["111111111111111111"];
    assert.strictEqual(commandAccess({ roles: ["111111111111111111"] }).ok, false);
    assert.strictEqual(commandAccess({ roles: ["222222222222222222"] }).ok, true);
  } finally {
    config.commands.allowedRoleIds = originalAllowed;
    config.commands.deniedRoleIds = originalDenied;
  }
});

test("security: optional command channel allow-list works", () => {
  const original = config.commands.allowedChannelIds;
  try {
    config.commands.allowedChannelIds = ["111111111111111111"];
    assert.strictEqual(channelAllowed("111111111111111111"), true);
    assert.strictEqual(channelAllowed("222222222222222222"), false);

    config.commands.allowedChannelIds = [];
    assert.strictEqual(channelAllowed("222222222222222222"), true);
  } finally {
    config.commands.allowedChannelIds = original;
  }
});

test("security: blackjack server-side timeout settles and unlocks the player", async () => {
  const originalTimeout = config.blackjack.timeoutMs;
  config.blackjack.timeoutMs = 20;
  try {
    const userId = "bj-timeout";
    fund(userId, 1000);
    let started = null;
    for (let i = 0; i < 20; i++) {
      const user = store.getUser(userId);
      if (user) user.lastBlackjackAt = null;
      const res = blackjack.start(userId, 100, { rng: () => ((i % 8) + 1) / 10 });
      if (res.ok && !res.ended) {
        started = res;
        break;
      }
      if (res.ok && res.ended) {
        const userAfter = store.getUser(userId);
        if (userAfter) userAfter.lastBlackjackAt = null;
      }
    }
    assert.ok(started, "expected a non-natural hand");

    // Force a losing stand result so the assertion is deterministic.
    const game = blackjack.getGame(userId);
    game.player.splice(0, game.player.length,
      { rank: "10", suit: "♠" },
      { rank: "6", suit: "♥" }
    );
    game.dealer.splice(0, game.dealer.length,
      { rank: "10", suit: "♦" },
      { rank: "K", suit: "♣" }
    );

    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.strictEqual(blackjack.getGame(userId), undefined);
    assert.strictEqual(store.getUser(userId).balance, 900);
    assert.ok(store.getUser(userId).lastBlackjackAt != null);
  } finally {
    config.blackjack.timeoutMs = originalTimeout;
    blackjack.shutdown();
  }
});

test("security: .pick ignores non-drop channels and throttles repeated attempts", async () => {
  const originalChannels = config.drops.channelIds;
  const originalCooldown = config.drops.pickCooldownSeconds;
  config.drops.channelIds = ["333333333333333333"];
  config.drops.pickCooldownSeconds = 60;
  try {
    let replies = 0;
    const message = (channelId) => ({
      guild: { id: config.discord.guildId },
      author: { id: "pick-user", bot: false },
      channelId,
      reply: async () => {
        replies += 1;
      },
    });

    await drops.pick(message("444444444444444444"));
    assert.strictEqual(replies, 0, "non-drop channel must be ignored");

    await drops.pick(message("333333333333333333"));
    assert.strictEqual(replies, 1);
    await drops.pick(message("333333333333333333"));
    assert.strictEqual(replies, 1, "second attempt must be throttled");
  } finally {
    config.drops.channelIds = originalChannels;
    config.drops.pickCooldownSeconds = originalCooldown;
    drops.stop();
  }
});

test.after(async () => {
  await loading.catch(() => {});
  try {
    await store.flushNow();
  } catch (_) {}
  blackjack.shutdown();
  store.stop();
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (_) {}
});
