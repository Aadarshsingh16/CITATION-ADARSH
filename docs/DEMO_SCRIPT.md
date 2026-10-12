# Demo script (target 4:30, hard limit 5:00)

Record on the deployed app, not localhost. Use the sample contracts so everything is repeatable. Say plainly what does not work.

| Time | Show | Say |
|---|---|---|
| 0:00 | Library, one line of what it is | "Contract analyser: answers only from the document, every answer backed by quotes our code verifies." |
| 0:15 | Upload a text PDF, show status moving through stages and page progress. Then upload a scanned PDF and a .txt | "Scanned files are rejected with an explanation, not saved as empty documents." |
| 0:45 | Ask a question. Quotes appear with verified badges | "The model's quote is only marked verified after we find it in the text ourselves." |
| 1:10 | Ask something not in the contract | "It says not found instead of inventing." |
| 1:20 | Start a long answer and press Stop | "Stop keeps what was written and the quotes already verified." |
| 1:35 | Show the verifier catching a fake: use the dev panel counters or a prepared question that makes the model paraphrase | "Unverified quotes are marked, never shown as genuine." |
| 1:55 | Large document: ask "Is there a termination for convenience clause?" Show section progress and the coverage label | "On long files it reads every section for existence questions. If it read only part, it says so." |
| 2:30 | Click a quote: real PDF page opens and highlights. Then a repeated quote (counter) and a cross-page quote | "Mapped onto the rendered page, not just our text view." |
| 3:00 | Select three documents, ask a comparison question | "Each quote is verified against its own document." |
| 3:25 | Comparison: sample pair, filter to High, open the cap change | "A cap moving from AED 100,000 to AED 1,000,000 is high. A rewording is cosmetic." |
| 3:55 | Part C: Deep research on, show live steps. Then the limit and a bad tool call from the test | "Hard cap on rounds, invalid tool calls are handled without crashing." |
| 4:30 | What does not work yet, one honest sentence each, plus eval numbers | "Here is what is missing and what I would do next." |

Rehearse once, cut anything that is not on the list.
