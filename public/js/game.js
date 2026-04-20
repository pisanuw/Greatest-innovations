// js/game.js — pure state management, no DOM dependencies

import { CARDS } from './data.js';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class GameState {
  constructor() {
    this.reset();
  }

  // ─── Initialisation ─────────────────────────────────────────────────────

  reset() {
    this.deckOrder   = shuffle(CARDS.map(c => c.id));
    this.later       = [];
    this.slots       = new Array(40).fill(null);
    this.selected    = null;
    this.submitted   = false;
    this.results     = null;
    this.lockedSlots   = new Set(); // slot indices permanently frozen (correct)
    this.incorrectSlots = new Set(); // slot indices marked wrong, cleared on move
  }

  /** Lock correct slots in place and re-open gameplay for wrong ones. */
  continueGame() {
    if (!this.submitted) return;
    this.results.forEach((r, i) => {
      if (r === true) { this.lockedSlots.add(i); this.incorrectSlots.delete(i); }
    });
    this.submitted = false;
    this.results   = null;
    this.selected  = null;
  }

  // ─── Queries ─────────────────────────────────────────────────────────────

  getLocation(cardId) {
    if (this.deckOrder.includes(cardId)) return { zone: 'deck' };
    if (this.later.includes(cardId))     return { zone: 'later' };
    const slotIndex = this.slots.indexOf(cardId);
    if (slotIndex !== -1)                return { zone: 'slot', slotIndex };
    return null;
  }

  getPlacedCount() {
    return this.slots.filter(c => c !== null).length;
  }

  // ─── Mutations ───────────────────────────────────────────────────────────

  /** Remove cardId from wherever it currently lives. */
  _removeFromOrigin(cardId) {
    const loc = this.getLocation(cardId);
    if (!loc) return;
    if (loc.zone === 'deck') {
      this.deckOrder = this.deckOrder.filter(id => id !== cardId);
    } else if (loc.zone === 'later') {
      this.later = this.later.filter(id => id !== cardId);
    } else {
      this.incorrectSlots.delete(loc.slotIndex);
      this.slots[loc.slotIndex] = null;
    }
  }

  /**
   * Place cardId into slotIndex.
   * - Slot card → Slot card : swap the two cards.
   * - Deck/Later card → Occupied slot : place card, displaced card → deck front.
   * - Any card → Empty slot : simply place.
   */
  placeInSlot(cardId, slotIndex) {
    if (this.submitted) return false;
    if (this.lockedSlots.has(slotIndex)) return false;
    const loc = this.getLocation(cardId);
    if (!loc) return false;
    if (loc.zone === 'slot' && this.lockedSlots.has(loc.slotIndex)) return false;

    const displaced = this.slots[slotIndex];
    this.incorrectSlots.delete(slotIndex);

    if (loc.zone === 'slot' && displaced !== null) {
      // Swap — clear both slots from incorrectSlots
      this.incorrectSlots.delete(loc.slotIndex);
      this.slots[loc.slotIndex] = displaced;
      this.slots[slotIndex]     = cardId;
      return true;
    }

    this._removeFromOrigin(cardId);
    this.slots[slotIndex] = cardId;

    if (displaced !== null) {
      // Send displaced card to the front of the deck so it's immediately visible
      this.deckOrder.unshift(displaced);
    }
    return true;
  }

  /** Move cardId to the "Later" holding area. */
  moveToLater(cardId) {
    if (this.submitted) return false;
    const loc = this.getLocation(cardId);
    if (!loc || loc.zone === 'later') return false;
    if (loc.zone === 'slot' && this.lockedSlots.has(loc.slotIndex)) return false;
    this._removeFromOrigin(cardId);
    this.later.push(cardId);
    return true;
  }

  /** Return cardId to the deck (front). */
  returnToDeck(cardId) {
    if (this.submitted) return false;
    const loc = this.getLocation(cardId);
    if (!loc || loc.zone === 'deck') return false;
    if (loc.zone === 'slot' && this.lockedSlots.has(loc.slotIndex)) return false;
    this._removeFromOrigin(cardId);
    this.deckOrder.unshift(cardId);
    return true;
  }

  /** Toggle selection.  Passing the same cardId a second time deselects. */
  select(cardId, zone, slotIndex = null) {
    if (this.submitted) return;
    if (this.selected && this.selected.cardId === cardId) {
      this.selected = null;
    } else {
      this.selected = { cardId, zone, slotIndex };
    }
  }

  deselect() {
    this.selected = null;
  }

  // ─── Scoring (only triggered by explicit Submit) ──────────────────────

  submit() {
    if (this.submitted) return;
    this.submitted = true;
    // A slot is correct when the card's own id equals its 1-based position
    this.results = this.slots.map((cardId, idx) => {
      if (cardId === null) return null;
      return cardId === idx + 1;
    });
    this.incorrectSlots = new Set(
      this.results.map((r, i) => r === false ? i : -1).filter(i => i >= 0)
    );
  }

  getScore() {
    if (!this.results) return { correct: 0, placed: this.getPlacedCount() };
    return {
      correct: this.results.filter(r => r === true).length,
      placed:  this.getPlacedCount(),
    };
  }

  // ─── Persistence (localStorage) ──────────────────────────────────────────

  save() {
    try {
      localStorage.setItem('innovations-v1', JSON.stringify({
        deckOrder:   this.deckOrder,
        later:       this.later,
        slots:       this.slots,
        submitted:   this.submitted,
        lockedSlots:   [...this.lockedSlots],
        incorrectSlots: [...this.incorrectSlots],
      }));
    } catch (_) { /* storage unavailable — silently skip */ }
  }

  load() {
    try {
      const raw = localStorage.getItem('innovations-v1');
      if (!raw) return false;
      const d = JSON.parse(raw);
      this.deckOrder   = d.deckOrder;
      this.later       = d.later;
      this.slots       = d.slots;
      this.submitted   = d.submitted;
      this.lockedSlots   = new Set(d.lockedSlots   || []);
      this.incorrectSlots = new Set(d.incorrectSlots || []);
      this.selected    = null;
      this.results     = this.submitted
        ? this.slots.map((id, i) => (id === null ? null : id === i + 1))
        : null;
      return true;
    } catch (_) {
      return false;
    }
  }
}
