export interface ChunkDraft {
  ordinal: number;
  startOffset: number;
  endOffset: number;
  heading: string | null;
  clauseRef: string | null;
  tokenEst: number;
  text: string;
}

const TARGET_CHUNK_TOKENS = 1500;
const MAX_CHUNK_TOKENS = 2500;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Matches headings like "1. Definitions", "1.1 General", "Article 5. Warranties", "Clause 14: Termination", "SECTION 4"
const HEADING_REGEX = /^(?:(?:Article|Clause|Section|Part)\s+([0-9A-Z]+(?:\.[0-9]+)*)|([0-9]+(?:\.[0-9]+)*\.?))\s+([A-Z][^\n]+)$/i;

/**
 * Splits canonical document text into clause-aware chunks with exact offsets.
 */
export function chunkCanonicalText(canonicalText: string): ChunkDraft[] {
  if (!canonicalText || canonicalText.trim().length === 0) {
    return [];
  }

  // Split into paragraphs by finding paragraph break offsets
  const paragraphBreaks: { start: number; end: number; text: string }[] = [];
  const lines = canonicalText.split("\n");
  let currentOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = currentOffset;
    const lineEnd = currentOffset + line.length;

    paragraphBreaks.push({
      start: lineStart,
      end: lineEnd,
      text: line,
    });

    currentOffset = lineEnd + 1; // +1 for the \n
  }

  const chunks: ChunkDraft[] = [];
  let currentChunkStart = 0;
  let currentChunkEnd = 0;
  let currentHeading: string | null = null;
  let currentClauseRef: string | null = null;
  let currentTokens = 0;
  let ordinal = 0;

  const flushCurrentChunk = () => {
    if (currentChunkEnd > currentChunkStart) {
      const chunkText = canonicalText.slice(currentChunkStart, currentChunkEnd);
      if (chunkText.trim().length > 0) {
        chunks.push({
          ordinal,
          startOffset: currentChunkStart,
          endOffset: currentChunkEnd,
          heading: currentHeading,
          clauseRef: currentClauseRef,
          tokenEst: estimateTokens(chunkText),
          text: chunkText,
        });
        ordinal++;
      }
    }
  };

  for (let i = 0; i < paragraphBreaks.length; i++) {
    const p = paragraphBreaks[i];
    const trimmed = p.text.trim();
    if (!trimmed) {
      currentChunkEnd = p.end;
      continue;
    }

    const headingMatch = trimmed.match(HEADING_REGEX);
    const isHeading = headingMatch !== null || (trimmed === trimmed.toUpperCase() && trimmed.length > 5 && trimmed.length < 100);

    const paraTokens = estimateTokens(p.text);

    // If we hit a new major clause heading and already have enough tokens in the current chunk, flush
    if (isHeading && currentTokens >= 100) {
      flushCurrentChunk();
      currentChunkStart = p.start;
      currentChunkEnd = p.end;
      currentTokens = paraTokens;
      currentHeading = trimmed;
      currentClauseRef = headingMatch ? (headingMatch[1] || headingMatch[2] || null) : null;
      continue;
    }

    // If adding this paragraph exceeds MAX_CHUNK_TOKENS, flush first
    if (currentTokens + paraTokens > MAX_CHUNK_TOKENS && currentTokens > 300) {
      flushCurrentChunk();
      currentChunkStart = p.start;
      currentChunkEnd = p.end;
      currentTokens = paraTokens;
      if (isHeading) {
        currentHeading = trimmed;
        currentClauseRef = headingMatch ? (headingMatch[1] || headingMatch[2] || null) : null;
      }
      continue;
    }

    // Initialize first chunk
    if (currentTokens === 0) {
      currentChunkStart = p.start;
      if (isHeading) {
        currentHeading = trimmed;
        currentClauseRef = headingMatch ? (headingMatch[1] || headingMatch[2] || null) : null;
      }
    }

    currentChunkEnd = p.end;
    currentTokens += paraTokens;

    // Check if reached target tokens
    if (currentTokens >= TARGET_CHUNK_TOKENS) {
      flushCurrentChunk();
      currentTokens = 0;
      currentHeading = null;
      currentClauseRef = null;
    }
  }

  // Flush remaining text
  flushCurrentChunk();

  return chunks;
}
