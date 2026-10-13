/**
 * Rate Limiting and Global Token Ceiling (D-039)
 * Protects public deployment and API keys with per-IP throttling and daily usage limits.
 */

interface IPRateBucket {
  tokens: number;
  lastRefill: number;
}

const ipBuckets = new Map<string, IPRateBucket>();
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_PER_MINUTE || "60", 10);
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

// Daily Token Ceiling
let dailyTokensUsed = 0;
let currentDay = new Date().toISOString().slice(0, 10);
const DAILY_TOKEN_CEILING = parseInt(process.env.DAILY_TOKEN_CEILING || "500000", 10);

/**
 * Checks per-IP rate limit using a token bucket algorithm.
 */
export function checkRateLimit(ip: string = "anonymous"): {
  allowed: boolean;
  retryAfterSec?: number;
  reason?: string;
} {
  const now = Date.now();
  let bucket = ipBuckets.get(ip);

  if (!bucket) {
    bucket = { tokens: RATE_LIMIT_MAX, lastRefill: now };
    ipBuckets.set(ip, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  if (elapsed > RATE_LIMIT_WINDOW_MS) {
    bucket.tokens = RATE_LIMIT_MAX;
    bucket.lastRefill = now;
  } else {
    const refillTokens = (elapsed / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_MAX;
    bucket.tokens = Math.min(RATE_LIMIT_MAX, bucket.tokens + refillTokens);
    bucket.lastRefill = now;
  }

  if (bucket.tokens < 1) {
    const retryAfterSec = Math.ceil((RATE_LIMIT_WINDOW_MS - elapsed) / 1000);
    return {
      allowed: false,
      retryAfterSec: Math.max(1, retryAfterSec),
      reason: `Rate limit reached (${RATE_LIMIT_MAX} requests/minute). Please try again in ${retryAfterSec}s.`,
    };
  }

  bucket.tokens -= 1;
  return { allowed: true };
}

/**
 * Checks and records global daily token usage against the ceiling.
 */
export function checkDailyTokenCeiling(estimatedTokens: number = 0): {
  allowed: boolean;
  remaining: number;
  reason?: string;
} {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== currentDay) {
    currentDay = today;
    dailyTokensUsed = 0;
  }

  const remaining = Math.max(0, DAILY_TOKEN_CEILING - dailyTokensUsed);

  if (dailyTokensUsed + estimatedTokens > DAILY_TOKEN_CEILING) {
    return {
      allowed: false,
      remaining,
      reason: `Global daily token ceiling reached (${DAILY_TOKEN_CEILING.toLocaleString()} tokens). Please return tomorrow or increase DAILY_TOKEN_CEILING in environment.`,
    };
  }

  return { allowed: true, remaining };
}

/**
 * Records tokens used after an LLM call or generation session.
 */
export function recordTokenUsage(tokens: number): void {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== currentDay) {
    currentDay = today;
    dailyTokensUsed = 0;
  }
  dailyTokensUsed += Math.max(0, tokens);
}
