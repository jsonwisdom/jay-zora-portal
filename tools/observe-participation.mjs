import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const LEAVES_DIR = path.join(ROOT, "frontend", "public", "leaves");

const OBSERVED = {
  ens: "jaywisdom.base.eth",
  wallet: "0xA380552a27b0a5a2874Ea7AA52CAC09f542002E8",
  zoraCoin: "0x5e35e630356a1b24d1b45078918ea60ef98e915a",
};

function sha256(v) {
  return crypto.createHash("sha256").update(v).digest("hex");
}

function createParticipationReceipt({ action, txHash, grove, role, summary, proofUrl }) {
  const ts = new Date().toISOString();
  const idSeed = `${OBSERVED.ens}:${action}:${txHash}:${ts}`;
  const id = `pr-${sha256(idSeed).slice(0, 16)}`;

  return {
    id,
    title: `${role} Participation Receipt`,
    grove,
    status: "candidate",
    claim: `${OBSERVED.ens} produced a verifiable participation event through ${action}.`,
    summary,
    participation_type: "participation_receipt",
    subject: {
      ens: OBSERVED.ens,
      wallet: OBSERVED.wallet,
    },
    tx_hash: txHash,
    role,
    proof_links: [
      {
        label: "Base Transaction",
        url: `https://basescan.org/tx/${txHash}`,
        kind: "basescan"
      },
      {
        label: "Zora Ignition Surface",
        url: proofUrl,
        kind: "zora"
      }
    ],
    tags: ["participation", "receipt", role, grove],
    updated_at: ts,
  };
}

const sample = createParticipationReceipt({
  action: "zora_mint_observed",
  txHash: "0xproofplaceholder0000000000000000000000000000000000000000001",
  grove: "receipt-machine",
  role: "witness",
  summary: "Observed participation in the JaySpace flywheel ignition surface.",
  proofUrl: "https://zora.co/@jaywisdom",
});

const out = path.join(LEAVES_DIR, `${sample.id}.json`);
fs.writeFileSync(out, JSON.stringify(sample, null, 2) + "\n");

console.log(`PARTICIPATION_RECEIPT_CREATED=${sample.id}`);
console.log(`OUTPUT=${out}`);
