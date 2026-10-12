/**
 * Deterministic Signal Extractor & Comparator (Phase 6, D-028, D-029)
 * Extracts numeric, financial, duration, date, and modal verbs from clauses.
 */

import type { Signal, SignalDiff } from "./types";

/**
 * Extracts deterministic legal signals from a clause's text.
 */
export function extractSignals(text: string): Signal[] {
  const signals: Signal[] = [];
  if (!text) return signals;

  // 1. Currencies & Financial Amounts
  // e.g. AED 100,000, $1,000,000, USD 50,000, 100,000 AED, AED 1M, €500
  const currencyRegex = /(?:(?:AED|USD|EUR|GBP|\$|€|£)\s*[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?(?:\s*(?:k|million|m|billion|b))?|[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?\s*(?:AED|USD|EUR|GBP|dirhams|dollars))/gi;
  let match: RegExpExecArray | null;
  while ((match = currencyRegex.exec(text)) !== null) {
    const raw = match[0].trim();
    signals.push({
      type: "amount",
      value: raw,
      raw,
      normalized: normalizeAmount(raw),
    });
  }

  // Pure large standalone numbers that look like financial caps (e.g. 100,000 or 1,000,000)
  const standAloneNumberRegex = /\b[0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]+)?\b/g;
  while ((match = standAloneNumberRegex.exec(text)) !== null) {
    const raw = match[0].trim();
    // Only add if not already captured in currency
    if (!signals.some((s) => s.raw.includes(raw))) {
      signals.push({
        type: "amount",
        value: raw,
        raw,
        normalized: normalizeAmount(raw),
      });
    }
  }

  // 2. Percentages (e.g. 15%, 2.5%, 10 percent)
  const pctRegex = /\b[0-9]+(?:\.[0-9]+)?\s*(?:%|percent)\b/gi;
  while ((match = pctRegex.exec(text)) !== null) {
    const raw = match[0].trim();
    signals.push({
      type: "percentage",
      value: raw,
      raw,
      normalized: raw.replace(/\s+/g, "").toLowerCase(),
    });
  }

  // 3. Durations / Time limits (e.g. 30 days, 15 business days, 12 months, 2 years)
  const durationRegex = /\b[0-9]+\s*(?:calendar\s+days?|business\s+days?|days?|weeks?|months?|years?)\b/gi;
  while ((match = durationRegex.exec(text)) !== null) {
    const raw = match[0].trim();
    signals.push({
      type: "duration",
      value: raw,
      raw,
      normalized: raw.toLowerCase().replace(/\s+/g, " "),
    });
  }

  // 4. Dates (e.g. 1 January 2025, 2025-10-12, 12/10/2026)
  const dateRegex = /\b(?:[0-9]{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{4})\b/gi;
  while ((match = dateRegex.exec(text)) !== null) {
    const raw = match[0].trim();
    signals.push({
      type: "date",
      value: raw,
      raw,
      normalized: raw.toLowerCase(),
    });
  }

  // 5. Modal verbs (obligations vs permissions)
  const modalRegex = /\b(shall\s+not|may\s+not|must\s+not|cannot|shall|must|may|will)\b/gi;
  while ((match = modalRegex.exec(text)) !== null) {
    const raw = match[0].trim().toLowerCase();
    signals.push({
      type: "modal",
      value: raw,
      raw: match[0].trim(),
      normalized: raw,
    });
  }

  return signals;
}

function normalizeAmount(amountStr: string): string {
  // Extract digits and evaluate multiplier
  const clean = amountStr.replace(/,/g, "").toLowerCase();
  const digitsMatch = clean.match(/[0-9]+(?:\.[0-9]+)?/);
  if (!digitsMatch) return amountStr;
  let val = parseFloat(digitsMatch[0]);
  if (clean.includes("million") || clean.endsWith("m")) {
    val *= 1000000;
  } else if (clean.includes("k")) {
    val *= 1000;
  } else if (clean.includes("billion") || clean.endsWith("b")) {
    val *= 1000000000;
  }
  return val.toString();
}

/**
 * Compares signals between two clauses and identifies substantive differences.
 */
export function compareSignals(signalsA: Signal[], signalsB: Signal[]): SignalDiff[] {
  const diffs: SignalDiff[] = [];

  // Group by type
  const amountsA = signalsA.filter((s) => s.type === "amount");
  const amountsB = signalsB.filter((s) => s.type === "amount");

  const durationsA = signalsA.filter((s) => s.type === "duration");
  const durationsB = signalsB.filter((s) => s.type === "duration");

  const datesA = signalsA.filter((s) => s.type === "date");
  const datesB = signalsB.filter((s) => s.type === "date");

  const modalsA = signalsA.filter((s) => s.type === "modal");
  const modalsB = signalsB.filter((s) => s.type === "modal");

  // Compare amounts
  for (let i = 0; i < Math.max(amountsA.length, amountsB.length); i++) {
    const a = amountsA[i];
    const b = amountsB[i];
    if (a && b) {
      if (a.normalized !== b.normalized) {
        const numA = parseFloat(a.normalized);
        const numB = parseFloat(b.normalized);
        const direction = !isNaN(numA) && !isNaN(numB)
          ? numB > numA ? "increased" : "decreased"
          : "changed";
        diffs.push({
          type: "amount",
          from: a.raw,
          to: b.raw,
          direction,
          description: `Amount changed from ${a.raw} to ${b.raw} (${direction})`,
        });
      }
    } else if (a && !b) {
      diffs.push({
        type: "amount",
        from: a.raw,
        direction: "removed",
        description: `Amount ${a.raw} was removed`,
      });
    } else if (!a && b) {
      diffs.push({
        type: "amount",
        to: b.raw,
        direction: "added",
        description: `Amount ${b.raw} was added`,
      });
    }
  }

  // Compare durations
  for (let i = 0; i < Math.max(durationsA.length, durationsB.length); i++) {
    const a = durationsA[i];
    const b = durationsB[i];
    if (a && b && a.normalized !== b.normalized) {
      diffs.push({
        type: "duration",
        from: a.raw,
        to: b.raw,
        direction: "changed",
        description: `Period/duration changed from ${a.raw} to ${b.raw}`,
      });
    } else if (a && !b) {
      diffs.push({
        type: "duration",
        from: a.raw,
        direction: "removed",
        description: `Duration ${a.raw} was removed`,
      });
    } else if (!a && b) {
      diffs.push({
        type: "duration",
        to: b.raw,
        direction: "added",
        description: `Duration ${b.raw} was added`,
      });
    }
  }

  // Compare dates
  for (let i = 0; i < Math.max(datesA.length, datesB.length); i++) {
    const a = datesA[i];
    const b = datesB[i];
    if (a && b && a.normalized !== b.normalized) {
      diffs.push({
        type: "date",
        from: a.raw,
        to: b.raw,
        direction: "changed",
        description: `Date changed from ${a.raw} to ${b.raw}`,
      });
    }
  }

  // Compare primary modal verb shift (e.g. may -> shall, shall -> may)
  const primaryA = modalsA[0];
  const primaryB = modalsB[0];
  if (primaryA && primaryB && primaryA.normalized !== primaryB.normalized) {
    diffs.push({
      type: "modal",
      from: primaryA.raw,
      to: primaryB.raw,
      direction: "changed",
      description: `Obligation shifted from '${primaryA.raw}' to '${primaryB.raw}'`,
    });
  }

  return diffs;
}
