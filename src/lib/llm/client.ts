/**
 * OpenAI-compatible LLM client configured strictly from environment variables.
 * Rule 1: Read LLM_BASE_URL, LLM_API_KEY, LLM_MODEL from the environment only.
 * Rule 10: LLM access only through src/lib/llm/client.ts.
 */

import { buildQuoteRepairPrompt } from "./prompts";

export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  fastModel: string;
  contextBudget: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamChatOptions {
  messages: ChatMessage[];
  signal?: AbortSignal;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export function getLLMConfig(): LLMConfig {
  const baseUrl = process.env.LLM_BASE_URL || "";
  const apiKey = process.env.LLM_API_KEY || "";
  const model = process.env.LLM_MODEL || "";
  const fastModel = process.env.LLM_FAST_MODEL || model;
  const contextBudget = parseInt(process.env.LLM_CONTEXT_BUDGET || "60000", 10);

  return { baseUrl, apiKey, model, fastModel, contextBudget };
}

function ensureConfigured(config: LLMConfig): void {
  if (!config.baseUrl) {
    throw new Error("LLM_BASE_URL is not set in environment.");
  }
  if (!config.apiKey) {
    throw new Error("LLM_API_KEY is not set in environment.");
  }
  if (!config.model) {
    throw new Error("LLM_MODEL is not set in environment.");
  }
}

/**
 * Builds request headers with OpenRouter performance and prioritization metadata.
 */
function buildRequestHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": "https://contract-analyser.local",
    "X-Title": "Contract Analyser",
  };
}

/**
 * Stream completion from an OpenAI-compatible endpoint.
 * Yields text token deltas incrementally.
 */
export async function* streamChatCompletion(
  options: StreamChatOptions
): AsyncGenerator<string, void, unknown> {
  const config = getLLMConfig();
  ensureConfigured(config);

  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const model = options.model || config.model;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: buildRequestHeaders(config.apiKey),
    signal: options.signal,
    body: JSON.stringify({
      model,
      stream: true,
      messages: options.messages,
      temperature: options.temperature ?? 0,
      max_tokens: options.maxTokens ?? 2048,
    }),
  });

  if (!res.ok) {
    let errorDetail = "";
    try {
      const errJson = await res.json();
      errorDetail = errJson?.error?.message || JSON.stringify(errJson);
    } catch {
      errorDetail = await res.text();
    }
    throw new Error(`LLM request failed (${res.status}): ${errorDetail}`);
  }

  if (!res.body) {
    throw new Error("LLM response body is empty.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;

        const dataStr = trimmed.slice(5).trim();
        if (dataStr === "[DONE]") return;

        try {
          const parsed = JSON.parse(dataStr);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (delta) {
            yield delta;
          }
        } catch {
          // Incomplete or non-JSON SSE chunk; ignore and proceed
        }
      }
    }

    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith("data:")) {
        const dataStr = trimmed.slice(5).trim();
        if (dataStr !== "[DONE]") {
          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed?.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch {
            // ignore
          }
        }
      }
    }
  } catch (err: unknown) {
    if (options.signal?.aborted) {
      // Aborted intentionally by client; cleanly end generator
      return;
    }
    throw err;
  }
}

/**
 * Non-streaming completion from an OpenAI-compatible endpoint.
 */
export async function completeChat(
  options: StreamChatOptions
): Promise<{ content: string; totalTokens?: number }> {
  const config = getLLMConfig();
  ensureConfigured(config);

  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const model = options.model || config.model;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: buildRequestHeaders(config.apiKey),
    signal: options.signal,
    body: JSON.stringify({
      model,
      stream: false,
      messages: options.messages,
      temperature: options.temperature ?? 0,
      max_tokens: options.maxTokens ?? 2048,
    }),
  });

  if (!res.ok) {
    let errorDetail = "";
    try {
      const errJson = await res.json();
      errorDetail = errJson?.error?.message || JSON.stringify(errJson);
    } catch {
      errorDetail = await res.text();
    }
    throw new Error(`LLM request failed (${res.status}): ${errorDetail}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content || "";
  const totalTokens = json?.usage?.total_tokens;

  return { content, totalTokens };
}

/**
 * Single quote repair pass (D-036).
 * Re-requests verbatim wording for an unverified quote from the cited chunk.
 * Returns the candidate repaired quote text, or null if unrepairable.
 */
export async function repairQuote(options: {
  claim: string;
  attemptedQuote: string;
  chunkText: string;
  docId: string;
  localId: string;
  signal?: AbortSignal;
}): Promise<string | null> {
  const { system, user } = buildQuoteRepairPrompt(
    options.claim,
    options.attemptedQuote,
    options.chunkText,
    options.docId,
    options.localId
  );

  try {
    const res = await completeChat({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      signal: options.signal,
      temperature: 0,
      maxTokens: 256,
    });

    const reply = res.content.trim();
    if (reply.toUpperCase() === "NONE" || reply.toUpperCase().includes("NONE")) {
      return null;
    }

    const match = reply.match(/<\s*q[^>]*>([\s\S]*?)<\/\s*q\s*>/i);
    if (match && match[1]) {
      return match[1].trim();
    }

    return null;
  } catch {
    return null;
  }
}
