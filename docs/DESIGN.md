# Design (v2)

Supersedes the earlier DESIGN.md. The interface is part of the assessment: it must look finished and be usable for
real work without explanation. Desktop-first (1280px laptop), degrades sensibly on tablet.

## 0. Where this style comes from, and how to use it
The style takes cues from a set of citation UI frames (a two-pane sources modal, a hovercard with status states, a
verdict header bar, source-type icons, a numbered list item, a search-and-select picker). Those frames are a MOOD AND
PATTERN reference only. This is a different product with different features. Take the principles below, then design
our own screens from them.

**Take (style principles)**
1. Calm, light, enterprise feel: white panels floating on a pale blue-tinted canvas, soft borders, large radii.
2. Grayscale does most of the work. One primary blue for actions. Colour is reserved for state.
3. **The status bar pattern**: a full-width tinted strip at the top of an evidence card with an icon and bold label on the
   left and a short italic explanation on the right. This is the signature element. Every quote state uses it.
4. **Numbers as the thread**: small numbered chips link the sentence in the answer, the sources list, and the evidence card.
5. Passage-first evidence: show the actual text with a soft highlight band, then a small italic footer strip with the
   location ("Page 12 · Clause 14.2").
6. Two-pane master/detail for browsing evidence: list on the left, detail cards on the right.
7. Hovercard preview with a faded excerpt, a "Show full passage" link, a ghost action, and one primary action.
8. Line icons with a consistent stroke, gray-600, paired with a text label.

**Do not copy**
- Their labels, content, source types, or concepts (business profile, case study, approved response, win themes,
  "mask as wrong", "user added", the add-citations authoring flow). We have none of those.
- Their exact colours for status. We remap them (section 2) so each state has its own meaning in our product.
- Their exact layouts, sizes, copy, or icons. Build ours to fit our features.

**Keep the reference frames out of git.** They come from another project and may be confidential. Keep them locally
(for example `docs/design-reference/`, listed in `.gitignore`), never commit or deploy them.

## 1. Layout
Floating panels on a tinted canvas, 12px gaps, 12px outer padding.
```
canvas #F6F8FF
+------------+----------------------------------------+------------------------+
| Library    | Chat                                   | Document viewer        |
| panel      | panel                                  | panel                  |
| 280px      | flexible, min 480px                    | 440 to 560px, resizable|
|            |                                        | collapsible            |
+------------+----------------------------------------+------------------------+
```
- **Library panel**: product name, upload dropzone, "Try with sample contracts" (when empty), search, document list,
  a "Multi-document" chats section, "Compare versions" action.
- **Chat panel**: header (document name or "3 documents", mode chip, coverage chip), message list, composer.
- **Viewer panel**: appears when a quote or document is opened. Header with file icon, file name, page indicator,
  occurrence counter, close.
- **Evidence panel** (modal over the workspace) for browsing all sources of one answer (section 6.4).
- **Comparison** is a full-width view: change list left, side-by-side texts right.
- Below 1100px the viewer becomes an overlay sheet. Below 800px the library collapses to a drawer.

## 2. Design tokens
Define as CSS variables in `globals.css` and expose to Tailwind (v4 `@theme`). No ad hoc hex values in components.

### Neutrals
```
--canvas:        #F6F8FF   app background, the "tinted frame"
--panel:         #FFFFFF   panels, cards
--surface-1:     #F9FAFB   passage blocks, inset areas
--surface-2:     #F3F4F6   footer strips, subtle fills, hover
--border:        #E5E7EB
--border-strong: #D1D5DB
--ink:           #111827   titles
--ink-2:         #374151   body
--ink-3:         #4B5563   secondary, icons
--muted:         #6B7280   meta, placeholders
```
### Primary
```
--primary:       #2563EB   primary buttons, focus ring, links
--primary-hover: #1D4ED8
--primary-soft:  #EFF6FF   selected row, hover tint
--primary-tint:  #DBEAFE   number chips, info bars
```
### State colours (each is a pair: background strip, foreground text and icon)
```
verified    bg #DCFCE7  fg #15803D
unverified  bg #FEF3C7  fg #B45309     (amber, guidance, never red)
repaired    bg #EDE9FE  fg #6D28D9     (quote re-copied exactly, then verified)
info        bg #DBEAFE  fg #1D4ED8     (coverage notices, tips)
pending     bg #E5E7EB  fg #4B5563     (checking, neutral)
danger      bg #FEE2E2  fg #B91C1C     (real failures only: upload failed, request failed)
```
Rule: quote verification states are guidance. They are never red. Red is only for operations that actually failed.

### Significance (comparison)
```
high      bg #FFEDD5  fg #C2410C
medium    bg #FEF9C3  fg #A16207
low       bg #DBEAFE  fg #1D4ED8
cosmetic  bg #F3F4F6  fg #4B5563
```
### Highlights and diffs
```
--hl-active:  #FDE68A   the active occurrence in the viewer (use mix-blend-mode: multiply on rendered PDF pages)
--hl-other:   #BFDBFE   other occurrences of the same quote (60 percent opacity)
--diff-add:   #DCFCE7   added words
--diff-del:   #FEE2E2   removed words, with strikethrough (the one allowed use of red-ish outside failures, conventional for diffs)
```
### Shape, depth, spacing
- Radii: panel 16px, card 12px, input and button 8px, chip 6px, number pill 6px, status bar 8px (top corners match the card).
- Shadows: panels `0 1px 2px rgba(17,24,39,.06)`, hovercard and modal `0 8px 24px rgba(17,24,39,.12)`.
- Spacing on a 4px grid. Card padding 16px. Panel padding 16 to 24px. Gap between stacked cards 12px.
- Borders 1px `--border`. Dividers inside cards use `--surface-2` strips rather than lines where possible.

## 3. Typography
- **UI:** Inter (variable), fallback system sans. Base 14px / 1.5.
- **Document and quote text:** Source Serif 4 (or Newsreader), 15px / 1.7, so passages read like contract text.
- **Mono:** only ids and the dev telemetry panel.
- Scale: 12 captions and chips, 13 meta and footer strips, 14 base, 15 passages, 16 card titles, 18 panel titles, 24 page title.
- Weights: 400 body, 500 labels and buttons, 600 titles and status labels.
- Status bar: label 600 13px, explanation italic 400 12.5px muted-to-fg at 80 percent.
- Use `dir="auto"` on every text block that shows document text (bilingual contracts).

## 4. Iconography
`lucide-react`, stroke width 1.6, 16px in lists, 20px in headers, colour `--ink-3`. Always paired with a text label.
- File types: a small PDF badge (rose tint) and DOCX badge (blue tint) as filled rounded squares with the letters, not outline icons.
- Status icons: check (verified), alert-triangle (unverified), sparkles or wand (repaired), clock (pending), info (coverage), x-circle (danger).
- Clause categories (comparison and clause outline), each a line icon beside the label:
  liability = Scale, payment = Banknote, termination = LogOut, term and renewal = CalendarClock, scope = Layers,
  IP = Copyright, confidentiality = Lock, governing law = Landmark, obligations = ListChecks, definitions = BookOpen, other = CircleEllipsis.

## 5. Interaction principles
- Hover on a quote pill opens the hovercard after 200ms, stays open while the pointer is inside it, closes on Esc.
- Click on a pill opens the document in the viewer at that passage. Click on a sentence's number in the evidence panel does the same.
- Everything clickable has a visible focus ring (2px `--primary`, 2px offset).
- Motion is short: 150ms ease-out. Pill resolving from pending to verified or unverified fades colour and does one soft scale pulse.
  The highlight flashes `--hl-active` at full strength and settles to 70 percent after 600ms. Honour `prefers-reduced-motion` (no pulse, no flash).
- Streaming shows a soft caret. Auto-scroll follows the stream and stops as soon as the user scrolls up, with a "Jump to latest" chip.
- Destructive actions (delete document) use a confirm dialog that names the file.
- Nothing disappears silently. Dropped or unverified items are counted and visible somewhere.

## 6. Components

### 6.1 Number chip and quote pill
- Chip: 20px square, radius 6, number 12px 600. Neutral list chip uses `--primary-tint` bg and `--primary` fg.
- **Quote pill (inline in the answer)**, small superscript-style chip after the sentence:
  - pending: gray, subtle pulse
  - verified: green pair, solid border
  - unverified: amber pair, **dashed** border (shape, not only colour, signals the state)
  - repaired: purple pair, solid
- The same number appears in the sources list and on the evidence card.

### 6.2 Status bar (signature element)
Full-width strip, 32px high, radius 8 on top corners, padding 0 12px. Left: icon + bold label. Right: italic explanation.
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
| coverage partial (reused as a banner) | Partial | Read 31 of 48 sections |

### 6.3 Quote hovercard
Width 420px. White card, radius 12, soft shadow.
```
+--------------------------------------------------+
| Services Agreement.pdf               [PDF badge] |   title 16/600, type badge right
| +----------------------------------------------+ |
| | v Verified      Found in the document        | |   status bar
| | 14.2 Termination. Either party may terminate | |   serif excerpt, 3 lines
| | for convenience on ninety days written ...   | |   fades out at the bottom
| | Page 12 · Clause 14.2     Show full passage  | |   footer strip + underlined link
| +----------------------------------------------+ |
|  All sources                 [ Open in document ]|   ghost left, primary right
+--------------------------------------------------+
```
- Unverified variant: no Open button. The excerpt area shows what the assistant wrote inside a dashed box, labelled
  "Not found in document", italic muted. Actions: "All sources" (ghost) only.
- Multi-document: the document name is the title, and a small chip shows "D2" if documents are labelled.

### 6.4 Evidence panel (two-pane modal, opened from "View all sources" under an answer)
```
+-------------------------------------------------------------------------+
| Sources                                                              x  |
| +--------------------+ +----------------------------------------------+ |
| | 1  Services Agr.   | | [PDF] Services Agreement.pdf  [Open document]| |
| | 2  Services Agr.   | | +------------------------------------------+ | |
| | 3  Master Terms  ! | | | Supports: "either party may terminate"   | | |
| | v Not verified (2) | | | v Verified          Found in the doc     | | |
| |                    | | | passage text with highlight band         | | |
| |                    | | | Page 12 · Clause 14.2                    | | |
| |                    | | | Copy quote            [ Show in document]| | |
| |                    | | +------------------------------------------+ | |
| +--------------------+ +----------------------------------------------+ |
+-------------------------------------------------------------------------+
```
- Left list: number chip, document name, warning icon on the right for unverified. Selected row `--primary-soft`. Verified first,
  then a collapsible group "Not verified (n)" collapsed by default with the count visible.
- Right pane: file header with badge, name, outline "Open document" button. Below, a stack of evidence cards, one per quote
  that points to that document, each with: "Supports: "…"" (the claim sentence, truncated), status bar, passage block on
  `--surface-1` with the highlight band, footer strip with location, action row (ghost "Copy quote", outline "Show in document").
- The pane scrolls independently. The selected list item scrolls its cards into view.

### 6.5 Answer message
- Assistant message: no avatar bubble. Left-aligned text on `--panel`, 15px, max width 720px. User message: right-aligned
  `--primary-soft` bubble.
- Under the text: a compact **sources strip** of numbered chips with document names (truncate), a warning icon on unverified ones.
  Clicking a chip opens the evidence panel at that source. A "View all sources" link follows.
- Header chips on the message: mode (Full document, Read in sections, Searched sections, Deep research) and coverage.
- **Coverage banner** (info status bar, always visible on that message, not dismissible): "Partial · Read 31 of 48 sections.
  Statements that something is missing only apply to the parts read."
- States: streaming (caret, pending pills), stopped (muted "Stopped" tag, partial text kept), error (danger bar with Retry).
- A small dev toggle opens the telemetry panel (proposed, verified, unverified by reason, dropped, repaired).

### 6.6 Composer
- Rounded 12px input, auto-grow to 6 lines, send button (primary) that turns into Stop (outline with square icon) while streaming.
- Left of the send button: **Deep research** toggle chip with a tooltip: "Lets the assistant look things up step by step."
- Context chips above the input show the selected documents (removable) in multi-document chats.
- Suggested questions on empty chat as outline chips ("Summarise the key obligations", "Is there a termination for convenience clause?").

### 6.7 Document viewer
- Header: PDF/DOCX badge, name, "Page 12 of 150", occurrence counter "2 of 3" with previous and next, close.
- **PDF**: real rendered page (canvas) with a highlight layer. Pages lazy-render, with a skeleton while loading.
  Cross-page quotes highlight on both pages. Fallback notice when falling back: info bar "Showing extracted text for this page."
- **DOCX and fallback**: serif text view, paragraphs with page or section separators ("Section 4"), highlight by offsets.
- A thin footer strip shows where the active highlight is ("Page 12 · Clause 14.2") and a "Copy quote" ghost button.
- Highlight: active occurrence `--hl-active`, other occurrences `--hl-other`. Scroll the active highlight to the vertical center.

### 6.8 Library
- Document card (inside the library panel): badge, file name (truncate), meta line "128 pages · 2.1 MB · 13 Oct", status chip,
  overflow menu (Open, Rename optional, Delete). Selected for multi-doc via a checkbox on hover or when any is checked.
- Processing card: stage label and a determinate bar ("Extracting page 42 of 150"), stages shown as a three-step line
  (Uploading, Reading, Indexing). Cancels are not required.
- Rejected upload: a dismissible card (not a library row) with a danger or amber bar, the reason in plain words, and a next step.
- Duplicate notice: info strip "You already have this file", link "Open existing", and "Keep both".
- Empty library: friendly illustration-free empty state, large dropzone, "Try with sample contracts" outline button.
- Search field with a search icon at the top of the list.

### 6.9 Multi-document picker
Use a select-list pattern (search field on top, rows with title, type badge and a short preview, selected row gets a primary
border and `--primary-soft` fill). Footer line summarises the choice ("3 documents selected") and a primary button
"Ask across 3 documents". Documents still processing are disabled with a hint ("Still processing, available when ready").
In answers, every quote shows its document with a small badge (D1, D2, D3) and file name.

### 6.10 Comparison
```
+--------------------------------------------------------------------------------+
| Compare   [v1 Services Agreement.pdf] <-> [v2 Services Agreement.pdf]   Swap   |
| Summary: Liability cap raised from AED 100,000 to AED 1,000,000. Notice ...    |
| [All 14] [High 3] [Medium 4] [Low 3] [Cosmetic 4]      Sort: Significance v    |
| +---------------------------+--------------------------------------------------+
| | [Scale] 12.1  High        | Clause 12.1 Limitation of liability               |
| | Cap raised 100k to 1M     | v1 ............ | v2 ............                |
| | [LogOut] 14.2  Medium ... | words added in green, removed in red strikethrough |
| +---------------------------+--------------------------------------------------+
+--------------------------------------------------------------------------------+
```
- Change row: category icon, clause ref, significance chip, one-line plain summary, kind tag (Modified, Added, Removed, Moved).
- Selected row `--primary-soft`. Detail pane shows the two clause texts side by side with word-level diff highlighting.
- Entry: pick two library documents or upload two files in place, with a Swap control to set which is earlier and later.
- States: running with progress, no differences, filter empty, low alignment confidence notice (info bar), failure with retry.

### 6.11 Agent trace (Deep research)
A live list inside the answer area: each step has a spinner that becomes a tick, with human wording ("Searching for termination
provisions...", "Reading clause 14.2"). Invalid lookups appear as a neutral note ("That lookup was invalid, trying again").
When done it collapses to "5 lookups" with a chevron. If the cap was reached, an info bar says "Research limit reached, answered with what was found".

### 6.12 Buttons, inputs, chips
- Primary: `--primary` fill, white text, radius 8, 36px high. Outline: white fill, `--border-strong` border. Ghost: text only with icon, no border.
  Danger buttons only for destructive confirmations.
- Input: white, 1px border, radius 8, search icon inside. Focus ring primary.
- Chips: 24px high, radius 6, 12px text. Underlined text link is used only for "Show full passage" style inline actions.

## 7. Every state that must exist
Features are not done until each applicable state is built and seen in a browser.

| Area | States |
|---|---|
| Library | empty with upload and samples, loading skeleton, populated, selecting for multi-doc, delete confirm, delete in progress |
| Upload | idle dropzone, drag over, uploading with progress, reading with page progress, indexing, ready, wrong file type, too large, scanned PDF with no text, encrypted PDF, extraction failed with retry, interrupted with retry, partially unreadable pages warning, duplicate notice |
| Chat | no document selected, empty chat with suggested questions, sending, streaming, stopped, error with retry, history loading, history empty, rate limit message |
| Quotes | pending, verified, verified with gaps, repaired, unverified (each reason), hovercard variants, evidence panel with and without unverified group |
| Coverage | full (subtle label), partial banner, unreadable pages note |
| Viewer | closed, loading page skeleton, open, active highlight, multiple occurrences, cross-page highlight, fallback text view notice, quote not locatable notice |
| Multi-doc | picker, selection chips, per-quote document label, processing document disabled |
| Comparison | pick two, running with progress, results, no differences, filter empty, low confidence notice, failure with retry |
| Agent | step streaming, invalid lookup note, cap reached notice, final answer |
| Global | first load, cold start loading, offline or network error, 404 document, health failure |

## 8. Copy rules
- Say what happened and what to do next. "This PDF has no readable text. It looks like a scan. Upload a text-based version or run OCR first."
  Never "Error 422".
- Never say "verified" for anything our code did not check.
- Plain words for reasons (section 6.2). No jargon like "offset" or "chunk" in the UI. Say "section".
- No em dashes in user-facing text.
- Sentence case for buttons and headings.

## 9. Accessibility
Visible focus rings. Keyboard operable: send, stop, open quote, next and previous occurrence, close panels, evidence list navigation
with arrow keys. Colour is never the only signal (icon + label + dashed border for unverified). Text contrast at least 4.5:1 on the
token pairs above (check amber and gray pairs). Status changes announced with `aria-live="polite"` (for example "Quote 2 verified").
Hovercard content reachable by keyboard focus on the pill. Respect `prefers-reduced-motion`.

## 10. Implementation notes
- Tailwind with CSS-variable tokens. Small primitives in `src/components/ui/`: `Button`, `Chip`, `NumberChip`, `StatusBar`, `Card`,
  `Panel`, `Input`, `Dialog`, `Tooltip`, `Progress`, `Skeleton`.
- Feature components: `src/components/quotes/` (`QuotePill`, `QuoteHoverCard`, `EvidencePanel`, `EvidenceCard`),
  `src/components/chat/`, `src/components/library/`, `src/components/viewer/`, `src/components/compare/`, `src/components/agent/`.
- `StatusBar` takes a `kind` and a reason code and owns the label and text table in section 6.2, so wording stays consistent.
- One shared `useQuoteState` hook maps a quote result to pill, hovercard and card, so they can never disagree.
- Build order follows PHASES.md: tokens and primitives and the library in P1, chat, pills, hovercard and evidence panel in P2,
  coverage banner and map-reduce progress in P3, viewer in P4, picker and labels in P5, comparison in P6, agent trace in P7.
- Use the browser to check each screen at 1280px and at about 1000px. Take the README screenshots from the real app.

## 11. Design QA checklist (run before calling a phase done)
- [ ] Only tokens used, no stray hex values
- [ ] Every state in section 7 for this area exists and was seen
- [ ] Status bars use the shared component and wording
- [ ] Unverified is amber and dashed, never red
- [ ] Keyboard path works, focus ring visible
- [ ] Reduced motion respected
- [ ] 1280px and about 1000px checked
- [ ] No text overflow on long file names or long clause titles
- [ ] Screenshot saved for the README
