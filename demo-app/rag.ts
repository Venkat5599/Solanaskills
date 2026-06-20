/**
 * Lightweight retrieval over the skill's own modules. Chunks each SKILL.md /
 * routed module by markdown heading and scores chunks against a query with a
 * BM25-lite term overlap. This is what grounds the agent's "how/why" answers in
 * the actual skill text instead of the model's prior — real RAG, no embeddings
 * service required so the demo runs anywhere.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface Chunk {
  source: string;
  heading: string;
  text: string;
  terms: Map<string, number>;
}

const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "is", "it", "for", "on",
  "that", "this", "with", "as", "by", "be", "are", "you", "your", "not", "no",
]);

function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9][a-z0-9_-]+/g) ?? []).filter(
    (t) => t.length > 2 && !STOP.has(t),
  );
}

function termFreq(text: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokenize(text)) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

/** Build the corpus from the skill/ directory (SKILL.md + routed modules). */
export function buildCorpus(skillDir: string): Chunk[] {
  const chunks: Chunk[] = [];
  if (!existsSync(skillDir)) return chunks;
  for (const file of readdirSync(skillDir)) {
    if (!file.endsWith(".md")) continue;
    const raw = readFileSync(join(skillDir, file), "utf8");
    // Split on H2/H3 headings, keeping the heading with its body.
    const parts = raw.split(/\n(?=#{1,3}\s)/);
    for (const part of parts) {
      const headingMatch = part.match(/^#{1,3}\s+(.+)/);
      const heading = headingMatch ? headingMatch[1]!.trim() : file;
      const text = part.trim();
      if (text.length < 40) continue;
      chunks.push({ source: file, heading, text, terms: termFreq(text) });
    }
  }
  return chunks;
}

export interface Retrieved {
  source: string;
  heading: string;
  snippet: string;
  score: number;
}

/** Return the top-k chunks for a query (BM25-lite). */
export function retrieve(corpus: Chunk[], query: string, k = 4): Retrieved[] {
  const qTerms = tokenize(query);
  if (qTerms.length === 0 || corpus.length === 0) return [];

  // Document frequency for idf.
  const df = new Map<string, number>();
  for (const term of new Set(qTerms)) {
    let n = 0;
    for (const c of corpus) if (c.terms.has(term)) n++;
    df.set(term, n);
  }
  const N = corpus.length;
  const avgLen = corpus.reduce((s, c) => s + c.text.length, 0) / N;
  const k1 = 1.5;
  const b = 0.75;

  const scored = corpus.map((c) => {
    let score = 0;
    const len = c.text.length;
    for (const term of qTerms) {
      const tf = c.terms.get(term) ?? 0;
      if (tf === 0) continue;
      const n = df.get(term) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (len / avgLen))));
    }
    return { c, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ c, score }) => ({
      source: c.source,
      heading: c.heading,
      snippet: c.text.slice(0, 700),
      score: Number(score.toFixed(3)),
    }));
}
