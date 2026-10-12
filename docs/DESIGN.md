# Design

The interface is part of the assessment. It must look finished and be usable for real work
without explanation. Desktop-first, usable on a laptop screen (1280px) and degrade sensibly
on tablet.

## Layout
Three regions in one workspace.
```
+-----------+--------------------------------+-----------------------+
| Library   | Chat                           | Document viewer       |
| (sidebar) | messages, quotes, input        | page text, highlights |
| 260px     | flexible                       | 420-520px, collapsible|
+-----------+--------------------------------+-----------------------+
```
- Sidebar: upload dropzone, document list with status chips, multi-select checkboxes for
  multi-doc questions, "Compare" action when exactly two are selected.
- Chat: header showing the active document(s) and coverage mode, message list, composer
  with Send / Stop.
- Viewer: opens when a quote is clicked or a document is opened. Shows document name,
  page indicator, occurrence counter (2 of 3) with previous and next.
- Comparison is its own full-width view with a change list on the left and side-by-side
  text on the right.

## Typography
- UI: Inter (or system sans fallback), 14px base, 1.5 line height.
- Document text and quotes: a serif (Source Serif 4 or Newsreader), 15px, 1.7 line height, so
  it reads like a contract rather than a console.
- Monospace only for ids and the dev telemetry panel.

## Colour tokens
```
--bg:            #fafaf9
--surface:       #ffffff
--border:        #e7e5e4
--text:          #1c1917
--text-muted:    #78716c
--accent:        #4f46e5   (primary actions, focus ring)
--verified:      #15803d on #f0fdf4
--unverified:    #b45309 on #fffbeb   (amber, never red)
--partial:       #1d4ed8 on #eff6ff   (coverage notice)
--highlight:     #fde68a  (active quote in the viewer)
--highlight-alt: #fef3c7  (other occurrences)
--danger:        #b91c1c on #fef2f2   (real errors only: failed upload, failed request)
```
Rule: quote verification states are guidance. They are never red. Red is reserved for
operations that actually failed.

Support dark mode through the same tokens if time allows. Not required.

## Components
- **DocumentCard**: filename, size, pages, status chip, delete menu.
- **StatusChip**: uploading, extracting, indexing, ready, rejected, failed.
- **Progress**: stage label plus determinate bar when pages are known ("Extracting page 42 of 150").
- **MessageBubble**: user and assistant, markdown-light rendering, streaming caret.
- **QuotePill**: numbered inline marker. States: pending (grey, subtle pulse), verified (green check),
  unverified (amber warning).
- **QuoteCard**: below the answer. Shows the quote in serif, doc name, page, status. Verified cards have
  "Open in document". Unverified cards show the reason in plain words and no open button.
- **CoverageBanner**: shown when coverage is not complete, e.g. "Read 31 of 48 sections. Statements that
  something is absent only apply to the parts read." Always visible on that message, not dismissible.
- **AgentTrace**: live list of steps ("Searching for termination provisions..."), each with a spinner
  then a tick, collapses to "5 lookups" when done.
- **ChangeRow** (comparison): kind icon, clause ref, significance badge, one-line summary.
- **SignificanceFilter**: segmented control (All, High, Medium, Low, Cosmetic) plus sort (significance, document order).
- **Toast / InlineError**: retry actions where relevant.

## Every state that must exist
Features are not done until each applicable state is built and seen.

| Area | States |
|---|---|
| Library | empty (with upload prompt), loading skeleton, populated, delete confirm, delete in progress |
| Upload | idle dropzone, drag-over, uploading with progress, extracting with page progress, indexing, ready, wrong file type, file too large, scanned PDF with no text (explains what that means and what to do), encrypted PDF, extraction failed with retry, partially unreadable pages warning |
| Chat | no document selected, empty chat with suggested questions, sending, streaming, stopped (labelled "Stopped"), error with retry, history loading, history empty |
| Quotes | pending, verified, unverified with reason (not found, too short, wrong document), dropped count in dev panel, quote with gaps |
| Coverage | full (subtle label), partial banner, unreadable pages note |
| Viewer | closed, loading, open, highlight active, multiple occurrences (counter), quote spanning pages, quote not locatable |
| Multi-doc | selection chips, per-quote doc label, a selected doc still processing is disabled with a hint |
| Comparison | pick two docs, running with progress, results, no differences found, filter yields nothing, failure with retry |
| Agent | step streaming, cap reached notice, tool error shown as a step note, final answer |

## Copy rules
- Say what happened and what to do next. "This PDF has no readable text. It looks like a scan. Upload a text-based
  version or run OCR first." Not "Error 422".
- Unverified quote reasons in plain words: "We could not find this wording in the document."
  "This wording appears in a different document than the one named."
- No em dashes in user-facing text.
- Never say "verified" for anything the code did not check.

## Accessibility basics
Visible focus rings, keyboard operable Send / Stop and quote opening, colour is never the only
signal (icons plus text on every status), sufficient contrast on the token pairs above.

---

# Additions (audit round 1)
- **Sample contracts**: empty library shows "Try with sample contracts" next to the upload dropzone.
- **Deep research toggle** in the composer with a short hint ("Lets the assistant look things up step by step").
- **Map-reduce progress**: "Reading section 12 of 48" with a determinate bar before the answer streams.
- **PDF viewer**: real page image with a highlight layer, page indicator, occurrence counter (2 of 3) with previous and next,
  notice when falling back to text view ("Showing extracted text for this page").
- **Chat history**: per-document list of conversations with "New chat". Separate "Multi-document" section in the sidebar.
- **Rejected uploads** are dismissible error cards in the library area (D-045), not library rows.
- **Comparison entry**: pick two library documents or upload two files directly on the comparison screen. Show both file names
  and which is "earlier" and "later" (swap control).
- **Limits and errors**: rate limit message ("You have reached the usage limit for now, try again in N minutes").
- **Interrupted processing**: document card shows "Processing was interrupted" with Retry.
- **Bilingual text**: text blocks use `dir="auto"` so Arabic renders right to left.
