import fs from "node:fs";
import { detectDrift } from "./detect_zora_surface_drift.mjs";

const path = process.argv[2] || "tests/mildenhall/cross_surface_drift_cases_v0_1.json";
const fixture = JSON.parse(fs.readFileSync(path, "utf8"));
let failed = 0;

for (const test of fixture.cases) {
  const input = {
    event_id: test.id,
    object_key: fixture.object_key,
    expected: fixture.expected,
    observed_at: "2026-08-19T03:00:00Z",
    ...test.input
  };
  const actual = detectDrift(input);
  const checks = [
    ["drift_disposition", test.expected_disposition],
    ["comparison_state", test.expected_comparison]
  ];
  if (test.expected_deletion_claim_state) {
    checks.push(["deletion_claim_state", test.expected_deletion_claim_state]);
  }

  const problems = checks.filter(([field, expected]) => actual[field] !== expected);
  if (problems.length) {
    failed += 1;
    console.error(JSON.stringify({
      test: test.id,
      status: "FAIL",
      problems: problems.map(([field, expected]) => ({field, expected, actual: actual[field]})),
      event: actual
    }, null, 2));
  } else {
    console.log(JSON.stringify({
      test: test.id,
      status: "PASS",
      disposition: actual.drift_disposition,
      comparison: actual.comparison_state,
      severity: actual.drift_severity,
      deletion_claim_state: actual.deletion_claim_state
    }));
  }
}

if (failed) {
  console.error(`${failed} drift conformance test(s) failed`);
  process.exit(1);
}

console.log(`PASS: ${fixture.cases.length} drift conformance tests`);
