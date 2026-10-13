# Design (v3: revamp)

Supersedes v1 and v2. The first build worked, but it looked like every chat-with-a-sidebar app: three equal rounded panels,
cards inside cards, default blue, pink "PDF" pills, a viewer panel that sat empty or said "Loading document" with nothing open.
This version changes the structure, the identity, and the details. The skill `.agent/skills/ui-design-system/SKILL.md` is how to apply it,
and `assets/tokens.css` holds the tokens.

## 1. Concept
A contract reader that earns trust by showing its evidence. The look comes from marking up documents: highlighter, margin notes,
flagged pages, redlines. The one memorable element is **the Spine**, a thin strip of cells that stands for a document's sections.
It shows coverage, where quotes sit, where changes are, and where you are in the reader. Everything else stays quiet.

## 2. Where the cues come from
Mood and pattern cues only, never copied:
- A top navigation with a few clear modes instead of a permanent sidebar (Documents, Q and A, Compare).
- A documents table with file glyphs, status dots, and row actions.
- A compare start screen that pairs a document list with an upload area.
- Dark primary buttons, generous white space, a soft light canvas behind white sheets.
- From the earlier citation frames: the status bar on evidence cards, numbered markers linking text to evidence, a hovercard with a faded excerpt.

Do not copy their layouts, colours, labels, or content. Keep all reference images local and out of git.

## 3. Principles
1. **Evidence is the interface.** Every answer sits next to its proof.
2. **Structure by role, not by box.** Rows, dividers, and open text first. A card only when something is a self-contained object.
3. **One accent per meaning.** Green is verified, amber is unverified, indigo is selection and repaired, yellow is the highlighter, rose is removed text.
4. **Never show an empty shell.** Panels appear when they have content. Empty states invite an action.
5. **Reading comes first.** Answers and quotes are set in a serif at a comfortable measure. UI chrome stays small.
6. **Motion confirms an action.** The marker sweeps when a quote opens. Nothing animates on its own.

## 4. Tokens
See `assets/tokens.css`. Summary:

| Role | Token | Value |
|---|---|---|
| Text, dark buttons | ink | #17142B |
| Body, secondary | ink-2, ink-3, muted | #3B3855, #5A5775, #6E6B87 |
| Canvas | mist | #F1F0F8 |
| Surfaces | sheet, sheet-2, sunken | #FFFFFF, #F7F7FC, #ECEBF5 |
| Reading desk | desk | #E4E2EF |
| Verified, read | seal and seal-soft | #0B7A5F on #DDF3EA |
| Unverified | stamp and stamp-soft | #A8480A on #FCE9D2 |
| Repaired, focus, selection | indigo and indigo-soft | #4B3FD6 on #E8E6FB |
| Coverage notices | info and info-soft | #2A5C9A on #E1ECF9 |
| Removed text in diffs | redline and redline-soft | #B5224E on #FCE3EA |
| Real failures only | danger and danger-soft | #B42318 on #FEE4E2 |
| Highlighter | marker, marker-soft | #FFD84D, #FFF0A8 |

Significance chips (comparison): high uses stamp tones deepened to orange (#B4440A on #FFE6D0), medium uses #8A6A00 on #FFF0A8,
low uses info, cosmetic uses muted on sunken.

**Typography.** Bricolage Grotesque for UI and headings. Newsreader for answers, quotes, passages, and the viewer text fallback.
Scale: 12 chips, 13 table meta, 15 UI, 17 reading, 20 section titles, 28 page titles, 40 first-run headline.
Reading text: 66 characters max, line height 1.7. Tabular numerals everywhere numbers appear.

**Shape.** Radius by role: marks 6, controls 10, popovers 14, sheets 18, window 24. Borders carry structure (`--line`).
Shadows only for floating things (hovercard, composer, floating bar, dialog).

## 5. App shell
```
+----------------------------------------------------------------------------------+
| [mark] Contract Analyser        Library    Ask    Compare             Samples  ?  |  top bar 56px
+----------------------------------------------------------------------------------+
|                                                                                  |
|   screen content on the mist canvas, one big white sheet per screen              |
|                                                                                  |
+----------------------------------------------------------------------------------+
```
- The active mode has an ink underline that slides between tabs. No filled pills.
- Right side: "Samples" opens the sample contracts menu. "?" opens a short panel explaining how verification works, and the keyboard shortcuts.
- Routes: `/library`, `/ask` (with `?doc=` and `?chat=`), `/compare`. `/` goes to Library, or to Ask when a document exists.

## 6. Screens

### 6.1 Library (table)
```
Library                                        [Search documents]  [Type v] [Status v]  [Upload contract]
6 documents

  Name                                   Added      Size      Status
  [pdf] Services Agreement.pdf           14 Oct     2.1 MB    (green dot) Ready
        128 pages
  [pdf] Master Terms 2024.pdf            14 Oct     840 KB    (amber dot) Reading page 42 of 150   [=====>   ]
  [doc] Amendment No 1.docx              13 Oct     64 KB     (green dot) Ready
  [pdf] Scan 0042.pdf                    13 Oct     5.6 MB    (red dot) Not readable          Why?

                          (floating bar when rows are selected)
                 3 selected     [Ask across them]  [Compare]  [Delete]
```
- Rows, not cards. Row height 56. Hover shows "Ask" (secondary button) and a menu for delete. Click the name to open Ask on that document.
- Page count sits under the name in muted text. Added and size are their own columns. No dot-joined meta lines.
- Status is a dot plus words. Processing rows show a slim progress bar and the stage ("Reading page 42 of 150").
- Rejected uploads show as a banner above the table: reason in plain words, one next step, a Dismiss button. They are not rows.
- Duplicate: a small notice under the upload action, "You already have this file. Open it or keep both."
- Drag a file anywhere on the page: a full-width drop overlay appears.
- Empty library is the first-run screen (6.5).
- Selecting uses a checkbox column. Two selected enables Compare. The floating bar sits bottom center with the float shadow.

### 6.2 Ask (reading page)
Default layout, wide:
```
+-------------+---------------------------------------------+------------------------------+
| Chats       |  Services Agreement.pdf   [+ Add document]  |  Margin                      |
| (232px)     |  Read in full   ||||||||||||||||| 48 of 48   |  (360px, evidence for the    |
|             |                                             |   exchange you are reading)  |
| Today       |  Is there a termination for convenience    |                              |
|  Termination|  clause?                                    |  [1] Verified  14.2          |
|  Liability  |                                             |  "Either party may terminate |
|             |  Yes. Either party can end the agreement    |   on ninety days written..." |
| Earlier     |  [1] on ninety days written notice, and the |  Open in document            |
|  ...        |  customer must pay for services delivered   |                              |
|             |  up to the end date [2].                    |  [2] Verified  14.4          |
|             |                                             |  ...                         |
|             |  Where this came from  |--|---|----|---|     |                              |
|             |                                             |                              |
|             |  ( Ask about clauses, terms, obligations )  |                              |
|             |  [Deep research]                [Ask]       |                              |
+-------------+---------------------------------------------+------------------------------+
```
- **Exchange**: the question is a heading (20px, ink, Bricolage). The answer is reading text (Newsreader 17px, 66ch) with flags after claims.
  There is no bubble, no avatar, and no card around the answer. Exchanges are separated by a hairline.
- **Margin**: shows the evidence cards for the exchange in view, with the status bar pattern. Cards are listed in the order of the flags.
  On narrower screens the margin collapses into a row of numbered flag chips under the answer.
- **Where this came from**: a Spine for the document with marker ticks at the position of each quote. Hover a tick to preview it, click to open it.
- **Context bar** at the top of the column: document chips with a remove button, "Add document" (opens the picker, 6.6), the coverage meter
  (a Spine with seal cells and the text "31 of 48 sections read" when partial), and the mode name in plain words ("Read in full",
  "Read in sections", "Searched sections", "Deep research").
- **Coverage banner** when partial: an info status bar inside the exchange, always visible, never dismissible.
- **Composer**: floats at the bottom of the column with the float shadow, grows to six lines. Left of Ask sits a switch labelled "Deep research"
  with a tooltip. Ask is an ink button that becomes "Stop" (outline) while streaming.
- **Empty chat**: the document name as the page title, a one-line description of what it can do, and three suggested questions as text rows
  (not cards): "Summarise the key obligations", "Is there a termination for convenience clause?", "What are the payment terms?".
- **Chats rail** groups conversations by day. "New chat" is a button at the top. Multi-document chats are marked with a small stack glyph.

Reading mode, when a quote is opened in the document:
```
+----+-------------------------------+--------------------------------------------------+
| .. | Conversation (440px)          | Reading desk                                     |
|    | question, answer, flags       |  Services Agreement.pdf   Page 12 of 128   2 of 3 |
|    | evidence as compact chips     |  [rendered page on the desk, marker highlight]   |
+----+-------------------------------+--------------------------------------------------+
```
The chats rail collapses to icons. The margin turns into compact chips so the desk gets the space.

### 6.3 Reading desk (document viewer)
- A warm-neutral `--desk` background with white pages and a thin border, so pages read as sheets on a desk.
- Header: file glyph, name, "Page 12 of 128", an occurrence stepper "2 of 3" with previous and next, zoom, close.
- PDF pages are the real rendered pages. The highlight is the marker with the sweep animation. Other occurrences use the soft marker.
- A vertical Spine on the right edge: page cells, marker ticks for occurrences, a thumb for the current position. Click to jump.
- Footer line shows where the active highlight is, in words: "Page 12, Clause 14.2", with a Copy quote button.
- DOCX and the fallback use the text view: Newsreader, paragraphs, section separators labelled "Section 4".
- If the page falls back to text, show an info status bar: "Showing extracted text for this page."
- The desk is not mounted until something is opened. Opening it from a flag scrolls to the passage and plays the sweep once.

### 6.4 Compare
Step 1, choose two versions:
```
Compare versions

  Earlier version                         Later version
  +--------------------------------+  <->  +--------------------------------+
  | Choose from library  | Upload  |       | Choose from library  | Upload  |
  | (search, list with file glyphs)|       | (search, list with file glyphs)|
  +--------------------------------+       +--------------------------------+
                          [Swap]   [Compare versions]
```
Step 2, results:
- Headline summary in reading type (what changed in substance, two or three sentences), then the **change map**: a Spine of the contract with ticks
  colored by significance. Click a tick to jump to that change.
- Filter chips (All 14, High 3, Medium 4, Low 3, Cosmetic 4) and a sort control. A toggle for "Inline" or "Side by side".
- Change list: category glyph, clause reference, a significance chip, one plain-language sentence, kind (Changed, Added, Removed, Moved).
- Detail: both clause texts. Added words are underlined in seal, removed words are struck through in redline. Reworded-only changes are labelled
  "Wording only" and collapsed by default.
- States: running with progress, no differences, filter returns nothing, low-confidence alignment notice, failure with retry.

### 6.5 First run (empty library)
```
Ask a question. See the clause it came from.

We read your contract and check every quote against the page before we show it as verified.

  [ Upload contract ]       or     [ Try sample contracts ]

  Drop a PDF or Word file anywhere on this page. Up to 25 MB and 400 pages.
```
A single large dropzone is the page. No decorative art. The headline is Bricolage at 40px, left aligned. The copy states the product promise.

### 6.6 Document picker (Ask context and Compare slots)
A search field, then rows with file glyph, name, page count, and a checkbox (Ask) or a radio (Compare). The selected rows get an indigo-soft fill.
The footer shows "3 documents selected" and a primary button "Ask across 3 documents". Documents still processing are disabled with a reason.

## 7. Components

**Flag (quote marker).** See the skill. Hover or focus opens the hovercard after 200ms.

**Status bar.** A strip across the top of an evidence card: icon and bold label on the left, short explanation on the right in italics.
Wording table lives in the skill and is owned by the `StatusBar` component.

**Evidence card (in the margin).**
```
[1]  Services Agreement.pdf
+------------------------------------------+
| (check) Verified    Found in the document|   status bar
| 14.2 Termination for convenience. Either |   Newsreader 15px, marker highlight on the matched words
| party may terminate on ninety days...    |
| Page 12, Clause 14.2     Show full passage|   footer strip, 13px muted
+------------------------------------------+
Copy quote                 [Open in document]
```
Unverified variant: the dashed box says "Not found in document" and shows what the assistant wrote in italics. No open button.

**Hovercard.** The evidence card in a popover (14 radius, float shadow), 400px wide.

**File glyph.** A small document icon, red for PDF and blue for DOCX, 18px, next to the name. No text badge.

**Status dot.** 8px dot plus label: Ready (seal), Reading or Indexing (stamp, with progress), Not readable or Failed (danger), Interrupted (stamp, with Retry).

**Agent trace.** Inside the answer area while the agent works: a vertical list with a thin line connecting steps. Each step has a spinner that becomes a tick.
Human wording ("Searching for termination provisions", "Reading clause 14.2"). Invalid lookups are a quiet note. Collapses to "5 lookups" when done.
The Spine under it shows which sections were read.

**Floating bar.** Ink background, white text, 14 radius, float shadow, appears bottom center when rows are selected.

**Toasts.** Bottom right, short, with an action when useful. Errors that block use a banner instead.

## 8. Motion
- Marker sweep (450ms) when a quote opens in the desk. Flags settle with a short scale from 0.9 to 1 when they resolve to verified or unverified.
- Panels slide for 180ms. The tab underline slides between modes. Streaming shows a soft caret.
- Nothing else animates. All motion is disabled under `prefers-reduced-motion`.

## 9. States that must exist
| Area | States |
|---|---|
| Library | first run, loading skeleton rows, populated, selecting with floating bar, drag overlay, delete confirm that names the file, delete in progress |
| Upload | uploading, reading with page progress, indexing, ready, wrong file type, too large, scanned PDF with no text, encrypted, failed with retry, interrupted with retry, some pages unreadable warning, duplicate notice |
| Ask | no document, empty chat with suggestions, sending, streaming, stopped, error with retry, history loading, history empty, rate limit message |
| Quotes | pending, verified, verified with gaps, repaired, unverified for each reason, hovercard variants, margin cards, collapsed chips on narrow screens |
| Coverage | full, partial banner with Spine, unreadable pages note |
| Reading desk | not mounted, page skeleton, open, active sweep, several occurrences, cross-page highlight, text fallback notice, quote not locatable notice |
| Multi-document | picker, context chips, per-quote document label, processing document disabled |
| Compare | choose two, running, results, no differences, filter empty, low-confidence notice, failure with retry |
| Agent | step streaming, invalid lookup note, cap reached notice, final answer |
| Global | first load, cold start, offline, document not found, health failure |

## 10. Copy
Plain verbs, sentence case, active voice, buttons say what happens. Upload contract. Ask. Ask across 3 documents. Compare versions. Open in document. Copy quote.
Errors say what happened and what to do next. No apologies, no jargon like "chunk" or "offset", say "section". Never say "verified" unless our code checked it.
Meta text is separate columns or short natural text, not dot-joined strings. No em dashes in user-facing text.

## 11. Accessibility
Visible focus ring (indigo, 2px). Everything keyboard operable: tabs, table rows, flags, hovercards (open on focus), stepper, desk controls, floating bar.
Color is never the only signal: icon and label on every status, dashed border on unverified flags. Check contrast of every token pair, especially muted on sunken and the
amber and rose pairs. `aria-live="polite"` for "Quote 2 verified" and progress. Honour reduced motion.

## 12. Revamp build order (visual only, logic untouched)
R1 tokens, fonts, top bar and routes. R2 Library table, upload, floating bar. R3 Ask page: exchange, composer, chats rail. R4 flags, status bar, hovercard,
margin evidence. R5 Reading desk and the Spine. R6 Compare screens and change map. R7 states, copy, accessibility, screenshots. One commit group per step,
tests green after each, screenshot review after R1, R3 and R5.

## 13. QA checklist
- [ ] Tokens only, no stray hex values or default Tailwind colors
- [ ] No card inside a card, no empty panel, no raw "Loading" or "No text available"
- [ ] No dot-joined meta strings, no ALL-CAPS labels, no arrows on buttons
- [ ] Spine implemented once and reused in coverage, sources, desk, and compare
- [ ] Every state in section 9 for the area was seen
- [ ] Looked at 1440, 1280, and 1000 wide, no overflow on long file names
- [ ] Keyboard path works, focus visible, reduced motion respected
- [ ] Removed one decoration that did not earn its place
- [ ] Screenshots saved for the README
