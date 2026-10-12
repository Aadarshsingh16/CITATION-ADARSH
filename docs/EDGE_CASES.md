# Edge Cases

For each case: expected behaviour, and the phase that handles it. Tick the box only after you saw it work.

## Quotes and matching
| Done | Case | Expected behaviour | Phase |
|---|---|---|---|
| [x] | Same quote text appears twice | Return all matches. Prefer the one inside the cited chunk, else first. Viewer shows "1 of N" with next/previous | P2, P4 |
| [x] | Quote spans a page break | Single match across the boundary. Highlight is split into one range per page | P2, P4 |
| [x] | Quote spans several lines | Whitespace-insensitive match. Highlight covers all lines | P2, P4 |
| [x] | Hyphenation at line end ("termi-\nnation") | Matches both the joined and the hyphen-kept variant | P2 |
| [x] | Curly vs straight quotes, en/em dashes | Normalised to the same form on both sides | P2 |
| [x] | Ligatures (fi, fl) | Expanded through NFKC | P2 |
| [x] | Extraction splits a word with a space | Whitespace removal makes it match | P2 |
| [x] | Quote is in a table | Table cell text appears in the canonical text in reading order. Quote that crosses cells may fail, shows unverified with a clear reason | P2 |
| [ ] | Repeated headers and footers on every page | Quote that includes a running header is not matched across pages unless the header is in the text. Consider stripping repeated lines at extraction and recording that | P1 |
| [x] | Quote shorter than 15 normalised chars | Unverified, reason `too_short` | P2 |
| [x] | Quote with ellipsis | Segments found in order within the window, labelled "verified with gaps". If any segment is missing, unverified | P2 |
| [x] | Quote matches mid-word in the original | Rejected by the word-boundary check | P2 |
| [x] | Model changes one word | Unverified. We do not rescue near matches | P2 |
| [x] | Model paraphrases but puts it in tags | Unverified, never shown as genuine | P2 |
| [x] | Model returns zero quotes | Answer is shown with a note "no supporting quote was provided". If the answer asserts facts, mark it as unsupported | P2 |
| [x] | Model emits malformed `<q>` tags or an unclosed tag | Parser tolerates, drops what it cannot parse, the answer text stays | P2 |
| [x] | Model cites a doc id that was not sent | Dropped and counted in telemetry | P2, P5 |
| [x] | Reported page or offset is wrong | Ignored. We locate the quote ourselves | P2 |
| [ ] | Quote not locatable in the viewer despite verified status | Show a notice rather than a silent no-op | P4 |

## Answers and honesty
| Done | Case | Expected behaviour | Phase |
|---|---|---|---|
| [x] | Answer is not in the document | Says it was not found, no invented clause, no fake quote | P2 |
| [ ] | Absence question with partial coverage | Hedged wording ("not found in the N of M sections read"), banner visible | P3 |
| [ ] | Absence question, map-reduce complete | May state absence, with coverage shown | P3 |
| [ ] | Document has unreadable pages | Coverage incomplete, note names the pages | P1, P3 |
| [ ] | One map call fails | Retry once, then partial coverage and stated | P3 |
| [x] | User stops mid-stream | Partial text saved, already-verified quotes kept, unclosed quote tag dropped, message marked Stopped | P2 |
| [x] | LLM error or timeout mid-stream | Partial text kept, error state with retry | P2 |
| [x] | Question is vague or off-topic | Short answer asking what to look for, no invented content | P2 |
| [x] | Prompt injection inside the contract text ("ignore previous instructions") | Document text is treated as data, delimited in the prompt, instructions ignored | P2 |

## Upload and ingestion
| Done | Case | Expected behaviour | Phase |
|---|---|---|---|
| [x] | Wrong extension (.txt, .png) | Rejected with specific message | P1 |
| [x] | Wrong content with right extension (.exe renamed .pdf) | Magic-byte check rejects it | P1 |
| [x] | Scanned PDF, no text | Rejected with `no_text_layer` and explanation, not listed as ready | P1 |
| [x] | PDF with some scanned pages | Accepted with warning, pages recorded as unreadable | P1 |
| [x] | Password-protected PDF | Rejected with `encrypted` | P1 |
| [x] | Corrupt file | Status failed with a readable reason and retry | P1 |
| [x] | Empty or tiny file | Rejected as having no usable text | P1 |
| [x] | Very large file or over page limit | Rejected with the limit stated | P1 |
| [x] | DOCX without real pages | Virtual sections, labelled "Section" | P1, P4 |
| [x] | DOCX with tables and lists | Text extracted in reading order, numbering preserved as text where available | P1 |
| [x] | Upload while another is processing | Both proceed, each with its own status | P1 |
| [x] | Browser closed during processing | Status recoverable on reload. Resumable jobs are an extra | P1 |
| [x] | Delete a document used in chats | Chats for that doc are removed, multi-doc chats show the doc as deleted | P1, P5 |
| [x] | Same file uploaded twice | Allowed, listed separately (or flagged as duplicate by hash, owner decision) | P1 |

## Multi-document
| Done | Case | Expected behaviour | Phase |
|---|---|---|---|
| [ ] | Same quote text exists in two documents | Verified against the document named in the tag only | P5 |
| [ ] | Quote exists only in a different selected doc | Unverified, reason `wrong_document` | P5 |
| [ ] | A selected doc is still processing or failed | Not selectable, hint explains why | P5 |
| [ ] | Documents differ greatly in size | Per-doc coverage shown | P5 |
| [ ] | Total size exceeds the budget | Per-document map-reduce, coverage per doc | P3, P5 |

## Comparison
| Done | Case | Expected behaviour | Phase |
|---|---|---|---|
| [ ] | Cap changes from AED 100,000 to AED 1,000,000 | Detected as numeric change, High significance, plain summary names both values | P6 |
| [ ] | Pure rewording, same meaning | Cosmetic or Low, summary says wording only | P6 |
| [ ] | Clause renumbered only | `moved`, not added plus removed | P6 |
| [ ] | Clause added or removed | Listed with its text, significance judged | P6 |
| [ ] | One clause split into two or two merged | Alignment shows best match plus the extra unit as added or removed, noted as restructure | P6 |
| [ ] | "shall" changed to "may", negation added | Modal and negation signals raise significance | P6 |
| [ ] | Date or duration changed (30 to 90 days) | Numeric signal, Medium or High | P6 |
| [ ] | Party name changed | Party signal raises significance | P6 |
| [ ] | Identical documents | "No differences found" state | P6 |
| [ ] | Documents unrelated | Warn that alignment confidence is low | P6 |
| [ ] | Very many changes | Pagination or virtualised list, filter by significance | P6 |

## Agent (Part C)
| Done | Case | Expected behaviour | Phase |
|---|---|---|---|
| [ ] | Unknown tool name | Structured error returned to model, round counted, trace note | P7 |
| [ ] | Missing required argument | Structured error naming the missing field | P7 |
| [ ] | Wrong types or nonsense values (top_k = -5, query = 42) | Rejected by zod, error returned, no crash | P7 |
| [ ] | Model calls the same tool repeatedly | Caps stop it. Duplicate calls return a cached result with a note | P7 |
| [ ] | Round cap reached | Forced final answer with "research was limited" notice and partial coverage | P7 |
| [ ] | Three invalid calls in a row | Loop aborts with an honest partial answer | P7 |
| [ ] | Tool returns nothing | Result says no matches, model may try a different query within the cap | P7 |
| [ ] | User presses Stop during tool calls | Loop cancels, trace and partial text kept | P7 |
| [ ] | Final answer contains an unverifiable quote | Same unverified treatment as any other mode | P7 |

## UI
| Done | Case | Expected behaviour | Phase |
|---|---|---|---|
| [ ] | Long streaming answer | Auto-scroll that stops when the user scrolls up | P2 |
| [ ] | Many quotes in one answer | Quote cards collapse after the first few with "show all" | P2 |
| [ ] | Narrow laptop screen | Viewer becomes an overlay panel | P4 |
| [ ] | Very long document in viewer | Virtualise or render pages lazily, scroll stays smooth | P4 |
| [ ] | Network drops | Clear error and retry, no lost user message | P2 |

---

# Additions (audit round 1)
| Done | Case | Expected behaviour | Phase |
|---|---|---|---|
| [ ] | pdf.js text-layer span count differs from stored item count | Fall back to canonical text view for that page and log it | P4 |
| [ ] | Highlight begins or ends in the middle of a text item | Item is split, only the matched characters are marked | P4 |
| [ ] | Quote spans two pages in the rendered PDF | Both pages highlighted, scroll goes to the first, counter treats it as one occurrence | P4 |
| [ ] | Rotated or multi-column PDF | Mapping still works because it is index-based, quote verification may fail if extraction order is odd, shown as unverified | P1, P4 |
| [ ] | Bilingual or Arabic PDF | Does not crash or reject. Arabic matching works when extraction is logical order, documented limitation when visual order | P1, P2 |
| [ ] | Cheap model paraphrases quotes frequently | Repair pass once, remaining stay unverified, eval reports fabrication and repair rates | P2 |
| [ ] | Provider does not support native tool calls | JSON action fallback, same agent tests pass | P0, P7 |
| [ ] | Question asks the model to invent a quote or ignore the document ("make up a clause") | Refuses to invent, answers from the document or says not found | P2 |
| [ ] | Prompt injection in the contract text | Treated as data, not instructions | P2 |
| [ ] | Server restart during ingestion | Document marked failed with Retry on next start | P1 |
| [ ] | Public URL abused or loop spends tokens | Rate limits and daily ceiling stop it with a friendly message | P1, P8 |
| [ ] | Host sleeps and the first request is slow | Loading state explains it, README notes it | P0, P8 |
| [ ] | Summary in comparison mentions a value not in the documents | Summary guard replaces it with a templated one | P6 |
| [ ] | Comparison inputs uploaded on the comparison screen are still processing | Wait with progress, then run | P6 |
| [ ] | Multi-doc answer lists documents separately instead of comparing | Prompt requires topic-by-topic structure, eval checks for at least two doc labels per topic | P5 |
| [ ] | Reviewer's long contract has unusual structure (no numbering, scanned appendix) | Paragraph chunking fallback, unreadable pages recorded, coverage banner | P1, P3 |
| [ ] | Map-reduce takes too long | Progress shown, concurrency tuned, user can Stop | P3 |
