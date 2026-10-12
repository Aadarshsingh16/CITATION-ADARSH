---
name: ui-states
description: Use when building or reviewing any screen or component. A feature is not done until every applicable state in docs/DESIGN.md exists and has been seen in a browser.
---

# UI states

Interface quality is part of the assessment. A reviewer will use the deployed app with their own files, so
empty, loading, error and edge states are as important as the happy path.

## Process for every feature
1. Open `docs/DESIGN.md`, find the "Every state that must exist" row for the area.
2. List the states for this feature in your plan before coding.
3. Build all of them, not just the happy path. Use tokens from DESIGN.md, no ad hoc colours.
4. Force each state to occur and look at it in a browser (throttle the network, kill the API, upload bad files,
   stop a stream). Type checks only prove it compiles.
5. Screenshot the main states for the README.

## Non-negotiables
- Processing is never silent: every long operation shows a stage and, where possible, determinate progress.
- Every failure shows what happened, what to do next, and a retry when sensible.
- Quote verification states are guidance: verified (green, check icon), pending (grey), unverified (amber, warning
  icon plus a plain-language reason). Never red. Red is only for operations that failed.
- Colour is never the only signal. Use icon plus text.
- Partial coverage banner is visible on the message and not dismissible.
- Disabled controls explain why (tooltip or hint).
- Keyboard: Send, Stop, open quote and close viewer all work from the keyboard. Focus ring visible.
- Copy: plain language, no jargon, no em dashes, never say "verified" unless our code checked it.
- Layout: three regions (library, chat, viewer). Document text in a serif, UI in a sans. Generous spacing.

## Checklist before saying a feature is done
- [ ] Empty state
- [ ] Loading state (skeleton or progress)
- [ ] Success state
- [ ] Error state with retry
- [ ] Edge states from DESIGN.md for this area
- [ ] Works at 1280px width, degrades at narrower widths
- [ ] Keyboard and focus checked
- [ ] Seen in the browser, screenshot taken
