---
name: ui-states
description: Use when building or reviewing any screen or component. A feature is not done until every applicable state in docs/DESIGN.md section 9 exists and has been seen in a browser. Works together with the ui-design-system skill.
---

# UI states

Interface quality is part of the assessment. A reviewer will use the deployed app with their own files, so empty, loading, error and edge states
matter as much as the happy path. Use `ui-design-system` for how things should look. This skill makes sure nothing is missing.

## Process for every feature
1. Open `docs/DESIGN.md` section 9 and find the row for this area. List its states in your plan before coding.
2. Build all of them, not only the happy path, with the tokens and primitives from `ui-design-system`.
3. Force each state to occur and look at it in a browser: throttle the network, stop the API, upload bad files, press Stop mid-stream, open a quote with no document.
4. Take screenshots at 1440, 1280 and 1000 wide. Save the main ones for the README.
5. Record what you saw in the commit body or `docs/PROGRESS.md`. "Looks fine" without having opened it does not count.

## Non-negotiables
- Never render an empty shell. A panel appears only when it has content (the Reading desk is not mounted until a document or quote is opened).
- Never show a raw placeholder such as "Loading document..." or "No text available" when nothing is being loaded. Use a skeleton while loading, an
  EmptyState with an action when empty, and a plain-language message when failed.
- The file type shown always comes from the document's real data (a PDF never shows a DOCX label).
- Long operations show a stage and, where possible, determinate progress.
- Every failure says what happened, what to do next, and offers Retry when sensible.
- Quote states are guidance: verified (seal), unverified (amber, dashed flag), repaired (indigo), pending (quiet). Never red. Red is only for operations that failed.
- Color is never the only signal: icon plus label on every status.
- Partial coverage banner is visible on that exchange and cannot be dismissed.
- Disabled controls say why.
- Keyboard: tabs, rows, flags, hovercards, stepper, Send and Stop all work from the keyboard with a visible focus ring.
- Copy: plain language, sentence case, no em dashes, never "verified" unless our code checked it.

## Checklist before saying a feature is done
- [ ] Empty state (an invitation to act)
- [ ] Loading state (skeleton or progress)
- [ ] Success state
- [ ] Error state with retry
- [ ] The edge states listed for this area in DESIGN.md section 9
- [ ] Looked at at 1440, 1280, and 1000 wide
- [ ] Keyboard and focus checked
- [ ] Reduced motion checked
- [ ] Screenshot taken
