#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const CONTRACT = "0x3de98ce63339443e209e948915b3a1782bcc64fc";
const CHAIN_ID = 8453;
const CREATION_BLOCK = 50746398n;
const CID = "bafybeifszopcgq6tkpzu5nfahghc4y2qjktxcjz2iedo5rhvhmn7fhg6ga";
const EXPECTED_URI = `ipfs://${CID}`;

const ABI_STATE = process.env.ABI_STATE || "MISSING";
const ABI_JSON = process.env.ABI_JSON || "";
const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const IPFS_GATEWAY = process.env.IPFS_GATEWAY || "https://ipfs.io";
const EXPECTED_SHA256 = (process.env.EXPECTED_SHA256 || "").toLowerCase().replace(/^0x/, "");
const OUT_DIR = process.env.OUT_DIR || "receipts/zora/runtime/3de98ce6";

function die(code, message, extra = {}) {
  const out = {
    protocol: "replay-law-v0.1",
    contract: CONTRACT,
    chain_id: CHAIN_ID,
    state: "HOLD",
    error: code,
    message,
    authority_created: false,
    ...extra,
  };
  console.error(JSON.stringify(out, null, 2));
  process.exit(1);
}

function normalizeAbi(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.abi)) return parsed.abi;
  if (parsed && typeof parsed.result === "string") {
    const nested = JSON.parse(parsed.result);
    if (Array.isArray(nested)) return nested;
  }
  throw new Error("ABI JSON must be an ABI array, {abi:[...]}, or explorer {result:\"[...]\"}");
}

function hasContractUri(abi) {
  return abi.some(
    (x) =>
      x?.type === "function" &&
      x?.name === "contractURI" &&
      Array.isArray(x?.inputs) &&
      x.inputs.length === 0
  );
}

function typeOfJson(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function decodeMetadataSchema(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("Top-level metadata must be a JSON object");
  }

  const known = [
    "name",
    "description",
    "image",
    "image_url",
    "animation_url",
    "external_url",
    "content",
    "properties",
    "attributes",
    "mime_type",
    "media",
  ];

  const field_types = Object.fromEntries(
    Object.entries(metadata).map(([k, v]) => [k, typeOfJson(v)])
  );

  const decoded = {};
  for (const key of known) {
    if (Object.prototype.hasOwnProperty.call(metadata, key)) decoded[key] = metadata[key];
  }

  return {
    top_level: "object",
    keys: Object.keys(metadata).sort(),
    field_types,
    decoded_known_fields: decoded,
    unknown_fields: Object.keys(metadata).filter((k) => !known.includes(k)).sort(),
  };
}

async function readAbi() {
  if (ABI_STATE !== "VERIFIED") {
    die("ERR_NO_VERIFIED_ABI", "ABI_STATE must equal VERIFIED before any eth_call", {
      abi_state: ABI_STATE,
      eth_calls_blocked: true,
    });
  }
  if (!ABI_JSON) {
    die("ERR_ABI_PATH", "Set ABI_JSON to the verified historical ABI file", {
      abi_state: ABI_STATE,
      eth_calls_blocked: true,
    });
  }

  let abi;
  try {
    abi = normalizeAbi(JSON.parse(await readFile(ABI_JSON, "utf8")));
  } catch (error) {
    die("ERR_ABI_PARSE", String(error?.message || error), { eth_calls_blocked: true });
  }

  if (!hasContractUri(abi)) {
    die("ERR_NO_CONTRACT_URI_METHOD", "Verified ABI does not expose contractURI()", {
      eth_calls_blocked: true,
    });
  }
  return abi;
}

function gatewayUrl() {
  const base = IPFS_GATEWAY.replace(/\/$/, "");
  return base.endsWith("/ipfs") ? `${base}/${CID}` : `${base}/ipfs/${CID}`;
}

async function fetchRawBytes() {
  const url = gatewayUrl();
  const response = await fetch(url, {
    headers: { accept: "application/json, application/octet-stream;q=0.9, */*;q=0.1" },
    redirect: "follow",
  });
  if (!response.ok) {
    die("ERR_URI_UNREACHABLE", `Gateway returned HTTP ${response.status}`, {
      pointer: EXPECTED_URI,
      gateway_url: url,
      http_status: response.status,
    });
  }
  const raw = Buffer.from(await response.arrayBuffer());
  return {
    raw,
    url,
    status: response.status,
    content_type: response.headers.get("content-type"),
  };
}

async function readContractUri(client, abi, blockNumber) {
  try {
    const value = await client.readContract({
      address: CONTRACT,
      abi,
      functionName: "contractURI",
      blockNumber,
    });
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: String(error?.shortMessage || error?.message || error) };
  }
}

async function main() {
  const abi = await readAbi();

  const fetched = await fetchRawBytes();
  const sha256 = createHash("sha256").update(fetched.raw).digest("hex");

  let text;
  let metadata;
  let schema;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(fetched.raw);
    metadata = JSON.parse(text);
    schema = decodeMetadataSchema(metadata);
  } catch (error) {
    die("ERR_METADATA_JSON", String(error?.message || error), {
      pointer: EXPECTED_URI,
      raw_bytes_length: fetched.raw.length,
      sha256,
    });
  }

  const client = createPublicClient({ chain: base, transport: http(BASE_RPC_URL) });

  // Replay at the creation block, then compare to current state.
  const creationRead = await readContractUri(client, abi, CREATION_BLOCK);
  const latestRead = await readContractUri(client, abi, undefined);

  const creationUriMatch = creationRead.ok && creationRead.value === EXPECTED_URI;
  const latestUriMatch = latestRead.ok && latestRead.value === EXPECTED_URI;
  const expectedHashMatch = EXPECTED_SHA256 ? sha256 === EXPECTED_SHA256 : null;

  let transition = "HOLD";
  if (creationUriMatch && latestUriMatch && expectedHashMatch !== false) {
    transition = EXPECTED_SHA256 ? "FULL_MATCH_STRICT" : "MATCH_CONTENT_BOUND_HASH_OBSERVED";
  } else if (creationUriMatch && expectedHashMatch !== false) {
    transition = "MATCH_AT_CREATION_WITH_CURRENT_DELTA_OR_HOLD";
  }

  const receipt = {
    protocol: "replay-law-v0.1",
    receipt_id: "RRR-ZORA-3DE98CE6-METADATA-V001",
    contract: CONTRACT,
    chain_id: CHAIN_ID,
    creation_block: Number(CREATION_BLOCK),
    pointer: EXPECTED_URI,
    gateway: {
      url: fetched.url,
      http_status: fetched.status,
      content_type: fetched.content_type,
    },
    raw_bytes_length: fetched.raw.length,
    sha256,
    expected_sha256: EXPECTED_SHA256 || null,
    sha256_match: expectedHashMatch,
    hash_state: EXPECTED_SHA256 ? (expectedHashMatch ? "MATCH" : "DELTA") : "OBSERVED_NOT_PRECOMMITTED",
    json_state: "PARSED",
    schema_decode: schema,
    contract_uri: {
      creation_block: creationRead,
      latest: latestRead,
      expected: EXPECTED_URI,
      creation_match: creationUriMatch,
      latest_match: latestUriMatch,
    },
    transition,
    invariants: {
      metadata_is_human_identity: false,
      metadata_is_authorization: false,
      metadata_is_endorsement: false,
      authority_created: false,
      no_fake_green: true,
    },
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, "metadata.raw"), fetched.raw);
  await writeFile(path.join(OUT_DIR, "metadata.json"), JSON.stringify(metadata, null, 2) + "\n");
  await writeFile(path.join(OUT_DIR, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");

  console.log(JSON.stringify(receipt, null, 2));

  if (transition === "HOLD" || expectedHashMatch === false) process.exitCode = 2;
}

main().catch((error) => die("ERR_UNHANDLED", String(error?.stack || error)));
