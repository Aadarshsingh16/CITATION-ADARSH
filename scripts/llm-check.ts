/**
 * Smoke tests LLM configuration from environment variables (OpenAI-compatible).
 * Checks connectivity and basic completion to verify provider and model work.
 */
async function main() {
  const baseUrl = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;

  console.log("=== LLM Configuration Check ===");
  console.log(`Base URL: ${baseUrl || "(not set)"}`);
  console.log(`Model:    ${model || "(not set)"}`);
  console.log(`API Key:  ${apiKey ? "(set, " + apiKey.length + " chars)" : "(not set)"}`);

  if (!baseUrl || !apiKey || !model) {
    console.log("\n[NOTE] LLM environment variables are not set in current environment.");
    console.log("Set LLM_BASE_URL, LLM_API_KEY, and LLM_MODEL in .env.local to test a live model.");
    return;
  }

  const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  console.log(`\nPinging endpoint: ${endpoint}...`);

  try {
    const start = Date.now();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with the single word 'OK'." }],
        max_tokens: 10,
        temperature: 0,
      }),
    });

    const elapsed = Date.now() - start;
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[FAIL] HTTP ${res.status}: ${errText}`);
      process.exit(1);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    console.log(`[PASS] Received response in ${elapsed}ms: ${JSON.stringify(content)}`);
  } catch (err: unknown) {
    console.error(`[FAIL] Request error:`, err);
    process.exit(1);
  }
}

main();
