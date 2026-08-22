import fs from "fs";
import crypto from "crypto";
import path from "path";

const inventoryPath = process.env.ZORA_INVENTORY || "data/live_zora_items.json";
const registryPath = process.env.ZORA_WISDOM_REGISTRY || "config/zora_wisdom_family_v0_1.json";
const outputDir = process.env.ZORA_WISDOM_OUTPUT_DIR || "reports/zora_wisdom";
const batchDir = process.env.ZORA_WISDOM_BATCH_DIR || "batches/zora_wisdom";
const model = process.env.OPENAI_MODEL || "gpt-5";

const inventoryBytes = fs.readFileSync(inventoryPath);
const registryBytes = fs.readFileSync(registryPath);
const inventory = JSON.parse(inventoryBytes.toString("utf8"));
const registry = JSON.parse(registryBytes.toString("utf8"));

if (!Array.isArray(inventory)) throw new Error("inventory must be an array");
if (!Array.isArray(registry.explicit_contract_routes)) throw new Error("registry routes missing");

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(batchDir, { recursive: true });

const lower = (value) => String(value || "").toLowerCase();
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const now = new Date().toISOString();

const explicit = new Map(
  registry.explicit_contract_routes.map((entry) => [lower(entry.contract), entry])
);

function keywordCandidate(row) {
  const haystack = lower([row.title, row.description, row.themes?.join(" "), row.query_aliases?.join(" ")].filter(Boolean).join(" "));
  const matches = [];
  for (const [familyClass, keywords] of Object.entries(registry.discovery_candidate_keywords || {})) {
    const hit = (keywords || []).filter((word) => haystack.includes(lower(word)));
    if (hit.length) matches.push({ family_class: familyClass, keywords: hit });
  }
  if (!matches.length) return null;
  return { family_class: matches[0].family_class, matches };
}

function publicImageUrl(value) {
  return /^https:\/\//i.test(String(value || ""));
}

function objectKey(row) {
  const chainId = lower(row.chain) === "base" ? 8453 : null;
  const contract = lower(row.contract);
  return chainId && /^0x[a-f0-9]{40}$/.test(contract)
    ? `eip155:${chainId}/erc20:${contract}`
    : null;
}

const scoutRecords = [];
const batchRequests = [];
const observedContracts = new Set();

for (let i = 0; i < inventory.length; i += 1) {
  const row = inventory[i];
  const contract = lower(row.contract);
  if (contract) observedContracts.add(contract);

  const route = explicit.get(contract);
  const candidate = route ? null : keywordCandidate(row);
  const familyClass = route?.family_class || candidate?.family_class || "OTHER_DISCOVERY_CANDIDATE";
  const routeBasis = route ? "EXPLICIT_CONTRACT_REGISTRY" : candidate ? "DISCOVERY_KEYWORD_CANDIDATE" : "UNROUTED";
  const routeState = route ? "BOUND" : candidate ? "CANDIDATE" : "HOLD";
  const key = objectKey(row);

  const scout = {
    schema: "zora-wisdom.scout-event.v0.1",
    record_type: "ZORA_SCOUT_OBJECT",
    observed_at: now,
    inventory_index: i + 1,
    object_key: key,
    source: {
      source_type: "ZORA_SDK_NORMALIZED_INVENTORY",
      source_repository: "jsonwisdom/jay-zora-portal",
      source_path: inventoryPath,
      contract_address: row.contract || null,
      title: row.title || null,
      description: row.description || "",
      zora_url: row.zora_url || null,
      image_uri: row.image_uri || null,
      created_at: row.created_at || null
    },
    routing: {
      family_class: familyClass,
      route_basis: routeBasis,
      route_state: routeState,
      registry_id: route?.registry_id || null,
      explicit_label: route?.label || null,
      reviewers: route?.reviewers || [],
      discovery_matches: candidate?.matches || [],
      cross_repo_refs: route?.cross_repo_refs || []
    },
    gates: {
      image_available_for_visual_batch: publicImageUrl(row.image_uri),
      explicit_canon_binding_present: false,
      canon_promotion_allowed: false
    },
    invariants: [
      "ZORA_OBJECT != EXTERNAL_FACT",
      "DISCOVERY_KEYWORD != CANON",
      "IMAGE_OBSERVATION != HUMAN_IDENTITY",
      "MARKET_ACTIVITY != QUALITY",
      "AUTHORITY_CREATED = FALSE"
    ]
  };
  scoutRecords.push(scout);

  if (!key || !publicImageUrl(row.image_uri)) continue;

  const visualSchema = {
    type: "object",
    additionalProperties: false,
    required: ["visible_text", "scene_elements", "layout_signals", "style_signals", "uncertainties", "gray_baby", "leahprime187", "deezer187", "boxdee"],
    properties: {
      visible_text: { type: "array", items: { type: "string" } },
      scene_elements: { type: "array", items: { type: "string" } },
      layout_signals: { type: "array", items: { type: "string" } },
      style_signals: { type: "array", items: { type: "string" } },
      uncertainties: { type: "array", items: { type: "string" } },
      gray_baby: { type: "array", items: { type: "string" } },
      leahprime187: { type: "array", items: { type: "string" } },
      deezer187: { type: "array", items: { type: "string" } },
      boxdee: { type: "array", items: { type: "string" } }
    }
  };

  const prompt = [
    "Analyze only what is visually observable in this Zora image.",
    "Do not identify people, infer a real person's identity, infer military rank, affiliation, clearance, authority, intent, guilt, or endorsement from pixels.",
    "Separate visible text from metadata supplied outside the image.",
    "GRAY_BABY: list gaps, ambiguity, missing receipts, and anything that blocks fake green.",
    "LEAHPRIME187: explain the visible artifact for 187th-context replay without claiming real-person or military authority.",
    "DEEZER187: check visual/story continuity and public-vs-personal-vs-private boundaries without identity binding.",
    "BOXDEE: state what should be frozen and what reverse-replay questions the artifact raises.",
    `Routing class: ${familyClass}. Route basis: ${routeBasis}.`,
    `Zora title metadata (not visual truth): ${row.title || ""}`,
    `Contract: ${row.contract}`
  ].join("\n");

  batchRequests.push({
    custom_id: `zora-${contract.slice(2)}`,
    method: "POST",
    url: "/v1/responses",
    body: {
      model,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: row.image_uri, detail: "auto" }
        ]
      }],
      text: {
        format: {
          type: "json_schema",
          name: "zora_visual_intel",
          strict: true,
          schema: visualSchema
        }
      }
    }
  });
}

for (const route of registry.explicit_contract_routes) {
  const contract = lower(route.contract);
  if (observedContracts.has(contract)) continue;
  scoutRecords.push({
    schema: "zora-wisdom.scout-event.v0.1",
    record_type: "EXPLICIT_REGISTRY_OBJECT_NOT_IN_CURRENT_INVENTORY",
    observed_at: now,
    object_key: /^0x[a-f0-9]{40}$/.test(contract) ? `eip155:8453/erc20:${contract}` : null,
    source: {
      source_type: "EXPLICIT_CONTRACT_REGISTRY",
      contract_address: route.contract,
      title: route.label || null
    },
    routing: {
      family_class: route.family_class,
      route_basis: "EXPLICIT_CONTRACT_REGISTRY",
      route_state: "HOLD",
      registry_id: route.registry_id,
      reviewers: route.reviewers || [],
      cross_repo_refs: route.cross_repo_refs || []
    },
    gap: "OBJECT_NOT_PRESENT_IN_CURRENT_NORMALIZED_PROFILE_INVENTORY",
    next_gate: "ZORA_GETCOIN_OR_REST_READBACK_BY_CONTRACT",
    canon_promotion_allowed: false,
    authority_created: false
  });
}

const scoutPath = path.join(outputDir, "zora_scout_events.jsonl");
const batchPath = path.join(batchDir, "visual_intel.requests.jsonl");
const manifestPath = path.join(outputDir, "zora_wisdom_batch.manifest.json");

fs.writeFileSync(scoutPath, scoutRecords.map((x) => JSON.stringify(x)).join("\n") + "\n");
fs.writeFileSync(batchPath, batchRequests.map((x) => JSON.stringify(x)).join("\n") + (batchRequests.length ? "\n" : ""));

const scoutBytes = fs.readFileSync(scoutPath);
const batchBytes = fs.readFileSync(batchPath);
const manifest = {
  schema: "ZORA_WISDOM_BATCH_MANIFEST_V0_1",
  generated_at: now,
  source_inventory_path: inventoryPath,
  source_inventory_sha256: sha256(inventoryBytes),
  registry_path: registryPath,
  registry_sha256: sha256(registryBytes),
  scout_jsonl_path: scoutPath,
  scout_jsonl_sha256: sha256(scoutBytes),
  scout_record_count: scoutRecords.length,
  openai_batch_request_path: batchPath,
  openai_batch_request_sha256: sha256(batchBytes),
  openai_batch_request_count: batchRequests.length,
  openai_model_label: model,
  openai_submission_performed: false,
  zora_publication_performed: false,
  canon_promotion_performed: false,
  authority_created: false,
  boundary: "This workflow prepares replayable scout and visual-intelligence inputs. It does not submit OpenAI Batch jobs, publish to Zora, sign transactions, trade, bind human identity, or promote canon."
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(JSON.stringify(manifest, null, 2));
