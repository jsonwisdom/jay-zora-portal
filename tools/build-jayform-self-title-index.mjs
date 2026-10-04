import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const INPUT_PATH = path.resolve(
  repoRoot,
  process.env.JAYFORM_INPUT || "data/live_zora_items.json"
);
const OUTPUT_PATH = path.resolve(
  repoRoot,
  process.env.JAYFORM_OUTPUT || "data/jayform_self_title_index.json"
);

const CLASSIFIER_VERSION = "0.1.0";
const SCHEMA = "JAYFORM_SELF_TITLE_INDEX_V0";
const AUTHORITY_CREATED = false;

const CLASSES = [
  "SELF_EXACT",
  "SELF_DERIVATIVE",
  "JAY_SYSTEM",
  "SELF_CONTEXT",
  "AMBIGUOUS",
  "NON_SELF",
];

const EXACT_SELF_TITLES = new Set(["JAY", "JAY WISDOM", "JAYWISDOM"]);

// System-purpose suffixes deliberately exclude CORE so JAYCORE remains a
// self-derivative unless a future, versioned rule changes that classification.
const SYSTEM_WORDS = new Set([
  "FORM",
  "PLATFORM",
  "SYSTEM",
  "SYSTEMS",
  "INFRASTRUCTURE",
  "PROTOCOL",
  "ENGINE",
  "MACHINE",
  "ARCHITECTURE",
  "FRAMEWORK",
  "NETWORK",
  "STACK",
  "OS",
]);

const SELF_CONTEXT_PATTERNS = [
  /\bJAY\s+WISDOM\b/u,
  /\bJAYWISDOM\b/u,
  /\bJAYWISDOM\.BASE\.ETH\b/u,
  /@JAYWISDOM\b/u,
  /\bJAY\s+PLATFORM\b/u,
  /\bJAYFORM\b/u,
];

function sha256Text(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function stripWrappingQuotes(value) {
  const pairs = new Map([
    ['"', '"'],
    ["'", "'"],
    ["“", "”"],
    ["‘", "’"],
    ["«", "»"],
  ]);

  let out = value;
  let changed = true;
  while (changed && out.length >= 2) {
    changed = false;
    const first = out[0];
    const expectedLast = pairs.get(first);
    if (expectedLast && out.at(-1) === expectedLast) {
      out = out.slice(1, -1).trim();
      changed = true;
    }
  }
  return out;
}

export function normalizeTitle(value) {
  return stripWrappingQuotes(
    String(value ?? "")
      .normalize("NFKC")
      .replace(/\s+/gu, " ")
      .trim()
  )
    .toUpperCase()
    .replace(/\s+/gu, " ")
    .trim();
}

function comparisonText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toUpperCase()
    .replace(/\s+/gu, " ")
    .trim();
}

function titleWords(normalizedTitle) {
  return normalizedTitle
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
}

function hasSelfLexeme(normalizedTitle) {
  const compact = normalizedTitle.replace(/[^A-Z0-9]+/g, "");
  const words = titleWords(normalizedTitle);
  return (
    words.includes("JAY") ||
    compact.includes("JAYWISDOM") ||
    compact.startsWith("JAY")
  );
}

function hasSystemPurpose(normalizedTitle) {
  const words = titleWords(normalizedTitle);
  if (words.some((word) => SYSTEM_WORDS.has(word))) return true;

  const compact = normalizedTitle.replace(/[^A-Z0-9]+/g, "");
  return [
    "JAYFORM",
    "JAYPLATFORM",
    "JAYSYSTEM",
    "JAYSYSTEMS",
    "JAYINFRASTRUCTURE",
    "JAYPROTOCOL",
    "JAYENGINE",
    "JAYMACHINE",
    "JAYARCHITECTURE",
    "JAYFRAMEWORK",
    "JAYNETWORK",
    "JAYSTACK",
    "JAYOS",
  ].some((prefix) => compact.startsWith(prefix));
}

function hasSelfContext(description) {
  const text = comparisonText(description);
  return SELF_CONTEXT_PATTERNS.some((pattern) => pattern.test(text));
}

export function classifyTitle({ normalizedTitle, description = "" }) {
  if (!normalizedTitle) {
    return {
      class: "AMBIGUOUS",
      basis: "EMPTY_OR_MISSING_TITLE",
    };
  }

  if (EXACT_SELF_TITLES.has(normalizedTitle)) {
    return {
      class: "SELF_EXACT",
      basis: "EXACT_SELF_TITLE",
    };
  }

  if (hasSelfLexeme(normalizedTitle) && hasSystemPurpose(normalizedTitle)) {
    return {
      class: "JAY_SYSTEM",
      basis: "SELF_LEXEME_PLUS_SYSTEM_PURPOSE",
    };
  }

  if (hasSelfLexeme(normalizedTitle)) {
    return {
      class: "SELF_DERIVATIVE",
      basis: "SELF_LEXEME_DERIVATION",
    };
  }

  const words = titleWords(normalizedTitle);
  if (words.includes("WISDOM")) {
    return {
      class: "AMBIGUOUS",
      basis: "WISDOM_WITHOUT_JAY_BINDING",
    };
  }

  if (hasSelfContext(description)) {
    return {
      class: "SELF_CONTEXT",
      basis: "NON_SELF_TITLE_WITH_EXPLICIT_JAY_CONTEXT",
    };
  }

  return {
    class: "NON_SELF",
    basis: "NO_JAY_SELF_SIGNAL",
  };
}

function nullable(value) {
  return value === undefined || value === null || value === "" ? null : value;
}

function pick(...values) {
  for (const value of values) {
    const normalized = nullable(value);
    if (normalized !== null) return normalized;
  }
  return null;
}

function parseCoinAddress(item) {
  const direct = pick(item.coin_address, item.contract, item.address);
  if (direct) return direct;

  const match = String(item.zora_url || "").match(/coin\/base:(0x[a-fA-F0-9]{40})/u);
  return match ? match[1] : null;
}

function sourceCoordinates(item) {
  const coordinates = {
    zora_id: pick(item.zora_id, item.token_id, item.id),
    coin_address: parseCoinAddress(item),
    creator_address: pick(item.creator_address, item.creatorAddress),
    author: pick(item.author, item.author_handle, item.creator?.handle),
    created_at: pick(item.created_at, item.createdAt),
    block_number: pick(item.block_number, item.blockNumber),
    transaction_hash: pick(item.transaction_hash, item.tx_hash, item.txHash),
  };

  const coordinate_state = Object.fromEntries(
    Object.entries(coordinates).map(([key, value]) => [
      key,
      value === null ? "HOLD_NOT_OBSERVED" : "OBSERVED",
    ])
  );

  return { coordinates, coordinate_state };
}

function stableOccurrenceSort(a, b) {
  const aTime = a.coordinates.created_at || "";
  const bTime = b.coordinates.created_at || "";
  if (aTime !== bTime) return aTime.localeCompare(bTime);

  const aCoin = a.coordinates.coin_address || "";
  const bCoin = b.coordinates.coin_address || "";
  if (aCoin !== bCoin) return aCoin.localeCompare(bCoin);

  return a.source_index - b.source_index;
}

function loadItems(raw) {
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.items)) return parsed.items;
  throw new Error("Expected the source JSON to be an array or an object with items[].");
}

function buildIndex(items, sourceSha256) {
  const groups = new Map();
  const classCounts = Object.fromEntries(CLASSES.map((name) => [name, 0]));

  items.forEach((item, sourceIndex) => {
    const originalTitle = String(item?.title ?? "");
    const normalizedTitle = normalizeTitle(originalTitle);
    const titleSha256 = sha256Text(normalizedTitle);
    const classification = classifyTitle({
      normalizedTitle,
      description: item?.description || "",
    });
    const { coordinates, coordinate_state } = sourceCoordinates(item || {});

    classCounts[classification.class] += 1;

    const occurrence = {
      source_index: sourceIndex,
      original_title: originalTitle,
      description_context_used: classification.class === "SELF_CONTEXT",
      classification_basis: classification.basis,
      coordinates,
      coordinate_state,
    };

    if (!groups.has(titleSha256)) {
      groups.set(titleSha256, {
        original_titles: new Set(),
        normalized_title: normalizedTitle,
        title_sha256: titleSha256,
        class: classification.class,
        classification_basis: new Set(),
        occurrences: [],
      });
    }

    const group = groups.get(titleSha256);
    group.original_titles.add(originalTitle);
    group.classification_basis.add(classification.basis);
    group.occurrences.push(occurrence);

    // A normalized title should classify consistently from title alone. SELF_CONTEXT
    // can vary by description, so mixed context/non-context occurrences are surfaced
    // as AMBIGUOUS instead of silently promoting the whole title.
    if (group.class !== classification.class) {
      group.class = "AMBIGUOUS";
      group.classification_basis.add("MIXED_OCCURRENCE_CLASSIFICATION");
    }
  });

  const titleIndex = [...groups.values()]
    .map((group) => ({
      original_titles: [...group.original_titles].sort((a, b) => a.localeCompare(b)),
      normalized_title: group.normalized_title,
      title_sha256: group.title_sha256,
      class: group.class,
      classification_basis: [...group.classification_basis].sort((a, b) =>
        a.localeCompare(b)
      ),
      occurrence_count: group.occurrences.length,
      occurrences: group.occurrences.sort(stableOccurrenceSort),
    }))
    .sort((a, b) => {
      if (a.normalized_title !== b.normalized_title) {
        return a.normalized_title.localeCompare(b.normalized_title);
      }
      return a.title_sha256.localeCompare(b.title_sha256);
    });

  const distinctClassCounts = Object.fromEntries(
    CLASSES.map((name) => [
      name,
      titleIndex.filter((entry) => entry.class === name).length,
    ])
  );

  return {
    schema: SCHEMA,
    classifier_version: CLASSIFIER_VERSION,
    authority_created: AUTHORITY_CREATED,
    doctrine: {
      naming_continuity_is_ownership: false,
      ownership_is_authority: false,
      authority_is_identity: false,
      receipts_connect_observations: true,
      humans_remain_root: true,
    },
    source: {
      path: path.relative(repoRoot, INPUT_PATH).replaceAll(path.sep, "/"),
      sha256: sourceSha256,
      item_count: items.length,
    },
    normalization: [
      "Unicode NFKC",
      "collapse whitespace",
      "trim",
      "remove matching wrapping quotes",
      "uppercase comparison form",
      "preserve original title",
    ],
    classes: CLASSES,
    counts: {
      item_class_counts: classCounts,
      distinct_title_class_counts: distinctClassCounts,
      distinct_normalized_titles: titleIndex.length,
    },
    title_index: titleIndex,
  };
}

function main() {
  const raw = fs.readFileSync(INPUT_PATH, "utf8");
  const sourceSha256 = sha256Text(raw);
  const items = loadItems(raw);
  const result = buildIndex(items, sourceSha256);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        schema: result.schema,
        classifier_version: result.classifier_version,
        authority_created: result.authority_created,
        input: result.source.path,
        input_sha256: result.source.sha256,
        items: result.source.item_count,
        distinct_normalized_titles: result.counts.distinct_normalized_titles,
        output: path.relative(repoRoot, OUTPUT_PATH).replaceAll(path.sep, "/"),
      },
      null,
      2
    )
  );
}

main();
