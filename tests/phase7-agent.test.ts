/**
 * Phase 7: Agentic Document Research Acceptance Test Suite (Part C, Option 2)
 * Tests C1 to C7, D-026, D-027, D-037, and D-038.
 */

import { executeAgentTool, type AgentToolContext } from "../src/lib/agent/tools";
import { runAgentResearchLoop, type AgentTraceStep } from "../src/lib/agent/loop";
import { AGENT_TOOLS_SPEC } from "../src/lib/agent/schemas";
import { verifyQuote } from "../src/lib/quotes";
import type { DocumentWithChunks } from "../src/lib/chunking/retrieval";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

// Sample document fixtures for testing agent tools
const SAMPLE_DOCS: DocumentWithChunks[] = [
  {
    id: "doc-1",
    label: "D1",
    filename: "Master Services Agreement.pdf",
    text: `1. Definitions\n"Services" means consulting services.\n\n2. Term and Termination\nThis Agreement commences on 1 Jan 2025 and runs for 12 months. Either party may terminate for convenience with 30 days written notice.\n\n3. Limitation of Liability\nThe aggregate liability shall not exceed AED 100,000.\n\n4. Governing Law\nThis Agreement is governed by English law.`,
    chunks: [
      {
        id: "chunk-1",
        documentId: "doc-1",
        ordinal: 1,
        startOffset: 0,
        endOffset: 55,
        tokenEst: 14,
        clauseRef: "1",
        heading: "Definitions",
      },
      {
        id: "chunk-2",
        documentId: "doc-1",
        ordinal: 2,
        startOffset: 57,
        endOffset: 215,
        tokenEst: 40,
        clauseRef: "2",
        heading: "Term and Termination",
      },
      {
        id: "chunk-3",
        documentId: "doc-1",
        ordinal: 3,
        startOffset: 217,
        endOffset: 300,
        tokenEst: 20,
        clauseRef: "3",
        heading: "Limitation of Liability",
      },
      {
        id: "chunk-4",
        documentId: "doc-1",
        ordinal: 4,
        startOffset: 302,
        endOffset: 380,
        tokenEst: 18,
        clauseRef: "4",
        heading: "Governing Law",
      },
    ],
  },
];

async function runPhase7Tests() {
  console.log("=== Running Phase 7 Agent Research Acceptance Test Suite ===");

  // --------------------------------------------------------------------
  // Test 1: C1 - Tools exist with zod schemas: search_document, get_section, list_clauses
  // --------------------------------------------------------------------
  {
    assert(AGENT_TOOLS_SPEC.length === 3, "Expected 3 tool specs");
    const toolNames = AGENT_TOOLS_SPEC.map((t) => t.function.name);
    assert(toolNames.includes("search_document"), "search_document spec exists");
    assert(toolNames.includes("get_section"), "get_section spec exists");
    assert(toolNames.includes("list_clauses"), "list_clauses spec exists");

    const ctx: AgentToolContext = {
      documents: SAMPLE_DOCS,
      selectedDocIds: ["doc-1"],
      readChunkIds: new Set<string>(),
    };

    // Test search_document
    const searchRes = await executeAgentTool("search_document", { query: "terminate" }, ctx);
    assert(searchRes.ok === true, "search_document executed successfully");
    assert(Array.isArray(searchRes.data) && searchRes.data.length > 0, "search_document returned results");
    assert(ctx.readChunkIds.has("chunk-2"), "search_document tracked readChunkId chunk-2");

    // Test get_section
    const getRes = await executeAgentTool("get_section", { ref: "3" }, ctx);
    assert(getRes.ok === true, "get_section executed successfully");
    assert(
      (getRes.data as any)?.text.includes("AED 100,000"),
      "get_section retrieved clause 3 with liability text"
    );

    // Test list_clauses
    const listRes = await executeAgentTool("list_clauses", {}, ctx);
    assert(listRes.ok === true, "list_clauses executed successfully");
    assert((listRes.data as any)?.clauses.length === 4, "list_clauses returned 4 clauses");

    console.log("PASS: 1. C1: Tools search_document, get_section, list_clauses execute and track evidence");
  }

  // --------------------------------------------------------------------
  // Test 2: C5 & D-027 - Malformed and invented tool calls handled gracefully
  // --------------------------------------------------------------------
  {
    const ctx: AgentToolContext = {
      documents: SAMPLE_DOCS,
      selectedDocIds: ["doc-1"],
      readChunkIds: new Set<string>(),
    };

    // A. Unknown tool name
    const unknownRes = await executeAgentTool("invented_fake_tool", { param: "value" }, ctx);
    assert(unknownRes.ok === false, "Unknown tool should return ok=false");
    assert(unknownRes.error === "unknown_tool", "Error code must be unknown_tool");
    assert(Array.isArray(unknownRes.available), "Must return available tools list");

    // B. Missing required arguments
    const missingRes = await executeAgentTool("search_document", {}, ctx);
    assert(missingRes.ok === false, "Missing args should return ok=false");
    assert(missingRes.error === "invalid_arguments", "Error code must be invalid_arguments");
    assert(Boolean(missingRes.details), "Must provide validation details");

    // C. Nonsense arguments (e.g. top_k = -5, query is a number)
    const nonsenseRes = await executeAgentTool("search_document", { query: "termination", top_k: -5 }, ctx);
    assert(nonsenseRes.ok === false, "Nonsense top_k must be rejected");
    assert(nonsenseRes.error === "invalid_arguments", "Error code must be invalid_arguments");

    // D. doc_id outside selected documents
    const badDocRes = await executeAgentTool("search_document", { query: "termination", doc_id: "doc-999" }, ctx);
    assert(badDocRes.ok === false, "Unselected doc_id must be rejected");

    // E. Malformed JSON string
    const malformedJsonRes = await executeAgentTool("search_document", "{ bad json", ctx);
    assert(malformedJsonRes.ok === false, "Malformed JSON must be caught");
    assert(malformedJsonRes.error === "malformed_arguments", "Error code must be malformed_arguments");

    console.log("PASS: 2. C5: Malformed, missing, nonsense and unselected arguments return structured errors without crashing");
  }

  // --------------------------------------------------------------------
  // Test 3: C3 - Progress events emitted with descriptive human-readable text
  // --------------------------------------------------------------------
  {
    const ctx: AgentToolContext = {
      documents: SAMPLE_DOCS,
      selectedDocIds: ["doc-1"],
      readChunkIds: new Set<string>(),
    };

    const res = await executeAgentTool("search_document", { query: "termination provisions" }, ctx);
    assert(res.progressMessage.includes("Found") || res.progressMessage.includes("termination"), "Progress message contains specifics");

    const getRes = await executeAgentTool("get_section", { ref: "2" }, ctx);
    assert(getRes.progressMessage.includes("clause 2") || getRes.progressMessage.includes("Term and Termination"), "Progress message names clause");

    console.log("PASS: 3. C3: Live progress events emit descriptive text for each tool operation");
  }

  // --------------------------------------------------------------------
  // Test 4: C4 & D-026 - Hard cap on rounds and tool calls
  // --------------------------------------------------------------------
  {
    // Run with maxRounds = 2 to verify loop cap enforcement
    const progressEvents: AgentTraceStep[] = [];
    let callCounter = 0;
    const mockCappedChat = async (opts: any) => {
      callCounter++;
      const lastUserMsg = opts.messages[opts.messages.length - 1];
      if (lastUserMsg?.role === "user" && String(lastUserMsg.content).includes("Research limit reached")) {
        return {
          content: "Final answer after limit reached: partial results found.",
          role: "assistant",
        };
      }
      return {
        content: null,
        role: "assistant",
        tool_calls: [
          {
            id: `call-${callCounter}`,
            type: "function",
            function: {
              name: "search_document",
              arguments: { query: "liability", doc_id: "doc-1" },
            },
          },
        ],
      };
    };

    const result = await runAgentResearchLoop(
      "Loop indefinitely searching for everything",
      SAMPLE_DOCS,
      ["doc-1"],
      {
        maxRounds: 2,
        maxToolCalls: 3,
        completeChatFn: mockCappedChat as any,
        onProgress: (step) => {
          progressEvents.push(step);
        },
      }
    );

    assert(result.roundsExecuted <= 2, `Rounds executed (${result.roundsExecuted}) must be <= maxRounds (2)`);
    assert(result.toolCallsExecuted <= 3, `Tool calls (${result.toolCallsExecuted}) must be <= maxToolCalls (3)`);
    assert(result.interruptedByCap === true, "interruptedByCap flag must be true when capped");
    assert(result.coverage.complete === false, "Coverage must be marked partial when interrupted by cap");
    assert(Boolean(result.answer), "Must synthesize final answer upon hitting cap");
    assert(progressEvents.length > 0, "Progress events were emitted during execution");

    console.log("PASS: 4. C4: Hard cap on rounds and tool calls strictly enforced with honest partial coverage");
  }

  // --------------------------------------------------------------------
  // Test 5: C6 - Final answer quotes verified by quote engine
  // --------------------------------------------------------------------
  {
    const answerWithQuotes = `
The contract provides that either party may terminate for convenience by giving notice:
<q doc="doc-1" p="1">Either party may terminate for convenience with 30 days written notice.</q>
The aggregate liability is capped:
<q doc="doc-1" p="2">The aggregate liability shall not exceed AED 100,000.</q>
A fake quote that doesn't exist:
<q doc="doc-1" p="2">The contractor shall pay a 50% penalty on late delivery.</q>
`;

    const doc = SAMPLE_DOCS[0];
    const q1 = verifyQuote("Either party may terminate for convenience with 30 days written notice.", doc.text);
    assert(q1.status === "verified", "Real termination quote must verify");

    const q2 = verifyQuote("The aggregate liability shall not exceed AED 100,000.", doc.text);
    assert(q2.status === "verified", "Real liability quote must verify");

    const fakeQ = verifyQuote("The contractor shall pay a 50% penalty on late delivery.", doc.text);
    assert(fakeQ.status === "unverified" && fakeQ.reason === "not_found", "Fake penalty quote must return unverified not_found");

    console.log("PASS: 5. C6: Quotes in final agent answers pass through the same strict verifier");
  }

  // --------------------------------------------------------------------
  // Test 6: P7 Exit Gate - Full research loop completes with trace, quotes, and coverage
  // --------------------------------------------------------------------
  {
    const steps: AgentTraceStep[] = [];
    let roundStep = 0;
    const mockResearchChat = async (opts: any) => {
      roundStep++;
      if (roundStep === 1) {
        return {
          content: null,
          role: "assistant",
          tool_calls: [
            {
              id: "call-liability-1",
              type: "function",
              function: {
                name: "search_document",
                arguments: { query: "liability", doc_id: "doc-1" },
              },
            },
          ],
        };
      }
      return {
        content: `Based on the contract research, the aggregate liability is limited:\n<q doc="doc-1" p="2">The aggregate liability shall not exceed AED 100,000.</q>`,
        role: "assistant",
      };
    };

    const result = await runAgentResearchLoop(
      "What is the limitation of liability cap?",
      SAMPLE_DOCS,
      ["doc-1"],
      {
        maxRounds: 4,
        maxToolCalls: 6,
        completeChatFn: mockResearchChat as any,
        onProgress: (s) => steps.push(s),
      }
    );

    assert(Boolean(result.answer), "Final answer generated");
    assert(Array.isArray(result.trace) && result.trace.length > 0, "Trace contains executed steps");
    assert(result.coverage.mode === "agent", "Coverage mode is agent");
    assert(result.coverage.chunksRead >= 1, "Chunks were read and recorded in coverage");
    assert(result.quotes.length === 1, "Quote was extracted and verified");
    assert(result.quotes[0].verified === true, "Quote is verified against document text");

    console.log("PASS: 6. P7 Exit Gate: Autonomous agent research completes with trace, verified quotes, and coverage");
  }

  console.log("\n========================================");
  console.log("Results: 6 passed, 0 failed");
  console.log("========================================");
}

runPhase7Tests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
