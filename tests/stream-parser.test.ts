import assert from "node:assert";
import { StreamTagParser, parseMessageContent, ParsedQuoteTag } from "../src/lib/llm/stream-parser";

console.log("=== Running Stream Tag Parser Unit Tests ===");

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err);
    failed++;
  }
}

// 1. Plain text without tags
test("1. Plain text streams through unchanged without tags", () => {
  let emittedText = "";
  const parser = new StreamTagParser({
    onText: (t) => { emittedText += t; },
  });

  parser.feed("Hello world! ");
  parser.feed("This is a test of contract analysis.");
  parser.end();

  assert.strictEqual(emittedText, "Hello world! This is a test of contract analysis.");
  assert.strictEqual(parser.getCleanText(), "Hello world! This is a test of contract analysis.");
  assert.strictEqual(parser.getCompletedQuotes().length, 0);
  assert.strictEqual(parser.getDroppedCount(), 0);
});

// 2. Simple quote in one piece
test("2. Quote in single chunk parses and emits onQuoteClose", () => {
  const closedQuotes: ParsedQuoteTag[] = [];
  let emittedText = "";

  const parser = new StreamTagParser({
    onText: (t) => { emittedText += t; },
    onQuoteClose: (q) => { closedQuotes.push(q); },
  });

  parser.feed('According to clause 1, <q id="1" doc="D1">The Company shall pay within 30 days</q>, fees apply.');
  parser.end();

  assert.strictEqual(closedQuotes.length, 1);
  assert.strictEqual(closedQuotes[0].localId, "1");
  assert.strictEqual(closedQuotes[0].docId, "D1");
  assert.strictEqual(closedQuotes[0].text, "The Company shall pay within 30 days");
  assert.strictEqual(
    emittedText,
    "According to clause 1, The Company shall pay within 30 days, fees apply."
  );
  assert.strictEqual(parser.getCleanText(), emittedText);
  assert.strictEqual(parser.getDroppedCount(), 0);
});

// 3. Tag split across multiple chunks
test("3. Tag split across multiple token chunks parses perfectly", () => {
  const closedQuotes: ParsedQuoteTag[] = [];
  let emittedText = "";

  const parser = new StreamTagParser({
    onText: (t) => { emittedText += t; },
    onQuoteClose: (q) => { closedQuotes.push(q); },
  });

  // Simulating small LLM token chunks
  const tokens = [
    "Under Section 4, ",
    "<",
    "q id=\"",
    "2\" ",
    "doc=\"D2\">",
    "Either party may ",
    "terminate upon ",
    "written notice",
    "</",
    "q>",
    " at any time.",
  ];

  for (const token of tokens) {
    parser.feed(token);
  }
  parser.end();

  assert.strictEqual(closedQuotes.length, 1);
  assert.strictEqual(closedQuotes[0].localId, "2");
  assert.strictEqual(closedQuotes[0].docId, "D2");
  assert.strictEqual(closedQuotes[0].text, "Either party may terminate upon written notice");
  assert.strictEqual(
    emittedText,
    "Under Section 4, Either party may terminate upon written notice at any time."
  );
  assert.strictEqual(parser.getDroppedCount(), 0);
});

// 4. Attribute variations (order, quotes, unquoted)
test("4. Attribute variations (reversed order, single quotes, unquoted) are handled", () => {
  const closedQuotes: ParsedQuoteTag[] = [];
  const parser = new StreamTagParser({
    onQuoteClose: (q) => { closedQuotes.push(q); },
  });

  parser.feed("<q doc='D3' id='10'>single quote attributes</q> ");
  parser.feed("<q id=20 doc=D4>unquoted attributes</q> ");
  parser.feed("<q id=\"30\">missing doc uses default</q>");
  parser.end();

  assert.strictEqual(closedQuotes.length, 3);
  assert.strictEqual(closedQuotes[0].localId, "10");
  assert.strictEqual(closedQuotes[0].docId, "D3");

  assert.strictEqual(closedQuotes[1].localId, "20");
  assert.strictEqual(closedQuotes[1].docId, "D4");

  assert.strictEqual(closedQuotes[2].localId, "30");
  assert.strictEqual(closedQuotes[2].docId, "D1"); // default
});

// 5. Unclosed tag dropped on stream end or Stop (Acceptance test A7, D-012)
test("5. Unclosed tag dropped at stream end (Stop mid-stream), partial text kept", () => {
  const closedQuotes: ParsedQuoteTag[] = [];
  let emittedText = "";

  const parser = new StreamTagParser({
    onText: (t) => { emittedText += t; },
    onQuoteClose: (q) => { closedQuotes.push(q); },
  });

  parser.feed('Here is quote 1: <q id="1" doc="D1">first quote completed</q>. ');
  parser.feed('And then user clicked Stop mid-way through <q id="2" doc="D1">unclosed partial text');
  // Stream ends abruptly (Stop button pressed)
  parser.end();

  // Completed quote 1 survives!
  assert.strictEqual(closedQuotes.length, 1);
  assert.strictEqual(closedQuotes[0].localId, "1");

  // Unclosed quote 2 is dropped as a verified quote
  assert.strictEqual(parser.getCompletedQuotes().length, 1);
  assert.strictEqual(parser.getDroppedCount(), 1);

  // But the partial text survives in the clean prose!
  assert.ok(emittedText.includes("first quote completed"));
  assert.ok(emittedText.includes("unclosed partial text"));
  assert.ok(!emittedText.includes("<q"));
});

// 6. Quote naming a doc id not sent is dropped and counted (D-015, SKILL.md)
test("6. Quote naming unallowed docId is dropped and counted", () => {
  const closedQuotes: ParsedQuoteTag[] = [];
  let droppedTag = "";

  const parser = new StreamTagParser({
    allowedDocIds: ["D1", "D2"],
    onQuoteClose: (q) => { closedQuotes.push(q); },
    onQuoteDropped: (reason, tag) => { droppedTag = tag; },
  });

  parser.feed('<q id="1" doc="D999">Text citing non-existent doc</q>');
  parser.end();

  assert.strictEqual(closedQuotes.length, 0);
  assert.strictEqual(parser.getDroppedCount(), 1);
  assert.ok(droppedTag.includes("D999"));
  // Text remains as plain prose
  assert.strictEqual(parser.getCleanText(), "Text citing non-existent doc");
});

// 7. Malformed unclosed nested tag drops first, continues second
test("7. Malformed unclosed nested tag recovers gracefully", () => {
  const closedQuotes: ParsedQuoteTag[] = [];
  const parser = new StreamTagParser({
    onQuoteClose: (q) => { closedQuotes.push(q); },
  });

  parser.feed('Start <q id="1" doc="D1">forgot to close tag <q id="2" doc="D1">second quote</q> done.');
  parser.end();

  assert.strictEqual(closedQuotes.length, 1);
  assert.strictEqual(closedQuotes[0].localId, "2");
  assert.strictEqual(closedQuotes[0].text, "second quote");
  assert.strictEqual(parser.getDroppedCount(), 1); // tag 1 dropped
  assert.ok(parser.getCleanText().includes("forgot to close tag"));
});

// 8. parseMessageContent helper splits prose and quotes into segments
test("8. parseMessageContent splits message into structured segments", () => {
  const raw = 'The agreement states <q id="1" doc="D1">Confidentiality lasts 5 years</q>. In addition, <q id="2" doc="D1">Governing law is UAE</q>.';
  const result = parseMessageContent(raw, ["D1"]);

  assert.strictEqual(result.quotes.length, 2);
  assert.strictEqual(result.segments.length, 5);

  assert.strictEqual(result.segments[0].type, "text");
  assert.strictEqual((result.segments[0] as any).text, "The agreement states ");

  assert.strictEqual(result.segments[1].type, "quote");
  assert.strictEqual((result.segments[1] as any).localId, "1");
  assert.strictEqual((result.segments[1] as any).text, "Confidentiality lasts 5 years");

  assert.strictEqual(result.segments[2].type, "text");
  assert.strictEqual((result.segments[2] as any).text, ". In addition, ");

  assert.strictEqual(result.segments[3].type, "quote");
  assert.strictEqual((result.segments[3] as any).localId, "2");
  assert.strictEqual((result.segments[3] as any).text, "Governing law is UAE");

  assert.strictEqual(result.cleanText, "The agreement states Confidentiality lasts 5 years. In addition, Governing law is UAE.");
});

console.log("\n========================================");
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("========================================");

if (failed > 0) process.exit(1);
