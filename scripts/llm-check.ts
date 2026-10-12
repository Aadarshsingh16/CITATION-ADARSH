/**
 * Smoke tests and capability benchmarks for candidate LLMs (OpenAI-compatible).
 * Usage: npm run llm:check -- --model <id> [--model <id> ...]
 * Checks: streaming, abort, tool-call round trip, JSON-only, time to first token (ttft), total ms.
 * Never prints or logs the API key.
 */

import fs from "node:fs";
import path from "node:path";

function loadEnvFile(): void {
  for (const envFile of [".env.local", ".env"]) {
    const envPath = path.resolve(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).split("#")[0].trim().replace(/^["']|["']$/g, "");
          if (!process.env[key] && val) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

interface ModelCheckResult {
  model: string;
  streaming: boolean;
  abort: boolean;
  toolCall: boolean;
  jsonOnly: boolean;
  ttftMs: number;
  totalMs: number;
  error?: string;
}

function parseModelArgs(argv: string[]): string[] {
  const models: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--model" && i + 1 < argv.length) {
      models.push(argv[++i]);
    }
  }
  if (models.length === 0 && process.env.LLM_MODEL) {
    models.push(process.env.LLM_MODEL);
  }
  return models;
}

async function testModel(baseUrl: string, apiKey: string, model: string): Promise<ModelCheckResult> {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": "https://contract-analyser.local",
    "X-Title": "Contract Analyser",
  };

  const result: ModelCheckResult = {
    model,
    streaming: false,
    abort: false,
    toolCall: false,
    jsonOnly: false,
    ttftMs: 0,
    totalMs: 0,
  };

  // 1. Streaming + TTFT + Total ms
  try {
    const start = Date.now();
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        stream: true,
        messages: [{ role: "user", content: "Count from 1 to 5." }],
        max_tokens: 30,
        temperature: 0,
      }),
    });

    if (res.ok && res.body) {
      let firstChunk = true;
      let chunkCount = 0;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (firstChunk) {
          result.ttftMs = Date.now() - start;
          firstChunk = false;
        }
        const text = decoder.decode(value);
        if (text.includes("data:")) {
          chunkCount++;
        }
      }
      result.totalMs = Date.now() - start;
      result.streaming = chunkCount > 1;
    } else {
      const errText = await res.text();
      console.error(`Request failed (${res.status} ${res.statusText}):`, errText);
    }
  } catch (err: unknown) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  // 2. Abort check
  try {
    const controller = new AbortController();
    const abortReq = fetch(endpoint, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: true,
        messages: [{ role: "user", content: "Write a long essay." }],
        max_tokens: 200,
      }),
    });

    setTimeout(() => controller.abort(), 60);

    try {
      const res = await abortReq;
      if (res.body) {
        const reader = res.body.getReader();
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }
    } catch {
      // AbortError expected
    }

    if (controller.signal.aborted) {
      result.abort = true;
    }
  } catch {
    result.abort = false;
  }

  // 3. Tool-call round trip
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Look up clause 12." }],
        tools: [
          {
            type: "function",
            function: {
              name: "lookup_clause",
              description: "Look up a specific contract clause",
              parameters: {
                type: "object",
                properties: {
                  clause_id: { type: "string" },
                },
                required: ["clause_id"],
              },
            },
          },
        ],
        tool_choice: "auto",
        temperature: 0,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const calls = data.choices?.[0]?.message?.tool_calls;
      if (calls && calls.length > 0 && calls[0]?.function?.name === "lookup_clause") {
        result.toolCall = true;
      }
    }
  } catch {
    result.toolCall = false;
  }

  // 4. JSON-only format
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You output JSON only." },
          { role: "user", content: "Output JSON with key 'status' set to 'ok'." },
        ],
        temperature: 0,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === "object" && parsed.status === "ok") {
          result.jsonOnly = true;
        }
      }
    }
  } catch {
    result.jsonOnly = false;
  }

  return result;
}

async function main() {
  loadEnvFile();
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey || apiKey === "PUT_YOUR_OPENROUTER_API_KEY_HERE") {
    console.error("LLM_API_KEY is not set");
    process.exit(1);
  }

  const baseUrl = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
  const models = parseModelArgs(process.argv.slice(2));

  if (models.length === 0) {
    console.error("No model specified. Use --model <id> or set LLM_MODEL in environment.");
    process.exit(1);
  }

  console.log(`Running llm:check against ${models.length} model(s)...`);

  const results: ModelCheckResult[] = [];
  let allPassed = true;

  for (const model of models) {
    const res = await testModel(baseUrl, apiKey, model);
    results.push(res);
    const passed = res.streaming && res.abort && res.toolCall && res.jsonOnly;
    if (!passed) {
      allPassed = false;
    }
  }

  // Print results table
  console.log("\n| model | streaming | abort | tool-call round trip | JSON-only | time to first token | total ms |");
  console.log("|---|---|---|---|---|---|---|");
  for (const r of results) {
    const s = r.streaming ? "PASS" : "FAIL";
    const a = r.abort ? "PASS" : "FAIL";
    const tc = r.toolCall ? "PASS" : "FAIL";
    const j = r.jsonOnly ? "PASS" : "FAIL";
    const ttft = r.ttftMs ? `${r.ttftMs}ms` : "n/a";
    const total = r.totalMs ? `${r.totalMs}ms` : "n/a";
    console.log(`| ${r.model} | ${s} | ${a} | ${tc} | ${j} | ${ttft} | ${total} |`);
  }

  if (!allPassed) {
    console.error("\nOne or more model checks failed.");
    process.exit(1);
  }

  console.log("\nAll model checks passed.");
}

main().catch((err) => {
  console.error("Unexpected error in llm:check:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
