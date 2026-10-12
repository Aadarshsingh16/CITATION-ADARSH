/**
 * Stream tag parser for inline <q id="..." doc="...">...</q> quote tags.
 *
 * Rules:
 * - Incrementally parse <q id="1" doc="D1">text</q> from streamed LLM tokens.
 * - Tolerates attribute order, single/double quotes, and tags split across chunks.
 * - Hides tag syntax from clean text while keeping the quote prose.
 * - Drops unclosed tags at the end of the stream or on Stop.
 * - Quotes naming a doc id not in allowedDocIds are dropped and counted.
 */

export interface ParsedQuoteTag {
  localId: string;
  docId: string;
  text: string;
}

export type MessageSegment =
  | { type: "text"; text: string }
  | { type: "quote"; localId: string; docId: string; text: string };

export interface StreamParserOptions {
  allowedDocIds?: string[];
  defaultDocId?: string;
  onText?: (cleanChunk: string) => void;
  onQuoteOpen?: (tag: { localId: string; docId: string }) => void;
  onQuoteText?: (chunk: string) => void;
  onQuoteClose?: (quote: ParsedQuoteTag) => void;
  onQuoteDropped?: (reason: string, tagInfo: string) => void;
}

export class StreamTagParser {
  private buffer = "";
  private inQuote = false;
  private inDroppedQuote = false;
  private currentQuote: { localId: string; docId: string; text: string } | null = null;
  private cleanText = "";
  private rawText = "";
  private completedQuotes: ParsedQuoteTag[] = [];
  private droppedQuotesCount = 0;
  private quoteIndex = 0;

  private allowedDocIds?: string[];
  private defaultDocId: string;
  private onText?: (cleanChunk: string) => void;
  private onQuoteOpen?: (tag: { localId: string; docId: string }) => void;
  private onQuoteText?: (chunk: string) => void;
  private onQuoteClose?: (quote: ParsedQuoteTag) => void;
  private onQuoteDropped?: (reason: string, tagInfo: string) => void;

  constructor(options: StreamParserOptions = {}) {
    this.allowedDocIds = options.allowedDocIds;
    this.defaultDocId = options.defaultDocId || "D1";
    this.onText = options.onText;
    this.onQuoteOpen = options.onQuoteOpen;
    this.onQuoteText = options.onQuoteText;
    this.onQuoteClose = options.onQuoteClose;
    this.onQuoteDropped = options.onQuoteDropped;
  }

  feed(chunk: string): void {
    if (!chunk) return;
    this.rawText += chunk;
    this.buffer += chunk;
    this.processBuffer();
  }

  end(): void {
    if (this.inQuote && this.currentQuote) {
      // Unclosed tag at stream end or Stop: drop the quote, keep text in clean text
      this.droppedQuotesCount++;
      this.onQuoteDropped?.("unclosed_tag", `<q id="${this.currentQuote.localId}">`);
      this.inQuote = false;
      this.currentQuote = null;
    }
    this.inDroppedQuote = false;

    if (this.buffer.length > 0) {
      // Clean any dangling tag prefixes like "<" or "<q" or "</q"
      const cleaned = this.buffer.replace(/<\/?\s*q[^>]*$/i, "");
      if (cleaned.length > 0) {
        this.cleanText += cleaned;
        this.onText?.(cleaned);
      }
      this.buffer = "";
    }
  }

  getCleanText(): string {
    return this.cleanText;
  }

  getRawText(): string {
    return this.rawText;
  }

  getCompletedQuotes(): ParsedQuoteTag[] {
    return [...this.completedQuotes];
  }

  getDroppedCount(): number {
    return this.droppedQuotesCount;
  }

  private processBuffer(): void {
    while (this.buffer.length > 0) {
      if (!this.inQuote && !this.inDroppedQuote) {
        // Check for stray </q> closing tag outside of quote
        const strayCloseIdx = this.buffer.search(/<\/\s*q\s*>/i);
        const openIdx = this.buffer.search(/<\s*q(?:\s+|>|\/>)/i);

        if (strayCloseIdx !== -1 && (openIdx === -1 || strayCloseIdx < openIdx)) {
          // Consume text before stray </q>
          if (strayCloseIdx > 0) {
            const preText = this.buffer.slice(0, strayCloseIdx);
            this.cleanText += preText;
            this.onText?.(preText);
          }
          const match = this.buffer.slice(strayCloseIdx).match(/<\/\s*q\s*>/i);
          const matchLen = match ? match[0].length : 4;
          this.buffer = this.buffer.slice(strayCloseIdx + matchLen);
          continue;
        }

        if (openIdx === -1) {
          // Check if buffer ends with a potential opening tag prefix (e.g. "<", "<q", "<q ")
          const partialMatch = this.buffer.match(/<\s*q?[^>]*$/i);
          if (partialMatch && partialMatch.index !== undefined) {
            const safeText = this.buffer.slice(0, partialMatch.index);
            if (safeText.length > 0) {
              this.cleanText += safeText;
              this.onText?.(safeText);
              this.buffer = this.buffer.slice(partialMatch.index);
            }
            if (this.buffer.length > 150) {
              this.cleanText += this.buffer;
              this.onText?.(this.buffer);
              this.buffer = "";
            }
            break;
          } else {
            this.cleanText += this.buffer;
            this.onText?.(this.buffer);
            this.buffer = "";
            break;
          }
        }

        // Emit text before <q
        if (openIdx > 0) {
          const preText = this.buffer.slice(0, openIdx);
          this.cleanText += preText;
          this.onText?.(preText);
          this.buffer = this.buffer.slice(openIdx);
        }

        // Now buffer starts with <q
        const closeBracketIdx = this.buffer.indexOf(">");
        if (closeBracketIdx === -1) {
          if (this.buffer.length > 150) {
            this.cleanText += this.buffer;
            this.onText?.(this.buffer);
            this.buffer = "";
          }
          break;
        }

        const fullTag = this.buffer.slice(0, closeBracketIdx + 1);
        this.buffer = this.buffer.slice(closeBracketIdx + 1);

        // Check if self-closing: <q ... />
        if (/\/\s*>$/.test(fullTag)) {
          this.droppedQuotesCount++;
          this.onQuoteDropped?.("self_closing", fullTag);
          continue;
        }

        const { localId, docId } = this.parseTagAttributes(fullTag);

        // Check docId allowlist if provided
        if (this.allowedDocIds && !this.allowedDocIds.includes(docId)) {
          this.droppedQuotesCount++;
          this.onQuoteDropped?.("unknown_document", fullTag);
          this.inDroppedQuote = true;
          continue;
        }

        this.inQuote = true;
        this.currentQuote = { localId, docId, text: "" };
        this.onQuoteOpen?.({ localId, docId });
      } else {
        // In quote or in dropped quote: look for closing </q> or next opening <q
        const closeIdx = this.buffer.search(/<\/\s*q\s*>/i);
        const nextOpenIdx = this.buffer.search(/<\s*q(?:\s+|>|\/>)/i);

        // If next <q opens before </q> closes, tag was never closed!
        if (nextOpenIdx !== -1 && (closeIdx === -1 || nextOpenIdx < closeIdx)) {
          if (this.inQuote && this.currentQuote) {
            this.droppedQuotesCount++;
            this.onQuoteDropped?.("unclosed_tag", `<q id="${this.currentQuote.localId}">`);
          }
          const textBeforeNext = this.buffer.slice(0, nextOpenIdx);
          if (textBeforeNext.length > 0) {
            this.cleanText += textBeforeNext;
            this.onText?.(textBeforeNext);
          }
          this.buffer = this.buffer.slice(nextOpenIdx);
          this.inQuote = false;
          this.inDroppedQuote = false;
          this.currentQuote = null;
          continue;
        }

        if (closeIdx === -1) {
          // Check if buffer ends with partial closing tag prefix: "<", "</", "</q"
          const partialClose = this.buffer.match(/<\/?\s*q?\s*$/i);
          if (partialClose && partialClose.index !== undefined) {
            const safeQuoteText = this.buffer.slice(0, partialClose.index);
            if (safeQuoteText.length > 0) {
              if (this.inQuote && this.currentQuote) this.currentQuote.text += safeQuoteText;
              this.cleanText += safeQuoteText;
              this.onText?.(safeQuoteText);
              if (this.inQuote) this.onQuoteText?.(safeQuoteText);
              this.buffer = this.buffer.slice(partialClose.index);
            }
            break;
          } else {
            if (this.inQuote && this.currentQuote) this.currentQuote.text += this.buffer;
            this.cleanText += this.buffer;
            this.onText?.(this.buffer);
            if (this.inQuote) this.onQuoteText?.(this.buffer);
            this.buffer = "";
            break;
          }
        }

        // Closing tag found!
        const quoteText = this.buffer.slice(0, closeIdx);
        if (quoteText.length > 0) {
          if (this.inQuote && this.currentQuote) this.currentQuote.text += quoteText;
          this.cleanText += quoteText;
          this.onText?.(quoteText);
          if (this.inQuote) this.onQuoteText?.(quoteText);
        }

        const closeMatch = this.buffer.slice(closeIdx).match(/<\/\s*q\s*>/i);
        const matchLen = closeMatch ? closeMatch[0].length : 4;
        this.buffer = this.buffer.slice(closeIdx + matchLen);

        if (this.inQuote && this.currentQuote) {
          const completed: ParsedQuoteTag = {
            localId: this.currentQuote.localId,
            docId: this.currentQuote.docId,
            text: this.currentQuote.text,
          };
          this.completedQuotes.push(completed);
          this.onQuoteClose?.(completed);
        }

        this.inQuote = false;
        this.inDroppedQuote = false;
        this.currentQuote = null;
      }
    }
  }

  private parseTagAttributes(tagStr: string): { localId: string; docId: string } {
    const idMatch = tagStr.match(/\bid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const localId = idMatch
      ? (idMatch[1] ?? idMatch[2] ?? idMatch[3] ?? "")
      : String(++this.quoteIndex);

    const docMatch = tagStr.match(/\bdoc(?:ument)?\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const docId = docMatch
      ? (docMatch[1] ?? docMatch[2] ?? docMatch[3] ?? "")
      : this.defaultDocId;

    return { localId: localId || String(++this.quoteIndex), docId: docId || this.defaultDocId };
  }
}

/**
 * Pure helper to parse complete message content into structured segments and quotes.
 */
export function parseMessageContent(
  rawText: string,
  allowedDocIds?: string[],
  defaultDocId = "D1"
): {
  cleanText: string;
  segments: MessageSegment[];
  quotes: ParsedQuoteTag[];
  droppedCount: number;
} {
  const segments: MessageSegment[] = [];
  const quotes: ParsedQuoteTag[] = [];
  let droppedCount = 0;
  let quoteIndex = 0;

  const tagRegex = /<\s*q\b([^>]*)>([\s\S]*?)<\/\s*q\s*>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(rawText)) !== null) {
    const matchStart = match.index;
    const matchEnd = tagRegex.lastIndex;
    const attrStr = match[1] || "";
    const quoteContent = match[2] || "";

    if (matchStart > lastIndex) {
      const textPrior = rawText.slice(lastIndex, matchStart);
      const cleanPrior = textPrior.replace(/<\/?q[^>]*>/gi, "");
      if (cleanPrior) {
        segments.push({ type: "text", text: cleanPrior });
      }
    }

    lastIndex = matchEnd;

    const idMatch = attrStr.match(/\bid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const localId = idMatch
      ? (idMatch[1] ?? idMatch[2] ?? idMatch[3] ?? "")
      : String(++quoteIndex);

    const docMatch = attrStr.match(/\bdoc(?:ument)?\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const docId = docMatch
      ? (docMatch[1] ?? docMatch[2] ?? docMatch[3] ?? "")
      : defaultDocId;

    if (allowedDocIds && !allowedDocIds.includes(docId)) {
      droppedCount++;
      segments.push({ type: "text", text: quoteContent });
      continue;
    }

    const qItem: ParsedQuoteTag = {
      localId: localId || String(++quoteIndex),
      docId: docId || defaultDocId,
      text: quoteContent,
    };

    quotes.push(qItem);
    segments.push({
      type: "quote",
      localId: qItem.localId,
      docId: qItem.docId,
      text: qItem.text,
    });
  }

  if (lastIndex < rawText.length) {
    const trailing = rawText.slice(lastIndex);
    const cleanTrailing = trailing.replace(/<\s*q\b[^>]*>/gi, "").replace(/<\/\s*q\s*>/gi, "");
    if (cleanTrailing) {
      segments.push({ type: "text", text: cleanTrailing });
    }
  }

  const cleanText = segments.map((s) => s.text).join("");

  return { cleanText, segments, quotes, droppedCount };
}
