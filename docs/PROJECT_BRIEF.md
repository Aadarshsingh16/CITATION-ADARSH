# Project Brief: Contract Analyser

A web app for analysing legal contracts. A user uploads a PDF or DOCX, asks questions in a
chat, and gets answers drawn only from the document. Every answer is backed by exact quotes
that our own code has verified exist in the document. Clicking a quote opens the document,
scrolls to the passage and highlights it. Single user, no auth.

## How this will be judged
1. The deployed app, used live with the reviewer's own contracts and questions. This is the
   main basis. The deployed build must be the real, complete build.
2. Interface quality: finished look, clear loading, empty and error states.
3. Judgement: what we built, what we left out, why Part C option 2.
4. Documentation: README and demo video.
5. Counts against us: claiming something works when it does not, a committed API key, an app
   that only works on a small sample file.

Rule for this repo: nothing is marked done until it was run and observed working.

## Checklist with acceptance tests

### Part A: Core
| # | Requirement | Acceptance test |
|---|---|---|
| A1 | Accept PDF and DOCX, reject other types with a clear message | Upload .txt, .png, and an .exe renamed .pdf: each is rejected with a specific message |
| A2 | Extract and store text | Open stored doc, text matches source |
| A3 | Processing status always visible | Upload a 150-page PDF: status moves uploading, extracting, indexing, ready with visible progress |
| A4 | Scanned PDF with no text is reported, not saved as success | Upload an image-only PDF: user sees a clear "no readable text" message, doc is not listed as ready |
| A5 | Library: list, open, delete | Delete removes file, text, chunks, chats |
| A6 | Chat per document with streaming answers | Tokens appear progressively |
| A7 | Stop mid-answer keeps generated text | Click stop, partial text remains and is saved |
| A8 | Chat history saved per document and reopenable | Reload page, history is present |
| A9 | Every answer has verified quotes | Each quote is checked by code against the document text before being shown as verified |
| A10 | Unfound quote is never shown as genuine | Force the model to emit a fake quote: it is marked unverified or removed |
| A11 | Model-reported positions are never trusted | Corrupt reported offsets in a test: result unchanged |
| A12 | Whitespace tolerant matching | Quote with different line breaks and spacing still verifies |
| A13 | Answer not in document: say so | Ask about something absent: app says it is not found, no invention |
| A14 | 150-page contract works | Ask 5 varied questions on a 150-page file |
| A15 | Partial reading is never presented as complete | When coverage is partial, the answer and UI say so. No "clause does not exist" claims on partial coverage |

### Part B: Advanced
| # | Requirement | Acceptance test |
|---|---|---|
| B1 | Click quote opens doc, scrolls, highlights | Works in single-doc and multi-doc chats |
| B2 | Multi-line quote highlighted | Quote across 3 lines is fully highlighted |
| B3 | Quote crossing a page break highlighted | Both page fragments highlighted |
| B4 | Quote appearing more than once handled | Shows occurrence count, next/previous, prefers the cited chunk |
| B5 | Multi-document question | Select 3 docs, one question, comparative answer |
| B6 | Each quote labelled with its source doc | Doc name visible on every quote |
| B7 | Each quote verified against its own doc only | Quote from doc A attributed to doc B is flagged unverified |
| B8 | Version comparison at clause/paragraph level | Two versions of a contract produce a clause-level change list |
| B9 | Plain-language substantive summary | AED 100,000 to AED 1,000,000 is called out, pure rewording is not |
| B10 | Filter and sort by significance | UI controls work |

### Part C: Option 2, agentic document research
| # | Requirement | Acceptance test |
|---|---|---|
| C1 | Model calls tools: search_document, get_section, list_clauses | Visible tool trace for a question |
| C2 | Real multi-round loop | A question needing 3+ lookups completes |
| C3 | Live progress, not a spinner | "Searching for termination provisions..." streams in |
| C4 | Hard cap on rounds | Prompt that tempts looping stops at the cap with an honest message |
| C5 | Malformed or invented tool calls handled | Unknown tool, missing args, garbage params: request does not crash |
| C6 | Verified quotes still apply | Final answer quotes pass through the same verifier |

### Deliverables
- [ ] GitHub repo, no committed keys
- [ ] Deployed link, real build
- [ ] README: what it does, screenshots (upload, chat with verified quotes, citation highlighting, comparison), run locally, what is finished and what is not
- [ ] Demo video 3 to 5 min: upload, ask, verification, highlighted citation, comparison, Part C including what does not work
- [ ] Half-page note: quote verification and where it could fail, large documents, Part C choice and hardest part, what next

### Extras (only after everything above works)
Anonymise, semantic search, export, clause extraction, Arabic/RTL, resumable background jobs, voice input.

## Added acceptance tests (audit round 1)
| # | Requirement | Acceptance test |
|---|---|---|
| B1b | Highlight appears on the real rendered PDF page, not only in our own text view | Open a PDF quote: the page image is shown and the passage is highlighted on it |
| B5b | Comparative multi-doc answer, not separate lists | For a 3-doc question the answer is organised by topic with each document's position side by side. Eval checks that at least 2 doc labels appear per topic |
| B7b | Upload two versions straight from the comparison screen, or pick two from the library | Both paths work |
| B9b | Summary never invents values | Every amount, number and date in a summary appears in the compared texts. Test with a forced bad summary |
| C7 | "Deep research" is easy to find and use | Toggle visible in the composer, hint explains it |
| D1 | Deployed app survives a stranger | In a private window with a new 100+ page contract: upload, ask, highlight, compare all work. No dev data needed |
| D2 | Public URL cannot run up an unbounded bill | Rate limit message appears when exceeded, daily token ceiling enforced |
| D3 | Restart safety | Kill the server mid-ingestion: on restart the document shows failed with Retry, Retry completes |
| D4 | Sample contracts | One click loads the samples, every feature can be tried without the reviewer's own files |
