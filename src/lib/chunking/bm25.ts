export interface BM25Document {
  id: string;
  text: string;
  [key: string]: unknown;
}

export interface BM25SearchResult<T = unknown> {
  id: string;
  score: number;
  doc: T;
}

export class BM25Index<T extends BM25Document> {
  private docs: T[] = [];
  private docLengths: number[] = [];
  private avgDocLength: number = 0;
  private termDocFreq: Map<string, number> = new Map();
  private docTermFreqs: Map<string, number>[] = [];
  private k1: number = 1.2;
  private b: number = 0.75;

  constructor(docs: T[] = [], k1 = 1.2, b = 0.75) {
    this.k1 = k1;
    this.b = b;
    if (docs.length > 0) {
      this.build(docs);
    }
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1);
  }

  public build(docs: T[]): void {
    this.docs = docs;
    this.docLengths = [];
    this.termDocFreq = new Map();
    this.docTermFreqs = [];

    let totalLength = 0;

    for (const doc of docs) {
      const tokens = this.tokenize(doc.text);
      this.docLengths.push(tokens.length);
      totalLength += tokens.length;

      const tf = new Map<string, number>();
      const seenTerms = new Set<string>();

      for (const token of tokens) {
        tf.set(token, (tf.get(token) || 0) + 1);
        seenTerms.add(token);
      }

      this.docTermFreqs.push(tf);

      for (const term of seenTerms) {
        this.termDocFreq.set(term, (this.termDocFreq.get(term) || 0) + 1);
      }
    }

    this.avgDocLength = docs.length > 0 ? totalLength / docs.length : 0;
  }

  public search(query: string, topK: number = 5): BM25SearchResult<T>[] {
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0 || this.docs.length === 0) {
      return [];
    }

    const n = this.docs.length;
    const scores: { id: string; score: number; doc: T }[] = [];

    for (let i = 0; i < n; i++) {
      const doc = this.docs[i];
      const docLen = this.docLengths[i];
      const tfMap = this.docTermFreqs[i];
      let docScore = 0;

      for (const token of queryTokens) {
        const tf = tfMap.get(token) || 0;
        if (tf === 0) continue;

        const df = this.termDocFreq.get(token) || 0;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / (this.avgDocLength || 1)));

        docScore += idf * (numerator / denominator);
      }

      if (docScore > 0) {
        scores.push({
          id: doc.id,
          score: docScore,
          doc,
        });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }
}
