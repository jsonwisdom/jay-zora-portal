#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [k, ...rest] = arg.replace(/^--/, '').split('=');
  return [k, rest.join('=') || 'true'];
}));

const inputPath = args.input || 'data/live_zora_items.json';
const start = args.start || '2025-03-31T00:00:00Z';
const end = args.end || '2025-05-01T00:00:00Z';
const outDir = args['out-dir'] || 'reports/zora-emergence/2025-03-31_2025-04-30';

const startMs = Date.parse(start);
const endMs = Date.parse(end);
if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
  throw new Error(`Invalid interval: ${start} .. ${end}`);
}

const raw = fs.readFileSync(inputPath);
const sourceSha256 = crypto.createHash('sha256').update(raw).digest('hex');
const items = JSON.parse(raw.toString('utf8'));
if (!Array.isArray(items)) throw new Error('Zora inventory must be an array');

const slice = items
  .filter((item) => {
    const ms = Date.parse(item.created_at || '');
    return Number.isFinite(ms) && ms >= startMs && ms < endMs;
  })
  .sort((a, b) => {
    const dt = Date.parse(a.created_at) - Date.parse(b.created_at);
    if (dt !== 0) return dt;
    return String(a.contract || '').localeCompare(String(b.contract || ''));
  });

// General-language stop words only. There is deliberately no project-era taxonomy here.
const stop = new Set(`a an and are as at be been being but by can could did do does doing for from had has have he her hers him his i if in into is it its itself may me might my no nor not of on or our ours she should so than that the their theirs them then there these they this those through to too under up us very was we were what when where which while who why will with would you your yours`.split(/\s+/));

function tokenize(text) {
  const cleaned = String(text || '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/0x[a-f0-9]{40}/gi, ' ')
    .toLowerCase();
  const terms = cleaned.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu) || [];
  return terms.filter((t) => t.length >= 2 && !stop.has(t) && !/^\d+$/.test(t));
}

const docs = slice.map((item, idx) => {
  const titleTerms = tokenize(item.title);
  const descriptionTerms = tokenize(item.description);
  const allTerms = [...titleTerms, ...descriptionTerms];
  return {
    idx,
    item,
    titleTerms,
    descriptionTerms,
    allTerms,
    unique: new Set(allTerms),
  };
});

const tf = new Map();
const df = new Map();
for (const doc of docs) {
  for (const t of doc.allTerms) tf.set(t, (tf.get(t) || 0) + 1);
  for (const t of doc.unique) df.set(t, (df.get(t) || 0) + 1);
}

const n = Math.max(docs.length, 1);
const informative = new Set(
  [...df.entries()]
    .filter(([, count]) => count >= 2 && count / n <= 0.40)
    .map(([term]) => term)
);

class UF {
  constructor(size) { this.p = Array.from({ length: size }, (_, i) => i); }
  find(x) { while (this.p[x] !== x) { this.p[x] = this.p[this.p[x]]; x = this.p[x]; } return x; }
  union(a, b) { a = this.find(a); b = this.find(b); if (a !== b) this.p[b] = a; }
}
const uf = new UF(docs.length);
const similarityEdges = [];

for (let i = 0; i < docs.length; i++) {
  for (let j = i + 1; j < docs.length; j++) {
    const a = new Set([...docs[i].unique].filter((t) => informative.has(t)));
    const b = new Set([...docs[j].unique].filter((t) => informative.has(t)));
    const shared = [...a].filter((t) => b.has(t));
    if (shared.length < 2) continue;
    const unionSize = new Set([...a, ...b]).size;
    const jaccard = unionSize ? shared.length / unionSize : 0;
    if (jaccard >= 0.10) {
      uf.union(i, j);
      similarityEdges.push({ a: i, b: j, shared_terms: shared.sort(), jaccard: Number(jaccard.toFixed(6)) });
    }
  }
}

const components = new Map();
for (let i = 0; i < docs.length; i++) {
  const root = uf.find(i);
  if (!components.has(root)) components.set(root, []);
  components.get(root).push(i);
}

const componentList = [...components.values()].sort((a, b) => {
  const ta = Date.parse(docs[a[0]].item.created_at);
  const tb = Date.parse(docs[b[0]].item.created_at);
  return ta - tb || a[0] - b[0];
});

const clusterIdByDoc = new Map();
const clusters = componentList.map((members, ci) => {
  const id = `C${String(ci + 1).padStart(3, '0')}`;
  members.forEach((m) => clusterIdByDoc.set(m, id));
  const ctf = new Map();
  for (const m of members) for (const t of docs[m].allTerms) ctf.set(t, (ctf.get(t) || 0) + 1);
  const scored = [...ctf.entries()].map(([term, count]) => {
    const dfi = df.get(term) || 1;
    const idf = Math.log((docs.length + 1) / (dfi + 1)) + 1;
    return [term, count * idf, count, dfi];
  }).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const topTerms = scored.slice(0, 8).map(([term, score, count, document_frequency]) => ({
    term,
    score: Number(score.toFixed(6)),
    count,
    document_frequency,
  }));
  const memberItems = members.map((m) => docs[m].item);
  return {
    cluster_id: id,
    clustering_basis: 'lexical_cooccurrence_only_no_modern_taxonomy',
    size: members.length,
    first_created_at: memberItems[0]?.created_at || null,
    last_created_at: memberItems.at(-1)?.created_at || null,
    top_terms: topTerms,
    titles: memberItems.map((x) => x.title || ''),
    contracts: memberItems.map((x) => x.contract || ''),
  };
});

function termScores(doc) {
  const local = new Map();
  for (const t of doc.allTerms) local.set(t, (local.get(t) || 0) + 1);
  return [...local.entries()].map(([term, count]) => {
    const dfi = df.get(term) || 1;
    const idf = Math.log((docs.length + 1) / (dfi + 1)) + 1;
    return [term, count * idf];
  }).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12).map(([term]) => term);
}

const postRecords = docs.map((doc, i) => ({
  schema: 'zora.emergence.raw_post.v0.1',
  sequence: i + 1,
  created_at: doc.item.created_at || null,
  title: doc.item.title || '',
  description: doc.item.description || '',
  contract: doc.item.contract || '',
  zora_url: doc.item.zora_url || '',
  raw_terms: termScores(doc),
  cluster_id: clusterIdByDoc.get(i),
  semantic_label_assigned: false,
  modern_taxonomy_injected: false,
}));

const topCorpusTerms = [...tf.entries()].map(([term, count]) => ({ term, count, document_frequency: df.get(term) || 0 }))
  .sort((a, b) => b.count - a.count || b.document_frequency - a.document_frequency || a.term.localeCompare(b.term))
  .slice(0, 60);

const activeDays = new Map();
for (const x of slice) {
  const day = String(x.created_at).slice(0, 10);
  activeDays.set(day, (activeDays.get(day) || 0) + 1);
}

fs.mkdirSync(outDir, { recursive: true });
const postsPath = path.join(outDir, 'posts.jsonl');
const clustersPath = path.join(outDir, 'clusters.json');
const summaryPath = path.join(outDir, 'summary.md');
const edgesPath = path.join(outDir, 'similarity_edges.jsonl');

fs.writeFileSync(postsPath, postRecords.map((x) => JSON.stringify(x)).join('\n') + (postRecords.length ? '\n' : ''));
fs.writeFileSync(edgesPath, similarityEdges.map((x) => JSON.stringify(x)).join('\n') + (similarityEdges.length ? '\n' : ''));
fs.writeFileSync(clustersPath, JSON.stringify({
  schema: 'zora.emergence.clusters.v0.1',
  interval: { start, end_exclusive: end },
  source: { path: inputPath, sha256: sourceSha256, inventory_rows: items.length },
  slice_rows: slice.length,
  modern_taxonomy_injected: false,
  algorithm: {
    tokenization: 'unicode_words_general_stopwords_urls_and_contracts_removed',
    informative_term_rule: 'document_frequency >= 2 and <= 40% of slice',
    pair_edge_rule: 'shared_informative_terms >= 2 and jaccard >= 0.10',
    clustering: 'connected_components',
    cluster_labels: 'none; top_terms are raw lexical summaries only'
  },
  clusters,
  top_corpus_terms: topCorpusTerms,
  active_days: [...activeDays.entries()].map(([date, count]) => ({ date, count })),
}, null, 2));

const summary = `# Zora Emergence Audit — 2025-03-31 through 2025-04-30\n\n` +
`- source: \`${inputPath}\`\n` +
`- source_sha256: \`${sourceSha256}\`\n` +
`- inventory_rows: ${items.length}\n` +
`- slice_rows: ${slice.length}\n` +
`- first_observed_in_slice: ${slice[0]?.created_at || 'NONE'}\n` +
`- last_observed_in_slice: ${slice.at(-1)?.created_at || 'NONE'}\n` +
`- active_days: ${activeDays.size}\n` +
`- lexical_components: ${clusters.length}\n` +
`- similarity_edges: ${similarityEdges.length}\n` +
`- modern_taxonomy_injected: FALSE\n` +
`- semantic_cluster_names_assigned: FALSE\n\n` +
`## Method law\n\n` +
`This pass uses only contemporaneous Zora title/description text plus timestamps and contract locators. It does not classify posts as BoxDee, Goblin, Family, Court, civic, AI, or any other later ontology. Components are produced only from lexical co-occurrence. Human interpretation happens downstream and must remain explicitly marked as interpretation.\n\n` +
`## Earliest rows\n\n` +
postRecords.slice(0, 12).map((x) => `- ${x.created_at} — ${x.title} — ${x.contract}`).join('\n') + `\n\n` +
`## Top raw terms\n\n` + topCorpusTerms.slice(0, 30).map((x) => `- ${x.term}: tf=${x.count}, df=${x.document_frequency}`).join('\n') + `\n`;
fs.writeFileSync(summaryPath, summary);

const outputs = [postsPath, edgesPath, clustersPath, summaryPath];
const outputHashes = Object.fromEntries(outputs.map((p) => [p, crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const manifest = {
  schema: 'zora.emergence.audit_manifest.v0.1',
  generated_at: new Date().toISOString(),
  interval: { start, end_exclusive: end },
  source: { path: inputPath, sha256: sourceSha256, inventory_rows: items.length },
  slice_rows: slice.length,
  outputs_sha256: outputHashes,
  authority_created: false,
  canon_promoted: false,
  modern_taxonomy_injected: false,
};
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(JSON.stringify({
  ok: true,
  input: inputPath,
  source_sha256: sourceSha256,
  slice_rows: slice.length,
  first: slice[0]?.created_at || null,
  last: slice.at(-1)?.created_at || null,
  active_days: activeDays.size,
  clusters: clusters.length,
  similarity_edges: similarityEdges.length,
  out_dir: outDir,
}, null, 2));
