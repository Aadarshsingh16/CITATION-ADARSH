/**
 * Clause Alignment Algorithm (Phase 6, D-028, B8)
 * Matches clauses between Document A and Document B.
 */

import { normalise } from "../quotes";
import type { Clause, ComparisonChangeType } from "./types";

export interface AlignedPair {
  type: ComparisonChangeType;
  clauseA?: Clause;
  clauseB?: Clause;
  similarity: number;
}

/**
 * Strips leading numbering and titles to get the clause body text.
 */
function getClauseBody(clause: Clause): string {
  let body = clause.text;
  if (clause.number && body.startsWith(clause.number)) {
    body = body.slice(clause.number.length).trim();
  }
  if (clause.title && body.startsWith(clause.title)) {
    body = body.slice(clause.title.length).trim();
  }
  return body.replace(/^[\.\:\-\s]+/, "").trim();
}

/**
 * Computes Jaccard word token similarity between two texts.
 */
function tokenSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().match(/\b[\p{L}\p{N}]+\b/gu) || []);
  const wordsB = new Set(b.toLowerCase().match(/\b[\p{L}\p{N}]+\b/gu) || []);

  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  const union = wordsA.size + wordsB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Aligns two sets of contract clauses into structured pairs.
 */
export function alignClauses(clausesA: Clause[], clausesB: Clause[]): AlignedPair[] {
  const matchedA = new Set<string>();
  const matchedB = new Set<string>();
  const pairs: AlignedPair[] = [];

  // Pass 1: Identical clauses (same number and same body)
  for (const a of clausesA) {
    const bodyA = getClauseBody(a);
    const normA = normalise(bodyA).norm;

    for (const b of clausesB) {
      if (matchedB.has(b.id)) continue;
      const bodyB = getClauseBody(b);
      const normB = normalise(bodyB).norm;

      if (a.number && b.number && a.number === b.number && normA === normB) {
        matchedA.add(a.id);
        matchedB.add(b.id);
        pairs.push({
          type: "identical",
          clauseA: a,
          clauseB: b,
          similarity: 1.0,
        });
        break;
      }
    }
  }

  // Pass 2: Renumbered clauses (identical or near-identical body, but different numbers or order)
  for (const a of clausesA) {
    if (matchedA.has(a.id)) continue;
    const bodyA = getClauseBody(a);
    const normA = normalise(bodyA).norm;

    for (const b of clausesB) {
      if (matchedB.has(b.id)) continue;
      const bodyB = getClauseBody(b);
      const normB = normalise(bodyB).norm;

      // Renumbered requires different clause numbers or distinct positions
      const differentNumber = !a.number || !b.number || a.number !== b.number;
      const sim = tokenSimilarity(bodyA, bodyB);
      if (differentNumber && (normA === normB || sim >= 0.85)) {
        matchedA.add(a.id);
        matchedB.add(b.id);
        pairs.push({
          type: "renumbered",
          clauseA: a,
          clauseB: b,
          similarity: sim,
        });
        break;
      }
    }
  }

  // Pass 3: Modified clauses (same number or high textual overlap)
  for (const a of clausesA) {
    if (matchedA.has(a.id)) continue;
    const bodyA = getClauseBody(a);

    let bestB: Clause | null = null;
    let bestSim = 0;

    for (const b of clausesB) {
      if (matchedB.has(b.id)) continue;
      const bodyB = getClauseBody(b);
      const sim = tokenSimilarity(bodyA, bodyB);

      // Match if same clause number, or if highest similarity above threshold
      const sameNumber = a.number && b.number && a.number.toLowerCase() === b.number.toLowerCase();
      if (sameNumber && sim >= 0.25) {
        bestB = b;
        bestSim = Math.max(sim, 0.7);
        break;
      }

      if (sim > bestSim && sim >= 0.35) {
        bestSim = sim;
        bestB = b;
      }
    }

    if (bestB) {
      matchedA.add(a.id);
      matchedB.add(bestB.id);
      pairs.push({
        type: "modified",
        clauseA: a,
        clauseB: bestB,
        similarity: bestSim,
      });
    }
  }

  // Pass 4: Removed clauses (in A, not in B)
  for (const a of clausesA) {
    if (!matchedA.has(a.id)) {
      pairs.push({
        type: "removed",
        clauseA: a,
        similarity: 0,
      });
    }
  }

  // Pass 5: Added clauses (in B, not in A)
  for (const b of clausesB) {
    if (!matchedB.has(b.id)) {
      pairs.push({
        type: "added",
        clauseB: b,
        similarity: 0,
      });
    }
  }

  // Sort aligned pairs by appearance order
  return pairs.sort((p1, p2) => {
    const offset1 = p1.clauseB ? p1.clauseB.startOffset : (p1.clauseA?.startOffset || 0);
    const offset2 = p2.clauseB ? p2.clauseB.startOffset : (p2.clauseA?.startOffset || 0);
    return offset1 - offset2;
  });
}
