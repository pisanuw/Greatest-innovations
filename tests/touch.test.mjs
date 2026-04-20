// tests/touch.test.mjs
// Simulates touch interaction logic end-to-end.
// Run with: node tests/touch.test.mjs

import { GameState } from '../public/js/game.js';

// ── Test runner ──────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`✅  ${name}`); passed++; }
  catch(e) { console.error(`❌  ${name}\n     ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function eq(a, b, msg) {
  if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

// ── Replicate exact handler logic from app.js ────────────────────────────────
function makeHandlers(game) {
  function onCardClick(cardId, zone, slotIndex) {
    if (game.submitted) return;
    if (game.selected && game.selected.cardId === cardId) {
      game.deselect(); return;
    }
    if (game.selected) {
      const sel = game.selected;
      if (sel.zone === 'slot' && zone === 'slot') {
        game.placeInSlot(sel.cardId, slotIndex); game.deselect(); return;
      }
      if (zone === 'slot') {
        game.placeInSlot(sel.cardId, slotIndex); game.deselect(); return;
      }
    }
    game.select(cardId, zone, slotIndex);
  }
  function onSlotClick(slotIndex) {
    if (game.submitted || !game.selected) return;
    game.placeInSlot(game.selected.cardId, slotIndex);
    game.deselect();
  }
  function cardIsSelected(cardId) {
    return game.selected !== null && game.selected.cardId === cardId;
  }
  return { onCardClick, onSlotClick, cardIsSelected };
}

// ── Tap helpers ──────────────────────────────────────────────────────────────
// tapCard = touchend tap path: ONE call (isTouchDevice blocks synthetic click)
const tapCard = (h, cardId, zone, si) => h.onCardClick(cardId, zone, si);
const tapSlot  = (h, si)              => h.onSlotClick(si);
// Simulate old bug: touchend + synthetic click both fire
const tapDouble = (h, cardId, zone, si) => { h.onCardClick(cardId, zone, si); h.onCardClick(cardId, zone, si); };

const setup = () => { const game = new GameState(); return { game, h: makeHandlers(game) }; };

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── S1: Tap deck card → selected ──────────────────────────────────────');

test('Tapping a deck card selects it', () => {
  const { game, h } = setup();
  const id = game.deckOrder[0];
  tapCard(h, id, 'deck', null);
  assert(game.selected !== null);
  eq(game.selected.cardId, id);
  assert(h.cardIsSelected(id), '.selected CSS class would be applied');
});

console.log('\n── S2: Tap selected deck card → deselected ───────────────────────────');

test('Tapping selected card again deselects it', () => {
  const { game, h } = setup();
  const id = game.deckOrder[0];
  tapCard(h, id, 'deck', null);
  tapCard(h, id, 'deck', null);
  assert(game.selected === null);
  assert(!h.cardIsSelected(id));
});

console.log('\n── S3: Deck card → empty slot ────────────────────────────────────────');

test('Select deck card then tap empty slot places card', () => {
  const { game, h } = setup();
  const id = game.deckOrder[0];
  tapCard(h, id, 'deck', null);
  tapSlot(h, 5);
  eq(game.slots[5], id);
  assert(game.selected === null);
  assert(!game.deckOrder.includes(id));
});

test('Tap empty slot with nothing selected does nothing', () => {
  const { game, h } = setup();
  tapSlot(h, 5);
  eq(game.slots[5], null);
});

console.log('\n── S4: Deck card → occupied slot → displace ──────────────────────────');

test('Deck card tapped onto occupied slot displaces existing card to deck', () => {
  const { game, h } = setup();
  const [a, b] = game.deckOrder;
  tapCard(h, a, 'deck', null); tapSlot(h, 0);
  tapCard(h, b, 'deck', null);
  tapCard(h, a, 'slot', 0); // tap the card in slot 0
  eq(game.slots[0], b, 'b should now occupy slot 0');
  assert(game.deckOrder.includes(a), 'displaced a back in deck');
  assert(game.selected === null);
});

console.log('\n── S5: Board card → another board card → swap ────────────────────────');

test('Tapping two board cards swaps them', () => {
  const { game, h } = setup();
  const [a, b] = game.deckOrder;
  tapCard(h, a, 'deck', null); tapSlot(h, 0);
  tapCard(h, b, 'deck', null); tapSlot(h, 1);
  tapCard(h, a, 'slot', 0); // select a
  assert(h.cardIsSelected(a), 'a selected before swap');
  tapCard(h, b, 'slot', 1); // swap
  eq(game.slots[0], b);
  eq(game.slots[1], a);
  assert(game.selected === null);
  assert(!h.cardIsSelected(a));
  assert(!h.cardIsSelected(b));
});

console.log('\n── S6: Board card → same card → deselected ───────────────────────────');

test('Tapping selected board card deselects it', () => {
  const { game, h } = setup();
  const [a] = game.deckOrder;
  tapCard(h, a, 'deck', null); tapSlot(h, 0);
  tapCard(h, a, 'slot', 0);
  assert(h.cardIsSelected(a));
  tapCard(h, a, 'slot', 0);
  assert(!h.cardIsSelected(a));
  assert(game.selected === null);
});

console.log('\n── S7 (THE BUG): Place card → immediately tap it → stays selected ────');

test('After placing, ONE tap selects card (isTouchDevice guards the click)', () => {
  const { game, h } = setup();
  const [a] = game.deckOrder;
  tapCard(h, a, 'deck', null); tapSlot(h, 3);
  eq(game.slots[3], a); assert(game.selected === null);

  tapCard(h, a, 'slot', 3); // single call — new behaviour

  assert(game.selected !== null, 'SHOULD be selected (was the bug: it was null)');
  eq(game.selected.cardId, a);
  assert(h.cardIsSelected(a), 'CSS outline WOULD be shown');
});

test('PROOF: double-fire (old bug) causes immediate deselection', () => {
  const { game, h } = setup();
  const [a] = game.deckOrder;
  tapCard(h, a, 'deck', null); tapSlot(h, 3);

  tapDouble(h, a, 'slot', 3); // simulate touchend + synthetic click

  assert(game.selected === null, 'double-fire deselects — confirms the bug existed');
  assert(!h.cardIsSelected(a), 'no outline would appear — the reported symptom');
});

test('Normal double-tap to select then deselect still works', () => {
  const { game, h } = setup();
  const [a] = game.deckOrder;
  tapCard(h, a, 'deck', null); tapSlot(h, 3);
  tapCard(h, a, 'slot', 3); assert(game.selected !== null, 'first tap selects');
  tapCard(h, a, 'slot', 3); assert(game.selected === null, 'second tap deselects');
});

console.log('\n── S8: Drag places card ──────────────────────────────────────────────');

test('Drag path: placeInSlot + deselect places card correctly', () => {
  const { game } = setup();
  const id = game.deckOrder[0];
  game.placeInSlot(id, 7);
  game.deselect();
  eq(game.slots[7], id);
  assert(game.selected === null);
});

console.log('\n── S9: Drag board card → board card → swap ───────────────────────────');

test('Drag: placeInSlot on occupied slot swaps the cards', () => {
  const { game, h } = setup();
  const [a, b] = game.deckOrder;
  tapCard(h, a, 'deck', null); tapSlot(h, 0);
  tapCard(h, b, 'deck', null); tapSlot(h, 1);
  game.placeInSlot(a, 1); // drag a onto slot 1 (has b)
  eq(game.slots[1], a);
  eq(game.slots[0], b);
});

console.log('\n── S10: Long-press menu actions ──────────────────────────────────────');

test('moveToLater moves card from slot to later zone', () => {
  const { game, h } = setup();
  const [a] = game.deckOrder;
  tapCard(h, a, 'deck', null); tapSlot(h, 2);
  game.moveToLater(a);
  assert(game.later.includes(a));
  eq(game.slots[2], null);
});

test('returnToDeck moves card from slot back to top of deck', () => {
  const { game, h } = setup();
  const [a] = game.deckOrder;
  tapCard(h, a, 'deck', null); tapSlot(h, 2);
  game.returnToDeck(a);
  eq(game.deckOrder[0], a);
  eq(game.slots[2], null);
});

test('moveToLater on locked card is blocked', () => {
  const { game, h } = setup();
  tapCard(h, 1, 'deck', null); tapSlot(h, 0); // correct position
  game.submit(); game.continueGame();
  assert(game.lockedSlots.has(0));
  const r = game.moveToLater(1);
  eq(r, false);
  assert(!game.later.includes(1));
});

console.log('\n── S11: Desktop (isTouchDevice=false) ────────────────────────────────');

test('Desktop: single onCardClick call selects card', () => {
  const { game, h } = setup();
  const id = game.deckOrder[0];
  h.onCardClick(id, 'deck', null);
  assert(game.selected !== null);
  eq(game.selected.cardId, id);
});

test('Desktop: two clicks on same card toggles selection', () => {
  const { game, h } = setup();
  const id = game.deckOrder[0];
  h.onCardClick(id, 'deck', null); assert(game.selected !== null, 'selected');
  h.onCardClick(id, 'deck', null); assert(game.selected === null, 'deselected');
});

console.log('\n── S12: Locked slots ─────────────────────────────────────────────────');

test('Cannot place into a locked slot', () => {
  const { game, h } = setup();
  tapCard(h, 1, 'deck', null); tapSlot(h, 0);
  game.submit(); game.continueGame();
  const other = game.deckOrder[0];
  game.placeInSlot(other, 0);
  eq(game.slots[0], 1, 'locked slot unchanged');
});

test('Cannot move a card out of a locked slot', () => {
  const { game, h } = setup();
  tapCard(h, 1, 'deck', null); tapSlot(h, 0);
  game.submit(); game.continueGame();
  const r = game.placeInSlot(1, 5);
  eq(r, false);
  eq(game.slots[0], 1);
  eq(game.slots[5], null);
});

console.log('\n── Red outline persistence (incorrectSlots) ──────────────────────────');

test('incorrectSlots populated after submit for wrong cards', () => {
  const { game, h } = setup();
  tapCard(h, 2, 'deck', null); tapSlot(h, 0); // card 2 in slot 0 (wrong)
  game.submit();
  assert(game.incorrectSlots.has(0));
});

test('Correct card NOT added to incorrectSlots', () => {
  const { game, h } = setup();
  tapCard(h, 1, 'deck', null); tapSlot(h, 0); // card 1 in slot 0 (correct)
  game.submit();
  assert(!game.incorrectSlots.has(0));
});

test('incorrectSlots cleared when card moved out of slot', () => {
  const { game, h } = setup();
  tapCard(h, 2, 'deck', null); tapSlot(h, 0);
  game.submit(); game.continueGame();
  assert(game.incorrectSlots.has(0));
  game.returnToDeck(2);
  assert(!game.incorrectSlots.has(0));
});

test('Swapping two red-outlined cards clears BOTH outlines', () => {
  const { game, h } = setup();
  tapCard(h, 2, 'deck', null); tapSlot(h, 0); // wrong
  tapCard(h, 1, 'deck', null); tapSlot(h, 1); // wrong
  game.submit(); game.continueGame();
  assert(game.incorrectSlots.has(0));
  assert(game.incorrectSlots.has(1));
  game.placeInSlot(2, 1); // swap
  assert(!game.incorrectSlots.has(0), 'source slot cleared');
  assert(!game.incorrectSlots.has(1), 'dest slot cleared');
});

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(58)}`);
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
