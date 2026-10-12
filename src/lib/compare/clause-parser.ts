/**
 * Contract Clause Parser (Phase 6, D-028)
 * Parses canonical contract text into structured clauses with numbers and titles.
 */

import type { Clause } from "./types";

interface PageBoundary {
  pageNumber: number;
  startOffset: number;
  endOffset: number;
}

/**
 * Parses canonical text into numbered and titled clauses.
 */
export function parseContractClauses(
  text: string,
  pages?: PageBoundary[]
): Clause[] {
  if (!text || text.trim().length === 0) return [];

  // Patterns for clause headers:
  // e.g. "1. Definitions", "1.1 General", "Section 2. Termination", "Article IV - Liability", "Schedule A"
  const headerRegex = /(?:^|\n\s*\n|\n)(?:(?:Clause|Section|Article|Schedule)\s+)?([0-9]+(?:\.[0-9]+)*|[IVXLCDM]+|[A-Z])[\.\:\)]\s*([^\n\r]+)?/gi;

  const matches: Array<{
    index: number;
    headerLength: number;
    number: string;
    title?: string;
  }> = [];

  let match: RegExpExecArray | null;
  while ((match = headerRegex.exec(text)) !== null) {
    const rawNumber = match[1].trim();
    const rawTitle = match[2] ? match[2].trim() : undefined;
    
    // Ignore short list items that are just single digits inside small sentences if no double newline
    matches.push({
      index: match.index + (match[0].startsWith("\n") ? match[0].indexOf(match[1]) : 0),
      headerLength: match[0].length,
      number: rawNumber,
      title: rawTitle,
    });
  }

  // If no clear numbered headers found, split by double newlines into paragraph units
  if (matches.length <= 1) {
    return fallbackParagraphSplit(text, pages);
  }

  const clauses: Clause[] = [];
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const startOffset = current.index;
    const endOffset = next ? next.index : text.length;
    const clauseText = text.slice(startOffset, endOffset).trim();

    if (clauseText.length < 5) continue;

    const page = pages
      ? pages.find((p) => startOffset >= p.startOffset && startOffset < p.endOffset)?.pageNumber || 1
      : 1;

    clauses.push({
      id: `clause-${i + 1}`,
      number: current.number,
      title: current.title,
      text: clauseText,
      startOffset,
      endOffset,
      page,
    });
  }

  return clauses.length > 0 ? clauses : fallbackParagraphSplit(text, pages);
}

function fallbackParagraphSplit(text: string, pages?: PageBoundary[]): Clause[] {
  const paragraphs = text.split(/\n\s*\n+/);
  const clauses: Clause[] = [];
  let currentOffset = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i].trim();
    if (!p) continue;

    const startOffset = text.indexOf(p, currentOffset);
    const endOffset = startOffset + p.length;
    currentOffset = endOffset;

    const page = pages
      ? pages.find((pg) => startOffset >= pg.startOffset && startOffset < pg.endOffset)?.pageNumber || 1
      : 1;

    // Check if paragraph starts with a number or bold heading
    const numMatch = p.match(/^([0-9]+(?:\.[0-9]+)*|[A-Z])[\.\:\)]\s*(.*)/);
    const number = numMatch ? numMatch[1] : `P${i + 1}`;
    const title = numMatch && numMatch[2].length < 60 ? numMatch[2] : undefined;

    clauses.push({
      id: `clause-${i + 1}`,
      number,
      title,
      text: p,
      startOffset,
      endOffset,
      page,
    });
  }

  return clauses;
}
