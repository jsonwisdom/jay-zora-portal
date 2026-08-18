import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const WORKFLOWS = path.join(ROOT, ".github", "workflows");
const CODEOWNERS = path.join(ROOT, ".github", "CODEOWNERS");
const DEFAULT_BRANCH = "live-zora-ingestion";

const failures = [];
const observations = [];

function fail(code, detail) {
  failures.push({ code, detail });
}

function observe(code, detail) {
  observations.push({ code, detail });
}

if (!fs.existsSync(CODEOWNERS)) {
  fail("CODEOWNERS_MISSING", ".github/CODEOWNERS is required for governance-sensitive path ownership.");
} else {
  const text = fs.readFileSync(CODEOWNERS, "utf8");
  for (const required of ["/.github/", "/data/", "/frontend/public/leaves/", "/frontend/public/proofs/"]) {
    if (!text.includes(required)) {
      fail("CODEOWNERS_SCOPE_MISSING", `Missing CODEOWNERS scope: ${required}`);
    }
  }
  observe("CODEOWNERS_PRESENT", ".github/CODEOWNERS exists and names core governance/evidence paths.");
}

const workflowFiles = fs.readdirSync(WORKFLOWS)
  .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
  .sort();

for (const name of workflowFiles) {
  const file = path.join(WORKFLOWS, name);
  const text = fs.readFileSync(file, "utf8");
  const hasPullRequest = /(^|\n)\s*pull_request\s*:/m.test(text);
  const hasContentsWrite = /contents\s*:\s*write/m.test(text);
  const pushesCanonical = new RegExp(`git\\s+push[^\\n]*${DEFAULT_BRANCH.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}`, "m").test(text);
  const hardCheckoutCanonical = new RegExp(`ref\\s*:\\s*${DEFAULT_BRANCH.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}`, "m").test(text);

  if (hasPullRequest && hasContentsWrite) {
    fail("PR_WORKFLOW_HAS_WRITE_TOKEN", `${name} handles pull_request with contents: write.`);
  }
  if (hasPullRequest && pushesCanonical) {
    fail("PR_WORKFLOW_PUSHES_CANONICAL", `${name} can push to ${DEFAULT_BRANCH} from a pull_request-triggered workflow.`);
  }
  if (hasPullRequest && hardCheckoutCanonical) {
    fail("PR_WORKFLOW_IGNORES_HEAD", `${name} handles pull_request but hard-checks out ${DEFAULT_BRANCH} instead of the PR head.`);
  }
}

const exportWorkflow = path.join(WORKFLOWS, "export-zora-inventory.yml");
if (!fs.existsSync(exportWorkflow)) {
  fail("EXPORT_WORKFLOW_MISSING", "Expected export-zora-inventory.yml.");
} else {
  const text = fs.readFileSync(exportWorkflow, "utf8");
  if (/(^|\n)\s*pull_request\s*:/m.test(text)) {
    fail("EXPORT_WRITER_LISTENS_TO_PR", "Export writer must not trigger on pull_request.");
  }
  if (!/contents\s*:\s*write/m.test(text)) {
    fail("EXPORT_WRITER_MISSING_WRITE_SCOPE", "Canonical export writer requires explicit contents: write.");
  }
  observe("EXPORT_WRITER_EVENT_BOUND", "Export writer is limited to canonical push/manual dispatch events.");
}

const prWorkflow = path.join(WORKFLOWS, "validate-pr-governance.yml");
if (!fs.existsSync(prWorkflow)) {
  fail("READ_ONLY_PR_VALIDATOR_MISSING", "Expected validate-pr-governance.yml.");
} else {
  const text = fs.readFileSync(prWorkflow, "utf8");
  if (!/(^|\n)\s*pull_request\s*:/m.test(text)) {
    fail("PR_VALIDATOR_EVENT_MISSING", "PR validator must listen to pull_request.");
  }
  if (!/contents\s*:\s*read/m.test(text)) {
    fail("PR_VALIDATOR_NOT_READ_ONLY", "PR validator must declare contents: read.");
  }
  if (/contents\s*:\s*write/m.test(text)) {
    fail("PR_VALIDATOR_WRITE_SCOPE", "PR validator must not have contents: write.");
  }
  if (!/github\.event\.pull_request\.head\.sha/.test(text)) {
    fail("PR_VALIDATOR_NOT_EXACT_HEAD", "PR validator must checkout github.event.pull_request.head.sha.");
  }
  observe("PR_VALIDATOR_EXACT_HEAD", "Read-only PR validator is bound to the exact pull-request head SHA.");
}

const result = {
  schema: "JAY_ZORA_GITHUB_GOVERNANCE_CHECK_V1",
  default_branch: DEFAULT_BRANCH,
  workflow_count: workflowFiles.length,
  observations,
  failures,
  terminal: failures.length ? "HOLD_GOVERNANCE" : "PASS_GOVERNANCE",
  authority_created: false,
};

console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
