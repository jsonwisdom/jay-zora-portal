import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const LEAVES_DIR = path.join(ROOT, "frontend", "public", "leaves");
const OUT = path.join(ROOT, "frontend", "public", "forest.json");
const ROOT_ID = "jayspace-root";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function stableLeaf(leaf) {
  return JSON.stringify({
    id: leaf.id,
    title: leaf.title,
    grove: leaf.grove,
    status: leaf.status,
    claim: leaf.claim,
    proof_links: leaf.proof_links || [],
    updated_at: leaf.updated_at,
  });
}

function pairRoot(hashes) {
  if (!hashes.length) return "";
  let layer = hashes.slice().sort();
  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      next.push(sha256(`${layer[i]}${layer[i + 1] || layer[i]}`));
    }
    layer = next;
  }
  return layer[0];
}

const files = fs.readdirSync(LEAVES_DIR)
  .filter((name) => name.endsWith(".json") && name !== "schema.json")
  .sort();

const leaves = files.map((name) => {
  const leaf = readJson(path.join(LEAVES_DIR, name));
  const hash = sha256(stableLeaf(leaf));
  return { ...leaf, leaf_path: `leaves/${name}`, leaf_hash: hash };
});

const groveMap = new Map();
for (const leaf of leaves) {
  if (!groveMap.has(leaf.grove)) {
    groveMap.set(leaf.grove, {
      id: leaf.grove,
      title: leaf.grove.split("-").map((x) => x[0].toUpperCase() + x.slice(1)).join(" "),
      leaf_count: 0,
      leaves: [],
      grove_hash: "",
    });
  }
  const grove = groveMap.get(leaf.grove);
  grove.leaf_count += 1;
  grove.leaves.push(leaf.id);
}

const groves = [...groveMap.values()].map((grove) => {
  const hashes = leaves.filter((leaf) => leaf.grove === grove.id).map((leaf) => leaf.leaf_hash);
  return { ...grove, grove_hash: pairRoot(hashes) };
}).sort((a, b) => a.title.localeCompare(b.title));

const forest = {
  schema: "JAYSPACE_MERKLE_FOREST_V1",
  root: ROOT_ID,
  generated_at: new Date().toISOString(),
  doctrine: "Zoom from ambiguity into proof.",
  leaf_count: leaves.length,
  grove_count: groves.length,
  forest_root_sha256: pairRoot(leaves.map((leaf) => leaf.leaf_hash)),
  groves,
  leaves: leaves.map(({ id, title, grove, status, claim, summary, proof_links, tags, updated_at, leaf_path, leaf_hash }) => ({
    id, title, grove, status, claim, summary, proof_links, tags, updated_at, leaf_path, leaf_hash,
  })),
};

fs.writeFileSync(OUT, JSON.stringify(forest, null, 2) + "\n");
console.log(`FOREST_GROVES=${forest.grove_count}`);
console.log(`FOREST_LEAVES=${forest.leaf_count}`);
console.log(`FOREST_ROOT_SHA256=${forest.forest_root_sha256}`);
