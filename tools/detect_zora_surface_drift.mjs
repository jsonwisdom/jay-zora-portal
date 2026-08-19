import fs from "node:fs";
import crypto from "node:crypto";

const ORDER = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
const OBSERVED_STATES = new Set(["OBSERVED", "PARTIAL"]);

const FIELD_POLICY = {
  contract: { severity: "CRITICAL", disagreement: "CONFLICT" },
  chain_id: { severity: "CRITICAL", disagreement: "CONFLICT" },
  creator_address: { severity: "CRITICAL", disagreement: "INVERSION" },
  token_uri: { severity: "HIGH", disagreement: "REWRITE" },
  media_uri: { severity: "HIGH", disagreement: "REWRITE" },
  zora_name: { severity: "MEDIUM", disagreement: "MUTATION" },
  symbol: { severity: "MEDIUM", disagreement: "MUTATION" },
  description: { severity: "LOW", disagreement: "MUTATION" },
  created_at: { severity: "HIGH", disagreement: "CONFLICT" },
  market_cap: { severity: "LOW", disagreement: "CHANGED" },
  volume_24h: { severity: "LOW", disagreement: "CHANGED" },
  unique_holders: { severity: "LOW", disagreement: "CHANGED" },
  swap_count: { severity: "LOW", disagreement: "CHANGED" },
  comment_count: { severity: "LOW", disagreement: "CHANGED" }
};

const SURFACES = ["sdk", "rest", "html", "git", "drive", "prior_snapshot"];
const OBSERVER_NAME = {
  sdk: "SDK",
  rest: "REST",
  html: "HTML",
  git: "GIT",
  drive: "DRIVE",
  prior_snapshot: "PRIOR_SNAPSHOT"
};

function canonical(value) {
  if (typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value)) return value.toLowerCase();
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value && typeof value === "object") return JSON.stringify(value, Object.keys(value).sort());
  return value;
}

function maxSeverity(a, b) {
  return ORDER[a] >= ORDER[b] ? a : b;
}

function observedValue(surface, field) {
  if (!surface || !OBSERVED_STATES.has(surface.state)) return undefined;
  return surface.data?.[field];
}

function receiptsFor(input, surfaceNames) {
  return surfaceNames
    .map((name) => input.surfaces?.[name]?.receipt_ref)
    .filter(Boolean);
}

export function detectDrift(input) {
  if (!input?.object_key || !input?.expected?.contract || !input?.expected?.chain_id) {
    throw new Error("input requires object_key and expected contract/chain_id");
  }

  const diffs = [];
  let overallSeverity = "NONE";

  // Contract/chain mismatch against the deterministic root is immediate high-integrity drift.
  for (const field of ["contract", "chain_id"]) {
    const mismatching = [];
    for (const name of ["sdk", "rest", "html"]) {
      const value = observedValue(input.surfaces?.[name], field);
      if (value !== undefined && canonical(value) !== canonical(input.expected[field])) {
        mismatching.push([name, value]);
      }
    }
    if (mismatching.length) {
      const policy = FIELD_POLICY[field];
      overallSeverity = maxSeverity(overallSeverity, policy.severity);
      diffs.push({
        field_path: field,
        drift_type: "CONFLICT",
        severity: policy.severity,
        observers: mismatching.map(([n]) => OBSERVER_NAME[n]),
        values: Object.fromEntries(mismatching.map(([n, v]) => [n, v])),
        receipt_refs: receiptsFor(input, mismatching.map(([n]) => n)),
        note: "Observed contract/chain differs from deterministic object root."
      });
    }
  }

  // Compare structured/public surfaces field-by-field. Prior snapshot is treated as history, not a peer authority.
  for (const field of Object.keys(FIELD_POLICY)) {
    if (field === "contract" || field === "chain_id") continue;

    const currentEntries = [];
    for (const name of ["sdk", "rest", "html"]) {
      const value = observedValue(input.surfaces?.[name], field);
      if (value !== undefined && value !== null) currentEntries.push([name, canonical(value), value]);
    }

    const uniqueCurrent = [...new Set(currentEntries.map(([, c]) => JSON.stringify(c)))];
    if (uniqueCurrent.length > 1) {
      const policy = FIELD_POLICY[field];
      overallSeverity = maxSeverity(overallSeverity, policy.severity);
      diffs.push({
        field_path: field,
        drift_type: policy.disagreement === "INVERSION" ? "INVERSION" : "CONFLICT",
        severity: policy.severity,
        observers: currentEntries.map(([n]) => OBSERVER_NAME[n]),
        values: Object.fromEntries(currentEntries.map(([n, , raw]) => [n, raw])),
        receipt_refs: receiptsFor(input, currentEntries.map(([n]) => n)),
        note: "Current observer surfaces disagree."
      });
      continue;
    }

    const prior = observedValue(input.surfaces?.prior_snapshot, field);
    if (currentEntries.length && prior !== undefined && prior !== null) {
      const current = currentEntries[0][2];
      if (canonical(current) !== canonical(prior)) {
        const policy = FIELD_POLICY[field];
        overallSeverity = maxSeverity(overallSeverity, policy.severity);
        diffs.push({
          field_path: field,
          drift_type: policy.disagreement,
          severity: policy.severity,
          observers: [OBSERVER_NAME[currentEntries[0][0]], "PRIOR_SNAPSHOT"],
          values: { current, prior },
          receipt_refs: receiptsFor(input, [currentEntries[0][0], "prior_snapshot"]),
          note: "Current observation differs from the prior readback snapshot."
        });
      }
    }
  }

  // Missing required metadata is a HOLD, not deletion.
  const requiredMetadata = input.required_metadata || ["zora_name", "symbol", "creator_address", "created_at"];
  for (const field of requiredMetadata) {
    const present = ["sdk", "rest"].some((name) => {
      const v = observedValue(input.surfaces?.[name], field);
      return v !== undefined && v !== null && v !== "";
    });
    if (!present) {
      overallSeverity = maxSeverity(overallSeverity, "MEDIUM");
      diffs.push({
        field_path: field,
        drift_type: "MISSING",
        severity: "MEDIUM",
        observers: ["SDK", "REST"],
        values: {},
        receipt_refs: receiptsFor(input, ["sdk", "rest"]),
        note: "Required metadata not observed on either structured surface."
      });
    }
  }

  // Deletion is candidate-only unless BOTH structured observers report NOT_FOUND.
  const sdkNotFound = input.surfaces?.sdk?.state === "NOT_FOUND";
  const restNotFound = input.surfaces?.rest?.state === "NOT_FOUND";
  let deletionClaimState = "NONE";
  if (sdkNotFound && restNotFound) {
    deletionClaimState = "CORROBORATED_STRUCTURED_ABSENCE";
    overallSeverity = maxSeverity(overallSeverity, "HIGH");
    diffs.push({
      field_path: "$object",
      drift_type: "DELETION",
      severity: "HIGH",
      observers: ["SDK", "REST"],
      values: { sdk: "NOT_FOUND", rest: "NOT_FOUND" },
      receipt_refs: receiptsFor(input, ["sdk", "rest"]),
      note: "Structured observers both report object absence; this is not inferred from HTML/cache state."
    });
  } else if (sdkNotFound || restNotFound) {
    deletionClaimState = "CANDIDATE_ONLY";
  }

  const hasCriticalRootMismatch = diffs.some((d) =>
    ["contract", "chain_id"].includes(d.field_path) && d.severity === "CRITICAL"
  );
  const hasCreatorConflict = diffs.some((d) => d.field_path === "creator_address" && ["CONFLICT", "INVERSION"].includes(d.drift_type));
  const hasMissing = diffs.some((d) => d.drift_type === "MISSING");
  const hasConflict = diffs.some((d) => ["CONFLICT", "INVERSION"].includes(d.drift_type));
  const hasChange = diffs.some((d) => ["CHANGED", "MUTATION", "REWRITE", "REORDER", "DELETION"].includes(d.drift_type));

  let comparisonState = "MATCH";
  if (hasConflict || hasCriticalRootMismatch) comparisonState = "CONFLICT";
  else if (hasMissing) comparisonState = "MISSING";
  else if (hasChange) comparisonState = "CHANGED";

  let disposition = "PASS";
  if (hasCriticalRootMismatch) disposition = "REJECT";
  else if (hasCreatorConflict || hasConflict) disposition = "CONFLICT";
  else if (hasMissing || hasChange || deletionClaimState !== "NONE") disposition = "HOLD";

  const surfaceStates = Object.fromEntries(SURFACES.map((name) => {
    const s = input.surfaces?.[name] || {};
    return [name, {
      state: s.state || "NOT_ATTEMPTED",
      observed_at: s.observed_at || null,
      receipt_ref: s.receipt_ref || null
    }];
  }));

  const event = {
    schema_version: "zero-trust-zora.cross-surface-drift-event.v0.1",
    event_id: input.event_id || `DRIFT_${crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 16)}`,
    object_key: input.object_key,
    observed_at: input.observed_at || new Date().toISOString(),
    surface_states: surfaceStates,
    field_diffs: diffs,
    comparison_state: comparisonState,
    drift_severity: overallSeverity,
    drift_disposition: disposition,
    deletion_claim_state: deletionClaimState,
    no_fault_inference: true,
    fraud_inference: false,
    authority_created: false
  };

  return event;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("usage: node tools/detect_zora_surface_drift.mjs <input.json> [output.json]");
    process.exit(2);
  }
  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const event = detectDrift(input);
  const out = JSON.stringify(event, null, 2) + "\n";
  if (process.argv[3]) fs.writeFileSync(process.argv[3], out);
  else process.stdout.write(out);
  if (event.drift_disposition === "REJECT" || event.drift_disposition === "CONFLICT") process.exitCode = 1;
}
