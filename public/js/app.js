// js/app.js — UI, rendering, and all user interactions

import { CARDS, CARD_MAP } from './data.js';
import { GameState } from './game.js';

// ─── Game state ──────────────────────────────────────────────────────────────

const game = new GameState();
if (!game.load()) game.reset();

// ─── DOM refs ────────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

const deckZoneEl   = $('deck-zone');
const deckEl       = $('deck');
const deckCountEl  = $('deck-count');
const boardEl      = $('board');
const laterZoneEl  = $('later-zone');
const laterEl      = $('later');
const laterCountEl = $('later-count');
const placedEl     = $('placed-count');
const submitBtn    = $('submit-btn');
const resetBtn     = $('reset-btn');
const hintBar      = $('hint-bar');
const hintText     = $('hint-text');
const toLaterBtn   = $('to-later-btn');
const toDeckBtn    = $('to-deck-btn');
const cancelBtn    = $('cancel-btn');
const modal        = $('result-modal');
const modalScore   = $('result-score');
const modalMsg     = $('result-message');
const modalList    = $('result-list');
const modalClose   = $('result-close');
const modalRetry   = $('result-retry');

// ─── Render helpers ───────────────────────────────────────────────────────────

function imgPath(id) {
  return `images/cards/card-${String(id).padStart(2, '0')}.png`;
}

/**
 * Build a draggable card element.
 * zone: 'deck' | 'later' | 'slot'
 */
function makeCard(card, zone, slotIndex = null) {
  const el = document.createElement('div');
  el.className  = 'card';
  el.dataset.cardId    = card.id;
  el.dataset.zone      = zone;
  if (slotIndex !== null) el.dataset.slotIndex = slotIndex;
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', card.name);

  if (!game.submitted) el.draggable = true;

  if (game.selected && game.selected.cardId === card.id) {
    el.classList.add('selected');
  }

  if (game.submitted && zone === 'slot' && slotIndex !== null) {
    const r = game.results[slotIndex];
    if (r === true)  el.classList.add('correct');
    if (r === false) el.classList.add('incorrect');
  }

  el.innerHTML = `<img src="${imgPath(card.id)}" alt="${card.name}" draggable="false">
                  <span class="card-label">${card.name}</span>`;

  el.addEventListener('click',   e => { e.stopPropagation(); onCardClick(card.id, zone, slotIndex); });
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onCardClick(card.id, zone, slotIndex); }
  });
  el.addEventListener('dragstart', e => {
    if (game.submitted) { e.preventDefault(); return; }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ cardId: card.id, zone, slotIndex }));
    el.classList.add('dragging');
  });
  el.addEventListener('dragend', () => el.classList.remove('dragging'));
  return el;
}

/** Build a board slot element at slotIndex (0-based). */
function makeSlot(slotIndex) {
  const el = document.createElement('div');
  el.className = 'slot';
  el.dataset.slotIndex = slotIndex;
  el.setAttribute('role', 'listitem');
  el.setAttribute('aria-label', `Position ${slotIndex + 1}`);

  const num = document.createElement('span');
  num.className = 'slot-num';
  num.textContent = slotIndex + 1;
  num.setAttribute('aria-hidden', 'true');
  el.appendChild(num);

  const cardId = game.slots[slotIndex];
  if (cardId !== null) {
    el.classList.add('occupied');
    el.appendChild(makeCard(CARD_MAP.get(cardId), 'slot', slotIndex));
  }

  if (game.submitted && game.results) {
    const r = game.results[slotIndex];
    if (r === true)  el.classList.add('correct');
    if (r === false) el.classList.add('incorrect');
  }

  // Click on the slot background (not the card) → place selected card
  el.addEventListener('click', () => onSlotClick(slotIndex));

  // Drag-over / drop
  el.addEventListener('dragover', e => {
    if (game.submitted) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    el.classList.add('drag-over');
  });
  el.addEventListener('dragleave', e => {
    if (!el.contains(e.relatedTarget)) el.classList.remove('drag-over');
  });
  el.addEventListener('drop', e => {
    e.preventDefault();
    el.classList.remove('drag-over');
    const data = parseDrop(e);
    if (!data) return;
    game.placeInSlot(data.cardId, slotIndex);
    game.deselect();
    game.save();
    renderAll();
  });
  return el;
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderAll() {
  renderDeck();
  renderBoard();
  renderLater();
  updateHeader();
  updateHintBar();
}

function renderDeck() {
  deckEl.innerHTML = '';
  game.deckOrder.forEach(id => deckEl.appendChild(makeCard(CARD_MAP.get(id), 'deck')));
  deckCountEl.textContent = game.deckOrder.length;
}

function renderBoard() {
  boardEl.innerHTML = '';
  for (let i = 0; i < 40; i++) boardEl.appendChild(makeSlot(i));
}

function renderLater() {
  laterEl.innerHTML = '';
  game.later.forEach(id => laterEl.appendChild(makeCard(CARD_MAP.get(id), 'later')));
  laterCountEl.textContent = game.later.length;
}

function updateHeader() {
  placedEl.textContent = `${game.getPlacedCount()} / 40 placed`;
  submitBtn.disabled   = game.submitted;
}

function updateHintBar() {
  if (game.selected && !game.submitted) {
    const card = CARD_MAP.get(game.selected.cardId);
    hintText.textContent = `"${card.name}" selected — click a slot to place it`;
    toDeckBtn.hidden  = game.selected.zone === 'deck';
    toLaterBtn.hidden = game.selected.zone === 'later';
    hintBar.hidden = false;
  } else {
    hintBar.hidden = true;
  }
}

// ─── Click interaction ────────────────────────────────────────────────────────

function onCardClick(cardId, zone, slotIndex) {
  if (game.submitted) return;

  // Clicking the already-selected card → deselect
  if (game.selected && game.selected.cardId === cardId) {
    game.deselect();
    renderAll();
    return;
  }

  if (game.selected) {
    const sel = game.selected;

    // Both cards in slots → swap
    if (sel.zone === 'slot' && zone === 'slot') {
      game.placeInSlot(sel.cardId, slotIndex);
      game.deselect();
      game.save();
      renderAll();
      return;
    }

    // Selected card (from deck/later) clicks an occupied slot → place there
    if (zone === 'slot') {
      game.placeInSlot(sel.cardId, slotIndex);
      game.deselect();
      game.save();
      renderAll();
      return;
    }

    // Otherwise change selection to the newly clicked card
  }

  game.select(cardId, zone, slotIndex);
  renderAll();
}

function onSlotClick(slotIndex) {
  if (game.submitted) return;
  if (!game.selected) return;
  game.placeInSlot(game.selected.cardId, slotIndex);
  game.deselect();
  game.save();
  renderAll();
}

// ─── Hint-bar action buttons ──────────────────────────────────────────────────

toLaterBtn.addEventListener('click', () => {
  if (!game.selected) return;
  game.moveToLater(game.selected.cardId);
  game.deselect();
  game.save();
  renderAll();
});

toDeckBtn.addEventListener('click', () => {
  if (!game.selected) return;
  game.returnToDeck(game.selected.cardId);
  game.deselect();
  game.save();
  renderAll();
});

cancelBtn.addEventListener('click', () => {
  game.deselect();
  renderAll();
});

// ─── Drop-zone wiring (deck panel and later panel) ────────────────────────────

function wireDropZone(zoneEl, onDrop) {
  zoneEl.addEventListener('dragover', e => {
    if (game.submitted) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    zoneEl.classList.add('drag-over');
  });
  zoneEl.addEventListener('dragleave', e => {
    if (!zoneEl.contains(e.relatedTarget)) zoneEl.classList.remove('drag-over');
  });
  zoneEl.addEventListener('drop', e => {
    e.preventDefault();
    zoneEl.classList.remove('drag-over');
    const data = parseDrop(e);
    if (data) onDrop(data);
    game.deselect();
    game.save();
    renderAll();
  });
}

wireDropZone(deckZoneEl,  ({ cardId, zone }) => { if (zone !== 'deck')  game.returnToDeck(cardId); });
wireDropZone(laterZoneEl, ({ cardId, zone }) => { if (zone !== 'later') game.moveToLater(cardId);  });

function parseDrop(e) {
  try { return JSON.parse(e.dataTransfer.getData('text/plain')); } catch (err) {
    console.warn('parseDrop: could not parse drag data', err);
    return null;
  }
}

// ─── Submit & Reset ───────────────────────────────────────────────────────────

submitBtn.addEventListener('click', () => {
  game.submit();
  game.save();
  renderAll();
  showModal();
});

resetBtn.addEventListener('click', () => {
  if (!confirm('Start a new game? All progress will be lost.')) return;
  game.reset();
  game.save();
  renderAll();
  modal.hidden = true;
});

// ─── Results modal ────────────────────────────────────────────────────────────

function showModal() {
  const { correct, placed } = game.getScore();
  modalScore.textContent = `${correct} / 40 correct`;

  if      (correct === 40)  modalMsg.textContent = '🎉 Perfect score! You know your history!';
  else if (correct >= 30)   modalMsg.textContent = '🌟 Excellent! Really impressive!';
  else if (correct >= 20)   modalMsg.textContent = '👍 Good effort — keep learning!';
  else if (correct >= 10)   modalMsg.textContent = '📚 Not bad! Try again to improve.';
  else                      modalMsg.textContent = '🤔 Tough game — give it another go!';

  modalList.innerHTML = '';
  game.slots.forEach((cardId, i) => {
    const row = document.createElement('div');
    row.className = 'result-row';
    if (cardId === null) {
      row.innerHTML = `<span class="ri-icon">⬜</span>
                       <span class="ri-pos">#${i + 1}</span>
                       <span class="ri-name empty">— empty —</span>`;
    } else {
      const card   = CARD_MAP.get(cardId);
      const ok     = game.results[i];
      const correct = CARD_MAP.get(i + 1);
      row.innerHTML = `<span class="ri-icon">${ok ? '✅' : '❌'}</span>
                       <span class="ri-pos">#${i + 1}</span>
                       <span class="ri-name">${card.name}</span>
                       <span class="ri-year">${card.year}</span>
                       ${ok ? '' : `<span class="ri-correct">(correct: ${correct.name})</span>`}`;
    }
    modalList.appendChild(row);
  });

  modal.hidden = false;
}

modalClose.addEventListener('click', () => { modal.hidden = true; });
modalRetry.addEventListener('click', () => {
  game.reset();
  game.save();
  renderAll();
  modal.hidden = true;
});

// Close modal when clicking the backdrop
modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });

// ─── Touch drag-and-drop ──────────────────────────────────────────────────────

let touchDrag  = null;
let touchClone = null;

document.addEventListener('touchstart', e => {
  if (game.submitted) return;
  const cardEl = e.target.closest('.card');
  if (!cardEl) return;

  const cardId    = parseInt(cardEl.dataset.cardId, 10);
  const zone      = cardEl.dataset.zone;
  const slotIndex = cardEl.dataset.slotIndex != null ? parseInt(cardEl.dataset.slotIndex, 10) : null;
  const touch     = e.touches[0];
  const rect      = cardEl.getBoundingClientRect();

  touchDrag = { cardId, zone, slotIndex, offsetX: touch.clientX - rect.left, offsetY: touch.clientY - rect.top };

  touchClone = cardEl.cloneNode(true);
  touchClone.classList.add('touch-clone');
  touchClone.style.cssText =
    `position:fixed;width:${rect.width}px;left:${rect.left}px;top:${rect.top}px;pointer-events:none;z-index:9999;`;
  document.body.appendChild(touchClone);
  cardEl.style.opacity = '0.3';
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (!touchDrag || !touchClone) return;
  e.preventDefault();
  const t = e.touches[0];
  touchClone.style.left = `${t.clientX - touchDrag.offsetX}px`;
  touchClone.style.top  = `${t.clientY - touchDrag.offsetY}px`;
}, { passive: false });

document.addEventListener('touchend', e => {
  if (!touchDrag) return;
  touchClone && touchClone.remove();
  touchClone = null;

  // Restore opacity of original card (it will be re-rendered shortly)
  const orig = document.querySelector(`.card[data-card-id="${touchDrag.cardId}"]`);
  if (orig) orig.style.opacity = '';

  const t  = e.changedTouches[0];
  const el = document.elementFromPoint(t.clientX, t.clientY);

  if (el) {
    const slot      = el.closest('.slot');
    const lZone     = el.closest('#later-zone');
    const dZone     = el.closest('#deck-zone');
    if (slot && !slot.closest('#later-zone') && !slot.closest('#deck-zone')) {
      game.placeInSlot(touchDrag.cardId, parseInt(slot.dataset.slotIndex, 10));
    } else if (lZone && touchDrag.zone !== 'later') {
      game.moveToLater(touchDrag.cardId);
    } else if (dZone && touchDrag.zone !== 'deck') {
      game.returnToDeck(touchDrag.cardId);
    }
  }

  touchDrag = null;
  game.deselect();
  game.save();
  renderAll();
}, { passive: true });

// ─── Keyboard shortcut ────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && game.selected) {
    game.deselect();
    renderAll();
  }
});

// ─── Initialise ───────────────────────────────────────────────────────────────

renderAll();
