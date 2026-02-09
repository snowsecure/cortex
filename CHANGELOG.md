# Changelog

## [0.4.2.6] — 2026-02-08

### Review & Results

- **"retyped (custom)" badge** — Added a tooltip explaining that the document type was changed during review and that "(custom)" means a free-text type, not a preset schema.
- **Not Found / Not Present** — Replaced the em dash ("—") with the label "Not Found / Not Present" everywhere a field is marked not-in-document (Results, document detail modal, Review queue). Inputs show the full label on hover when truncated.
- **Edited by** — The UI now shows the actual reviewer name (e.g. "13 fields edited by Philip Snowden") using `reviewedBy` / `reviewed_by`, with fallback to "reviewer". Grammar updated to "X fields edited by [name]"; reviewer name is no longer bold in the badge and "Sealed by" line.

### Results Page

- **Document list** — Removed the thin vertical strip (left border) on the left of expanded document rows.
- **Completion banner** — The green "Done — X completed · Saved to history" banner now only appears when a run has *just* finished in the current session. It no longer appears when opening Results with packets that completed in a previous session or after a refresh.

### Home Page

- **Color orbs** — The subtle red and sky blur orbs are slightly more pronounced.
- **Sky orb** — Moved further to the left for better balance.

---

*For earlier history, see git log or docs.*
