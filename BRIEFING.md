# Briefing

- Purpose: Card ordering game where players place 40 greatest innovations in chronological order
- Current scope: Static front-end app (HTML/CSS/JS) served via `npx serve public -l 3000`. Drag-and-drop and touch interactions. Deck, board (5-col grid, 40 slots), and "later" panel layout.
- Key decisions: Deck shows max 8 cards at a time (DECK_VISIBLE_LIMIT) to avoid squished appearance. Side panels are 190px wide so deck/later cards match board box proportions (were 240px, made cards look stretched in wide layout).
- Non-goals: No backend/database. No user accounts.
