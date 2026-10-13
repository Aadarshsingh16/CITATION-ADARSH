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

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface StreamChatOptions {
  messages: ChatMessage[];
  signal?: AbortSignal;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
  tool_choice?: any;
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
 * Truncates and guards chat messages to prevent context boundary / token overflow errors.
 */
function boundMessagesToBudget(messages: ChatMessage[], budgetTokens: number): ChatMessage[] {
  const maxChars = Math.max(budgetTokens * 4, 8000);
  const totalChars = messages.reduce((acc, m) => acc + (m.content?.length || 0), 0);
  if (totalChars <= maxChars) return messages;

  const systemMsg = messages.find((m) => m.role === "system");
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");

  const result: ChatMessage[] = [];
  if (systemMsg) result.push(systemMsg);

  let currentChars = systemMsg ? (systemMsg.content?.length || 0) : 0;
  const otherMessages = messages.filter((m) => m !== systemMsg && m !== lastUserMsg);

  const keptOthers: ChatMessage[] = [];
  for (let i = otherMessages.length - 1; i >= 0; i--) {
    const msg = otherMessages[i];
    const msgLen = msg.content?.length || 0;
    const lastUserLen = lastUserMsg?.content?.length || 0;
    if (currentChars + msgLen + lastUserLen < maxChars) {
      keptOthers.unshift(msg);
      currentChars += msgLen;
    } else {
      break;
    }
  }

  result.push(...keptOthers);
  if (lastUserMsg && lastUserMsg !== systemMsg) {
    const userLen = lastUserMsg.content?.length || 0;
    const available = Math.max(maxChars - currentChars, 2000);
    if (userLen > available) {
      result.push({
        ...lastUserMsg,
        content: (lastUserMsg.content || "").slice(0, available) + "\n\n[...Context truncated to satisfy model token budget...]",
      });
    } else {
      result.push(lastUserMsg);
    }
  }

  return result;
}

/**
 * Executes fetch with exponential backoff on HTTP 429 / 503 / 529.
 */
async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 2): Promise<Response> {
  let attempt = 0;
  while (true) {
    try {
      const res = await fetch(url, init);
      if (res.ok || (res.status !== 429 && res.status !== 503 && res.status !== 529)) {
        return res;
      }
      if (attempt >= maxRetries) {
        return res;
      }
      attempt++;
      const retryAfter = res.headers.get("retry-after");
      const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.min(1000 * Math.pow(2, attempt), 4000);
      await new Promise((r) => setTimeout(r, delay));
    } catch (err: unknown) {
      if (init.signal?.aborted || attempt >= maxRetries) throw err;
      attempt++;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
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
  const boundedMessages = boundMessagesToBudget(options.messages, config.contextBudget);

  const res = await fetchWithRetry(endpoint, {
    method: "POST",
    headers: buildRequestHeaders(config.apiKey),
    signal: options.signal,
    body: JSON.stringify({
      model,
      stream: true,
      messages: boundedMessages,
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
): Promise<{ content: string; tool_calls?: ToolCall[]; totalTokens?: number }> {
  const config = getLLMConfig();
  ensureConfigured(config);

  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const model = options.model || config.model;
  const boundedMessages = boundMessagesToBudget(options.messages, config.contextBudget);

  const res = await fetchWithRetry(endpoint, {
    method: "POST",
    headers: buildRequestHeaders(config.apiKey),
    signal: options.signal,
    body: JSON.stringify({
      model,
      stream: false,
      messages: boundedMessages,
      temperature: options.temperature ?? 0,
      max_tokens: options.maxTokens ?? 2048,
      ...(options.tools && options.tools.length > 0
        ? { tools: options.tools, tool_choice: options.tool_choice ?? "auto" }
        : {}),
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
  const choiceMsg = json?.choices?.[0]?.message;
  const content = choiceMsg?.content || "";
  const tool_calls = choiceMsg?.tool_calls as ToolCall[] | undefined;
  const totalTokens = json?.usage?.total_tokens;

  return { content, tool_calls, totalTokens };
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
