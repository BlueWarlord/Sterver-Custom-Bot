# Blackjack Gambling Game Plan

## Status
The blackjack game is **not yet implemented**. This plan mirrors the structure of the existing coin flip game (`play()` logic in `src/economy/games/`, command in `src/commands/`, spec in a root-level `*.test.js`).

## Affected Files
- `src/economy/games/blackjack.js` — new: deck, hand scoring, game state, `start`, `hit`, `stand`, `double` logic
- `src/commands/blackjack.js` — new: slash + prefix command, Discord button handling (Hit / Stand / Double)
- `blackjack.test.js` — new: test suite (spec), written first
- `config.js` — add blackjack settings (min/max bet, cooldown, payout, dealer rule, timeout)
- `README.md` — add `/blackjack` to the commands list

Existing files to read and follow before coding (not modified): `src/economy/games/coinflip.js`, `src/commands/coinflip.js`, `coinflip.test.js`. Reuse the same balance/profit update helpers, gambling-enabled check, and cooldown mechanism.

## Behavior (to be matched by tests)
- Deck: standard 52 cards, shuffled with Fisher-Yates. A fresh deck per game. RNG is injectable (default `Math.random`) so tests can use fixed decks.
- Card values: 2–10 face value, J/Q/K = 10, Ace = 11 or 1 (counted as 11 unless that busts the hand).
- Deal: player 2 cards, dealer 2 cards (one hidden until the dealer's turn).
- Player actions: **Hit**, **Stand**, **Double** (only on the first two cards, requires enough balance to cover a second bet; takes exactly one card then stands).
- Dealer: reveals the hole card and draws until reaching 17 or more. Dealer stands on all 17s (configurable `dealerHitsSoft17`, default `false`).
- Bet is deducted from the balance when the game starts, so quitting mid-hand cannot avoid a loss.
- Outcomes and payouts (`bet` is the total wagered, doubled if the player doubles):
  - Player natural blackjack (Ace + 10-value on first two cards), dealer without one: balance += bet * 2.5, profit = bet * 1.5
  - Both have natural blackjack: push
  - Player wins (dealer busts or higher total): balance += bet * 2, profit = bet
  - Push (equal totals): balance += bet, profit = 0
  - Player bust or dealer higher: balance unchanged (bet already deducted), profit = -bet
- If the dealer has a natural blackjack and the player does not, the hand ends immediately as a loss.
- Validations: gambling enabled, integer positive bet, min/max bet, sufficient funds, cooldown, no other active blackjack game for the same user.
- One active game per user, held in an in-memory `Map` keyed by `userId`. Only the user who started the game can press its buttons.
- Inactivity timeout (default 60s): the hand is auto-stood and settled, buttons are disabled, and the session is removed.
- Cooldown enforced via `lastBlackjackAt` (set when a game finishes, same pattern as `lastFlipAt`).
- Out of scope for v1: split, insurance, surrender, multi-deck shoe.

## Command Design
- `/blackjack bet:<amount>` and `.blackjack <amount>`
- Reply is an embed showing the player's hand and total, the dealer's visible card, and the bet. Buttons: Hit, Stand, Double.
- On completion the embed is edited to show both full hands, the result, the profit/loss, and the new balance.
- Prefix usage uses the same message-with-buttons flow as the slash command.

## Config Additions (`config.js`)
- `blackjack.minBet`, `blackjack.maxBet`
- `blackjack.cooldownMs`
- `blackjack.blackjackPayout` (default `1.5`)
- `blackjack.dealerHitsSoft17` (default `false`)
- `blackjack.timeoutMs` (default `60000`)
- Update `config-validate.test.js` if it checks required config keys.

## Test Plan (`blackjack.test.js`)
1. Hand value: number cards, face cards
2. Hand value: ace counts as 11, then drops to 1 to avoid bust (including multiple aces)
3. Natural blackjack detected only on the first two cards
4. Player natural pays 3:2
5. Both naturals result in a push, bet returned
6. Dealer natural beats a non-natural player immediately
7. Player bust loses and does not trigger a dealer draw
8. Dealer draws to 17 and stands; dealer bust pays the player 1:1
9. Higher total wins, lower total loses, equal total pushes
10. Double: bet doubled, exactly one card drawn, then auto-stand; rejected when funds are insufficient or after a hit
11. Bet deducted at start; correct final balance and profit for win/loss/push
12. Validations: gambling disabled, non-integer/zero/negative bet, below min, above max, insufficient funds
13. Cooldown enforced after a finished game
14. Second game blocked while one is active; session cleared after finish
15. Timeout auto-stands and settles the hand
16. Soft 17 behavior follows `dealerHitsSoft17`

## Implementation Order
1. Read the coin flip files and copy the shared conventions (helpers, error shapes, return format).
2. Add config keys.
3. Write `blackjack.test.js` using injectable decks.
4. Implement `src/economy/games/blackjack.js` until tests pass.
5. Implement `src/commands/blackjack.js` with embed + button interaction collector.
6. Register the command (`npm run deploy` or restart; slash commands auto-register on startup).
7. Manual test in the Discord server: win, lose, push, natural, double, timeout.

## Validation
- Run `node --test blackjack.test.js`
- Run the full suite: `node --test` (coinflip, store, and config-validate tests must still pass)
- Manual check of the slash and `.` prefix commands in Discord

## Open Questions
- Confirm the balance/profit helper names and the cooldown field pattern from `src/economy/games/coinflip.js` (the repo's `src` folder could not be read when drafting this plan, so the plan assumes the coin flip conventions).
- Coin flip pays 2.5x on a win (a 1.5x profit on an even-odds game), which is unusually generous. Blackjack here uses standard payouts (1:1, 3:2 for naturals). Decide if you want blackjack to follow the same generous scale instead.
- Should the bet be escrowed at the start (as planned) or only settled at the end?
- Do you want split and insurance in a later version?
