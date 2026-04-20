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
const cancelBtn    = $('cancel-btn');
const modal        = $('result-modal');
const modalScore   = $('result-score');
const modalMsg     = $('result-message');
const modalList    = $('result-list');
const modalContinue = $('result-continue');
const modalRetry    = $('result-retry');

// ─── Render helpers ───────────────────────────────────────────────────────────

function imgPath(id, revealed = false) {
  const dir = revealed ? 'images/cards-revealed' : 'images/cards';
  return `${dir}/card-${String(id).padStart(2, '0')}.png`;
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

  const isLocked = zone === 'slot' && slotIndex !== null && game.lockedSlots.has(slotIndex);
  if (!game.submitted && !isLocked) el.draggable = true;
  if (isLocked) el.style.cursor = 'default';

  if (game.selected && game.selected.cardId === card.id) {
    el.classList.add('selected');
  }

  if (game.submitted && zone === 'slot' && slotIndex !== null && !isLocked) {
    const r = game.results[slotIndex];
    if (r === true)  el.classList.add('correct');
    if (r === false) el.classList.add('incorrect');
  }

  const revealed = game.submitted && game.getScore().correct === 40;
  el.innerHTML = `<img src="${imgPath(card.id, revealed)}" alt="${card.name}" draggable="false">
                  <span class="card-label">${card.name}</span>`;

  if (!isLocked) {
    el.addEventListener('click',   e => { e.stopPropagation(); onCardClick(card.id, zone, slotIndex); });
  }
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

  if (game.lockedSlots.has(slotIndex)) {
    el.classList.add('locked');
  } else if (game.submitted && game.results) {
    const r = game.results[slotIndex];
    if (r === true)  el.classList.add('correct');
    if (r === false) el.classList.add('incorrect');
  } else if (game.incorrectSlots.has(slotIndex)) {
    el.classList.add('incorrect');
  }

  // Click on the slot background (not the card) → place selected card
  if (!game.lockedSlots.has(slotIndex)) {
    el.addEventListener('click', () => onSlotClick(slotIndex));
  }

  // Drag-over / drop
  el.addEventListener('dragover', e => {
    if (game.submitted || game.lockedSlots.has(slotIndex)) return;
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
  const placed = game.getPlacedCount();
  placedEl.textContent = `${placed} / 40 placed`;
  submitBtn.disabled   = game.submitted;
  const fill = document.getElementById('progress-fill');
  if (fill) fill.style.width = `${(placed / 40) * 100}%`;
}

function updateHintBar() {
  if (game.selected && !game.submitted) {
    const card = CARD_MAP.get(game.selected.cardId);
    hintText.textContent = `"${card.name}" selected — click a slot to place it`;
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
  else if (correct >= 30)   modalMsg.textContent = '🌟 Excellent! Correct ones are locked — keep going!';
  else if (correct >= 20)   modalMsg.textContent = '👍 Good effort! Correct ones are locked in blue.';
  else if (correct >= 10)   modalMsg.textContent = '📚 Not bad! Correct ones are locked — keep rearranging.';
  else                      modalMsg.textContent = '🤔 Keep going! Correct ones are locked in blue.';

  // Hide Continue on perfect score
  modalContinue.hidden = (correct === 40);

  modalList.innerHTML = '';
  game.slots.forEach((cardId, i) => {
    const row = document.createElement('div');
    row.className = 'result-row';
    if (cardId === null) {
      row.innerHTML = `<span class="ri-icon">⬜</span>
                       <span class="ri-pos">#${i + 1}</span>
                       <span class="ri-name empty">— empty —</span>`;
    } else {
      const card = CARD_MAP.get(cardId);
      const ok   = game.results[i];
      row.innerHTML = `<span class="ri-icon">${ok ? '✅' : '❌'}</span>
                       <span class="ri-pos">#${i + 1}</span>
                       <span class="ri-name">${card.name}</span>
                       <span class="ri-year">${card.year}</span>`;
    }
    modalList.appendChild(row);
  });

  modal.hidden = false;

  // On perfect score, swap card images to revealed versions after a short delay
  if (correct === 40) {
    setTimeout(revealAllCards, 600);
  }
}

function revealAllCards() {
  document.querySelectorAll('.card img').forEach(img => {
    const card = img.closest('.card');
    if (!card) return;
    const id = parseInt(card.dataset.cardId, 10);
    if (!id) return;
    img.style.transition = 'opacity .35s';
    img.style.opacity = '0';
    setTimeout(() => {
      img.src = imgPath(id, true);
      img.onload = () => { img.style.opacity = '1'; };
    }, 350);
  });
}

modalContinue.addEventListener('click', () => {
  game.continueGame();
  game.save();
  modal.hidden = true;
  renderAll();
});

modalRetry.addEventListener('click', () => {
  game.reset();
  game.save();
  renderAll();
  modal.hidden = true;
});

// Close modal when clicking the backdrop
modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });

// ─── Touch drag-and-drop + long-press context menu ───────────────────────────

let touchDrag      = null;
let touchClone     = null;
let longPressTimer = null;
let touchMoved     = false;
const LONG_PRESS_MS    = 500;
const LONG_PRESS_SLOP  = 8; // px movement allowed before it's a drag not a press

document.addEventListener('touchstart', e => {
  if (game.submitted) return;
  const cardEl = e.target.closest('.card');
  if (!cardEl) return;

  const cardId    = parseInt(cardEl.dataset.cardId, 10);
  const zone      = cardEl.dataset.zone;
  const slotIndex = cardEl.dataset.slotIndex != null ? parseInt(cardEl.dataset.slotIndex, 10) : null;
  const touch     = e.touches[0];
  const startX    = touch.clientX;
  const startY    = touch.clientY;
  const rect      = cardEl.getBoundingClientRect();

  touchMoved = false;

  // Long-press: show context menu if finger stays still for LONG_PRESS_MS
  longPressTimer = setTimeout(() => {
    if (touchMoved) return;
    // Cancel the drag that was being set up
    if (touchClone) { touchClone.remove(); touchClone = null; }
    const orig = document.querySelector(`.card[data-card-id="${cardId}"]`);
    if (orig) orig.style.opacity = '';
    touchDrag = null;
    showLongPressMenu(cardId, zone, slotIndex, startX, startY);
  }, LONG_PRESS_MS);

  touchDrag = { cardId, zone, slotIndex, offsetX: touch.clientX - rect.left, offsetY: touch.clientY - rect.top };

  touchClone = cardEl.cloneNode(true);
  touchClone.classList.add('touch-clone');
  touchClone.style.cssText =
    `position:fixed;width:${rect.width}px;left:${rect.left}px;top:${rect.top}px;pointer-events:none;z-index:9999;`;
  document.body.appendChild(touchClone);
  cardEl.style.opacity = '0.3';
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (!touchDrag) return;
  const t = e.touches[0];
  // If finger moved beyond slop, it's a drag — cancel long-press
  if (!touchMoved) {
    const dx = t.clientX - (touchDrag.offsetX + (touchClone ? parseFloat(touchClone.style.left) : t.clientX));
    // simpler: just mark moved once we exceed slop from any movement
    touchMoved = true;
    clearTimeout(longPressTimer);
  }
  if (!touchClone) return;
  e.preventDefault();
  touchClone.style.left = `${t.clientX - touchDrag.offsetX}px`;
  touchClone.style.top  = `${t.clientY - touchDrag.offsetY}px`;
  autoScrollNearEdge(t.clientX, t.clientY);
}, { passive: false });

const SCROLL_EDGE = 64;  // px from edge to trigger scroll
const SCROLL_SPEED = 10; // px per touchmove event

function autoScrollNearEdge(cx, cy) {
  // Vertical scroll: board panel
  const board = document.querySelector('.board-panel');
  if (board) {
    const r = board.getBoundingClientRect();
    if (cx >= r.left && cx <= r.right) {
      if      (cy < r.top    + SCROLL_EDGE) board.scrollTop -= SCROLL_SPEED;
      else if (cy > r.bottom - SCROLL_EDGE) board.scrollTop += SCROLL_SPEED;
    }
  }
  // Horizontal scroll: deck and later card lists (mobile horizontal layout)
  document.querySelectorAll('.card-list').forEach(list => {
    const r = list.getBoundingClientRect();
    if (cy >= r.top && cy <= r.bottom) {
      if      (cx < r.left  + SCROLL_EDGE) list.scrollLeft -= SCROLL_SPEED;
      else if (cx > r.right - SCROLL_EDGE) list.scrollLeft += SCROLL_SPEED;
    }
    // Also vertical scroll for deck/later in portrait when they stack
    if (cx >= r.left && cx <= r.right) {
      if      (cy < r.top    + SCROLL_EDGE) list.scrollTop -= SCROLL_SPEED;
      else if (cy > r.bottom - SCROLL_EDGE) list.scrollTop += SCROLL_SPEED;
    }
  });
  // Window-level scroll for mobile stacked layout
  if      (cy < SCROLL_EDGE)                     window.scrollBy(0, -SCROLL_SPEED);
  else if (cy > window.innerHeight - SCROLL_EDGE) window.scrollBy(0,  SCROLL_SPEED);
}

document.addEventListener('touchend', e => {
  clearTimeout(longPressTimer);
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

// ─── Long-press context menu ─────────────────────────────────────────────────

let longPressMenuEl = null;

function showLongPressMenu(cardId, zone, slotIndex, cx, cy) {
  if (game.submitted) return;
  dismissLongPressMenu();

  const card = CARD_MAP.get(cardId);
  const isInLater = zone === 'later';
  const isInDeck  = zone === 'deck';

  const menu = document.createElement('div');
  menu.className = 'lp-menu';
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', `Actions for ${card.name}`);

  const title = document.createElement('div');
  title.className = 'lp-title';
  title.textContent = card.name;
  menu.appendChild(title);

  if (!isInLater) {
    const laterBtn = document.createElement('button');
    laterBtn.className = 'lp-btn';
    laterBtn.textContent = '📌 Save for Later';
    laterBtn.addEventListener('click', () => {
      game.moveToLater(cardId);
      game.deselect();
      game.save();
      renderAll();
      dismissLongPressMenu();
    });
    menu.appendChild(laterBtn);
  }

  if (!isInDeck) {
    const deckBtn = document.createElement('button');
    deckBtn.className = 'lp-btn';
    deckBtn.textContent = '↩ Return to Deck';
    deckBtn.addEventListener('click', () => {
      game.returnToDeck(cardId);
      game.deselect();
      game.save();
      renderAll();
      dismissLongPressMenu();
    });
    menu.appendChild(deckBtn);
  }

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'lp-btn lp-btn-cancel';
  cancelBtn.textContent = '✕ Cancel';
  cancelBtn.addEventListener('click', dismissLongPressMenu);
  menu.appendChild(cancelBtn);

  // Position near the touch point, keeping within viewport
  document.body.appendChild(menu);
  longPressMenuEl = menu;

  const mw = menu.offsetWidth  || 200;
  const mh = menu.offsetHeight || 160;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = cx - mw / 2;
  let top  = cy + 16;
  if (left < 8)       left = 8;
  if (left + mw > vw - 8) left = vw - mw - 8;
  if (top  + mh > vh - 8) top  = cy - mh - 16;
  if (top  < 8)       top  = 8;

  menu.style.left = `${left}px`;
  menu.style.top  = `${top}px`;

  // Backdrop tap to dismiss
  const backdrop = document.createElement('div');
  backdrop.className = 'lp-backdrop';
  backdrop.addEventListener('touchstart', dismissLongPressMenu, { passive: true });
  backdrop.addEventListener('click',      dismissLongPressMenu);
  document.body.insertBefore(backdrop, menu);
  longPressMenuEl._backdrop = backdrop;

  // Vibrate for haptic feedback (where supported)
  if (navigator.vibrate) navigator.vibrate(40);
}

function dismissLongPressMenu() {
  if (!longPressMenuEl) return;
  longPressMenuEl._backdrop && longPressMenuEl._backdrop.remove();
  longPressMenuEl.remove();
  longPressMenuEl = null;
}

// ─── Keyboard shortcut ────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && game.selected) {
    game.deselect();
    renderAll();
  }
});

// ─── Initialise ───────────────────────────────────────────────────────────────

renderAll();
