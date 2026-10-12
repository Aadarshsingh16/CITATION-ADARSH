/**
 * OpenAI-compatible LLM client configured strictly from environment variables.
 * Rule 1: Read LLM_BASE_URL, LLM_API_KEY, LLM_MODEL from the environment only.
 * Rule 10: LLM access only through src/lib/llm/client.ts.
 */

export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  contextBudget: number;
}

export function getLLMConfig(): LLMConfig {
  const baseUrl = process.env.LLM_BASE_URL || "";
  const apiKey = process.env.LLM_API_KEY || "";
  const model = process.env.LLM_MODEL || "";
  const contextBudget = parseInt(process.env.LLM_CONTEXT_BUDGET || "60000", 10);

  return { baseUrl, apiKey, model, contextBudget };
}
