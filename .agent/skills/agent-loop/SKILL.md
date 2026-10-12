---
name: agent-loop
description: Use when building Part C, the agentic document research mode with tools, a capped multi-round loop, live progress, and handling of malformed tool calls. Final answers still go through quote verification.
---

# Agent loop (Part C, Option 2)

## Tools (zod schemas, in `src/lib/agent/schemas.ts`)
```ts
search_document: { query: string (1..200), top_k?: int 1..10 (default 5), doc_id?: string }
get_section:     { ref?: string, chunk_id?: string, doc_id?: string }   // at least one of ref or chunk_id
list_clauses:    { doc_id?: string }
```
- `search_document`: BM25 over chunks, returns `[{chunk_id, doc_id, clause_ref, heading, snippet}]`.
- `get_section`: returns the full text of the chunk or clause, with its ids.
- `list_clauses`: returns the clause outline `[{ref, heading, chunk_id}]`.
In multi-doc chats, `doc_id` is one of the selected docs. Any other id is an invalid argument.

## Loop
```
state: rounds=0, toolCalls=0, consecutiveInvalid=0, readChunkIds=Set, trace=[]
while rounds < MAX_AGENT_ROUNDS and toolCalls < MAX_AGENT_TOOL_CALLS and tokensUsed < TOKEN_BUDGET:
  call the model with the tool definitions, streaming
  if it returns final text: break
  for each tool call:
     toolCalls++
     validate -> if invalid: result = structured error, consecutiveInvalid++
                 else run tool, consecutiveInvalid = 0, add returned chunk ids to readChunkIds
     emit progress event, append tool result to messages
  rounds++
  if consecutiveInvalid >= 3: abort with honest partial answer
if no final answer yet: make one last model call WITHOUT tools and with a notice
  "Research was limited. Answer with what you have and say that coverage is partial."
```
Defaults: `MAX_AGENT_ROUNDS=6`, `MAX_AGENT_TOOL_CALLS=12`, plus a per-request token budget. All from env with those defaults.

## Handling bad calls (never throw, never crash the request)
- Unknown tool name: `{"error":"unknown_tool","available":["search_document","get_section","list_clauses"]}`
- Missing or wrongly typed arguments: `{"error":"invalid_arguments","details":"query is required"}` from zod issues
- Nonsense values (top_k -5, query is a number, huge strings): rejected by zod, same structured error
- Unparseable JSON in arguments: `{"error":"malformed_arguments"}`
- A tool that throws internally: catch, return `{"error":"tool_failed"}`, log with `console.error`
Return these as the tool result so the model can correct itself. They count as rounds and are shown in the trace as a
neutral note ("That lookup was invalid, trying again"). Duplicate identical calls return a cached result with a note.

## Progress events (SSE `progress`)
Human readable and specific, emitted before and after each tool call:
- `Searching for "termination provisions"...` then `Found 5 matching sections`
- `Reading clause 14.2 (Termination for Cause)...`
- `Listing clauses in Contract A...`
- `That lookup was invalid, trying again`
- `Reached the research limit, writing the answer with what was found`
The UI renders these as a live list with spinner then tick, collapsing to "N lookups" when done. No bare spinner.

## Answer and verification
The system prompt requires: answer only from tool results, quote exactly with `<q id doc>` tags, say when nothing was found.
The final answer goes through the SAME stream parser and `verifyQuote` as every other mode, per the quote's own doc.
Quote verification runs against the full canonical text of that document, not just the chunk the agent read, but the
telemetry records whether the quote came from a chunk the agent actually read.

## Coverage
`mode: 'agent'`, `chunksRead = readChunkIds.size` per doc. `complete` is false unless the agent read every chunk (rare),
so absence claims are hedged: "I searched sections X, Y, Z and did not find ...". If the cap was hit, say so.

## Tests (`src/lib/agent/*.test.ts`), using a scripted fake model
1. Happy path: search, get_section, final answer, quotes verified.
2. Unknown tool: structured error returned, loop continues, no throw.
3. Missing args and nonsense args (top_k -5, query 42): rejected, loop continues.
4. Unparseable JSON arguments: handled.
5. Model that always calls tools: stops at `MAX_AGENT_ROUNDS` and produces a final answer with the limit notice.
6. Three invalid calls in a row: aborts with a partial answer.
7. Tool throws: caught, structured error, no crash.
8. Stop signal mid-loop: cancels cleanly and keeps the trace.
9. Final answer with a fake quote: marked unverified.
10. doc_id outside the selected docs: invalid argument.

## Model adapter and toggle (D-037, D-038)
Call the model through `callModel(messages, tools)` which returns `{ text } | { toolCalls }`. Native tool calls first, JSON action protocol as the
fallback (`{"action":"tool","name":...,"args":{...}}` or `{"action":"final"}`), parsed tolerantly. The same tests run against both paths.
Agent mode is switched on by the "Deep research" toggle in the composer and works in single and multi-document chats.
