// tests/game.test.mjs
// Pure unit tests for GameState — no browser dependencies.
// Run with:  node tests/game.test.mjs

import { GameState } from '../public/js/game.js';

// ── Minimal test runner ────────────────────────────────────────────────────
let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅  ${name}`);
    passed++;
  } catch (e) {
    console.error(`❌  ${name}\n     ${e.message}`);
    failed++;
  }
}

function assert(cond, msg = 'Assertion failed') {
  if (!cond) throw new Error(msg);
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(msg ?? `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

// ── Tests ──────────────────────────────────────────────────────────────────

test('initial state: 40 cards in deck, nothing elsewhere', () => {
  const g = new GameState();
  g.reset();
  eq(g.deckOrder.length, 40, 'deck should have 40 cards');
  eq(g.later.length, 0, 'later should be empty');
  eq(g.slots.filter(s => s !== null).length, 0, 'board should be empty');
  eq(g.submitted, false);
  eq(g.results, null);
});

test('deck contains all 40 unique ids', () => {
  const g = new GameState();
  g.reset();
  const ids = new Set(g.deckOrder);
  eq(ids.size, 40, 'deck must have 40 unique card ids');
  for (let i = 1; i <= 40; i++) assert(ids.has(i), `card ${i} missing from deck`);
});

test('place card from deck into empty slot', () => {
  const g = new GameState();
  g.reset();
  const cardId = g.deckOrder[0];
  const ok = g.placeInSlot(cardId, 0);
  assert(ok, 'placeInSlot should return true');
  eq(g.slots[0], cardId, 'card should be in slot 0');
  assert(!g.deckOrder.includes(cardId), 'card should no longer be in deck');
  eq(g.getPlacedCount(), 1);
});

test('place deck card on occupied slot displaces existing card to deck', () => {
  const g = new GameState();
  g.reset();
  const [card1, card2] = g.deckOrder;
  g.placeInSlot(card1, 0);
  g.placeInSlot(card2, 0);
  eq(g.slots[0], card2, 'slot 0 should hold card2');
  assert(g.deckOrder.includes(card1), 'displaced card1 should be back in deck');
  assert(!g.deckOrder.includes(card2), 'card2 should not be in deck');
});

test('swap two slot cards', () => {
  const g = new GameState();
  g.reset();
  const [card1, card2] = g.deckOrder;
  g.placeInSlot(card1, 0);
  g.placeInSlot(card2, 3);
  g.placeInSlot(card1, 3); // move card1 from slot 0 to slot 3 → swap
  eq(g.slots[3], card1, 'slot 3 should have card1 after swap');
  eq(g.slots[0], card2, 'slot 0 should have card2 after swap');
});

test('moveToLater removes card from deck', () => {
  const g = new GameState();
  g.reset();
  const cardId = g.deckOrder[0];
  const ok = g.moveToLater(cardId);
  assert(ok, 'moveToLater should return true');
  assert(g.later.includes(cardId), 'card should be in later');
  assert(!g.deckOrder.includes(cardId), 'card should not be in deck');
});

test('moveToLater card from slot clears the slot', () => {
  const g = new GameState();
  g.reset();
  const cardId = g.deckOrder[0];
  g.placeInSlot(cardId, 5);
  g.moveToLater(cardId);
  eq(g.slots[5], null, 'slot should be empty after moving card to later');
  assert(g.later.includes(cardId), 'card should be in later');
});

test('returnToDeck puts card back in deck', () => {
  const g = new GameState();
  g.reset();
  const cardId = g.deckOrder[0];
  g.moveToLater(cardId);
  const ok = g.returnToDeck(cardId);
  assert(ok, 'returnToDeck should return true');
  assert(g.deckOrder.includes(cardId), 'card should be back in deck');
  assert(!g.later.includes(cardId), 'card should not be in later');
});

test('later card can be placed in a slot', () => {
  const g = new GameState();
  g.reset();
  const cardId = g.deckOrder[0];
  g.moveToLater(cardId);
  g.placeInSlot(cardId, 10);
  eq(g.slots[10], cardId);
  assert(!g.later.includes(cardId));
});

test('select toggles selection', () => {
  const g = new GameState();
  g.reset();
  const cardId = g.deckOrder[0];
  g.select(cardId, 'deck');
  eq(g.selected.cardId, cardId);
  g.select(cardId, 'deck'); // toggle off
  eq(g.selected, null);
});

test('no mutations allowed after submit', () => {
  const g = new GameState();
  g.reset();
  const [c1, c2] = g.deckOrder;
  g.placeInSlot(c1, 0);
  g.submit();
  const ok = g.placeInSlot(c2, 1);
  eq(ok, false, 'placeInSlot should be blocked after submit');
  eq(g.slots[1], null, 'slot 1 should remain empty');
});

test('submit scores correctly', () => {
  const g = new GameState();
  g.reset();
  // Place card id=1 into slot 0 (correct), card id=5 into slot 1 (wrong)
  g.deckOrder = g.deckOrder.filter(id => id !== 1 && id !== 5);
  g.slots[0] = 1;
  g.slots[1] = 5;
  g.submit();
  eq(g.results[0], true,  'card 1 in slot 0 is correct');
  eq(g.results[1], false, 'card 5 in slot 1 is incorrect');
  eq(g.results[2], null,  'empty slot 2 is null');
  const { correct, placed } = g.getScore();
  eq(correct, 1);
  eq(placed,  2);
});

test('perfect score: all 40 correct', () => {
  const g = new GameState();
  g.reset();
  for (let i = 1; i <= 40; i++) g.slots[i - 1] = i;
  g.deckOrder = [];
  g.submit();
  const { correct } = g.getScore();
  eq(correct, 40);
});

test('getPlacedCount reflects actual placed cards', () => {
  const g = new GameState();
  g.reset();
  eq(g.getPlacedCount(), 0);
  const [c1, c2, c3] = g.deckOrder;
  g.placeInSlot(c1, 0);
  g.placeInSlot(c2, 10);
  g.placeInSlot(c3, 39);
  eq(g.getPlacedCount(), 3);
});

test('duplicate placement is prevented', () => {
  const g = new GameState();
  g.reset();
  const cardId = g.deckOrder[0];
  g.placeInSlot(cardId, 0);
  // Trying to place same card again → it's now in slot 0, not in deck
  g.placeInSlot(cardId, 5); // this should move it (slot → slot)
  eq(g.slots[0], null, 'original slot should be empty after move');
  eq(g.slots[5], cardId, 'card should now be in slot 5');
});

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
