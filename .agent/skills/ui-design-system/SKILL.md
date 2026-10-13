---
name: ui-design-system
description: Use for ANY visual or UI work in this project (screens, components, styling, layout, copy, motion). Defines the Contract Analyser identity, the Spine signature element, navigation structure, tokens, components, and the review process that keeps the UI distinctive and polished instead of a generic three-panel SaaS kit.
---

# UI design system: Contract Analyser

Read `docs/DESIGN.md` for the full spec and `assets/tokens.css` for the tokens. This skill is how to apply them.
It supersedes the earlier DESIGN.md and any earlier `ui-states` guidance where they conflict.

## The brief in one paragraph
Subject: a contract reader for people who must trust what they are told about a document (bid writers, reviewers).
The primary job: ask a question, get an answer, and be able to check it against the page in one click.
The product earns trust through evidence, so evidence is the design. The identity comes from marking up documents:
highlighter, margin notes, section tabs, redlines. It must not look like the generic chat-with-sidebar layout.

## Identity (decided, do not drift)
- **Canvas** cool violet-tinted mist, white sheets, borders instead of shadows.
- **Ink** deep violet-ink for text and for primary buttons (dark buttons, not blue).
- **Seal green** for verified and brand moments. **Marker yellow** for highlights. Amber for unverified. Rose redline only in diffs.
- **Type**: two families, clearly distinct. Bricolage Grotesque for UI and headings, Newsreader for anything that is document text
  (answers, quotes, passages, viewer text fallback). No Inter.
- **One memorable element: the Spine** (below). Everything else stays quiet.

## The Spine (signature element, build it once, reuse it)
A thin strip made of small cells, one per section of a document, in document order.
- Coverage: cells filled `--seal` for sections read, `--sunken` for unread, with the text "31 of 48 sections read".
- Answer sources: small `--marker` ticks mark where each quote sits in the document. Hover a tick to preview the quote.
- Reading desk: a vertical Spine on the right edge shows pages, occurrences, and the current scroll position.
- Compare: change map, ticks colored by significance, click to jump to the change.
Component: `<Spine cells ticks active onSelect orientation />`. One implementation, four uses. Keep it 10 to 14px thick.

## Structure rules (this is what removes the "same as everyone" look)
1. Top bar with three modes: **Library**, **Ask**, **Compare**. No permanent three-panel layout.
2. **Library is a table**, not a stack of cards: file glyph and name, added, size, status with a dot, row actions.
3. **Ask is a reading page, not chat bubbles.** Each exchange is: the question as a heading, the answer as reading text,
   and a margin column with its evidence. No avatar bubbles, no card around the answer.
4. The document viewer is the **Reading desk**: it opens only when there is something to show. Never render an empty panel,
   never show "Loading document" or "No text available" with nothing open.
5. **Compare** is two slots (earlier version, later version) then a results page headed by the change map.
6. Selection actions appear in a **floating bar** at the bottom center, not as buttons crammed into rows.

## Rules that keep it out of the generic zone
- No identical rounded cards everywhere. Use the radius by role (tokens) and prefer rows, dividers, and open text over boxes.
- No box inside a box. If a card is inside a card, remove one.
- No gradient washes, blobs, or decorative backgrounds. Flat mist canvas.
- No uniform soft gray shadow on every element. Shadows only on things that float (hovercard, composer, floating bar, dialogs).
- No middle-dot joined meta strings. Write meta as separate columns or short natural text: "34 pages, 151 KB, added 14 Oct".
- No ALL-CAPS labels, no eyebrow label above every heading, no monospace for small data labels, no arrows appended to buttons.
- No file-type "PDF" pink pills. Use small colored document glyphs (PDF red, DOCX blue) with the name.
- Motion only answers an action: the marker sweep on a highlight, the quote flag settling when verified, panel slides. No entrance
  animations on every section, no hover lift on every card.
- Headings may not highlight a single word in a different style or color.

## Type scale
12 captions and chips, 13 table meta and footers, 15 base UI, 17 reading text (answers, quotes, passages), 20 section titles,
28 page titles, 40 for the first-run headline only. Reading text max 66ch, line height 1.7. UI line height 1.5.
Tabular numerals on, always, for counts, pages, and sizes.

## Quote markers ("flags")
Small inline markers after a claim: 22px tall, radius 6, number in tabular figures, a notch on the right edge like a sign-here flag
(clip-path) so they read as flags, not generic badges.
- verified: `--seal-soft` fill, `--seal` text, solid
- verified with gaps: same, with a small ellipsis glyph
- repaired: `--indigo-soft`, `--indigo`
- unverified: `--stamp-soft`, `--stamp`, dashed border (shape signals state, not only colour)
- pending: `--sunken`, `--muted`, a quiet shimmer

## Status bar wording (single source: `StatusBar` component owns this table)
| State | Label | Right-side text |
|---|---|---|
| verified | Verified | Found in the document |
| verified with gaps | Verified | Found in the document, with gaps in the quote |
| repaired | Repaired | Re-copied from the document, then verified |
| unverified, not found | Unverified | We could not find this wording in the document |
| unverified, too short | Unverified | Too short to check reliably |
| unverified, wrong document | Unverified | This wording is in a different document |
| unverified, malformed or checker error | Unverified | We could not check this quote |
| pending | Checking | Looking for this quote in the document |
| partial coverage | Partial | Read 31 of 48 sections |

## Process (follow in order, every UI task)
1. **Plan in a few lines**: which screen, which components, which states. Name the tokens you will use.
2. **Check against the rules above.** If a layout reads like "any chat app with a sidebar", change it.
3. **Build** with primitives from `src/components/ui/` and the tokens. Add new primitives rather than one-off styles.
4. **Screenshot at 1440, 1280 and 1000 wide** and look at them. Fix spacing, alignment, overflow, and hierarchy.
5. **Critique and remove one accessory**: delete the least useful decoration or border you added.
6. Run the state checklist in `ui-states`. Every state must be seen, not assumed.
7. Commit per component or screen using the git-workflow skill (`feat(ui): ...`).

## Fonts and setup
```ts
// src/app/layout.tsx
import { Bricolage_Grotesque, Newsreader } from 'next/font/google'
const ui = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-ui', display: 'swap' })
const read = Newsreader({ subsets: ['latin'], variable: '--font-read', style: ['normal', 'italic'], display: 'swap' })
// <html className={`${ui.variable} ${read.variable}`}>
```
Paste `assets/tokens.css` into `src/app/globals.css`. Set `devIndicators: false` in `next.config.ts` so screenshots are clean.
Use `lucide-react` icons at stroke 1.6. Document text blocks get `dir="auto"`.

## Primitives to build first (src/components/ui/)
`Button` (primary ink, secondary outline, ghost), `IconButton`, `Input`, `Chip`, `FileGlyph`, `StatusDot`, `StatusBar`, `QuoteFlag`,
`Spine`, `Sheet`, `Popover`, `Dialog`, `Progress`, `Skeleton`, `FloatingBar`, `Toast`, `Tabs` (top bar modes), `EmptyState`.

## Do not
- Copy any reference screenshot or earlier design frames exactly. They are mood only. Keep reference images out of git.
- Change data, API, verification, or business logic while restyling. Visual work only, tests stay green.
- Ship a screen with a missing state, a hard-coded colour, or a raw "Loading" or "No text available" message.
- Use "verified" for anything our code did not check.
