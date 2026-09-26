#!/usr/bin/env python3
"""
reconcile_surfaces.py

Deterministic, read-only reconciler for Jason's Zora corpus.
Investigation: jsonwisdom/jay-zora-portal#16

Reads local JSON artifacts only. No RPC. No chain writes. No commits.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from collections import defaultdict
from pathlib import Path

CHAIN_ID_BASE = 8453
SURFACE_ORDER = ["857", "profile", "chain", "boss_brenda"]
MANIFEST_NAME = "reconciler_manifest.json"


def normalize_chain_id(value) -> int:
    if isinstance(value, int):
        return value
    s = str(value).strip().lower()
    if s == "base":
        return CHAIN_ID_BASE
    if s == "ethereum":
        return 1
    return int(s)


def object_key(chain_id, contract_address) -> str:
    address = str(contract_address).strip().lower()
    if not address.startswith("0x") or len(address) != 42:
        raise SystemExit(f"FATAL invalid contract address: {contract_address!r}")
    return f"{normalize_chain_id(chain_id)}:{address}"


def receipt_key(chain_id, tx_hash, log_index) -> str:
    tx = str(tx_hash).strip().lower()
    if not tx.startswith("0x") or len(tx) != 66:
        raise SystemExit(f"FATAL invalid tx hash: {tx_hash!r}")
    return f"{normalize_chain_id(chain_id)}:{tx}:{int(log_index)}"


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_surface_857(path: Path) -> dict[str, dict]:
    data = read_json(path)
    items = data.get("items") or data.get("coins") or data if isinstance(data, dict) else data
    if isinstance(items, dict):
        items = list(items.values())
    if not isinstance(items, list):
        raise SystemExit("FATAL 857 surface is not an array-like inventory")

    out = {}
    for row in items:
        if not row.get("contract"):
            continue
        k = object_key(row.get("chain", CHAIN_ID_BASE), row["contract"])
        if k in out:
            raise SystemExit(f"FATAL duplicate OBJECT_KEY in 857: {k}")
        out[k] = {"source": "857", "row": row}
    return out


def load_surface_profile(path_edges: Path) -> dict[str, dict]:
    data = read_json(path_edges)
    edges = data if isinstance(data, list) else data.get("edges", [])
    if not isinstance(edges, list):
        raise SystemExit("FATAL profile edges artifact is not a list")

    out = {}
    for edge in edges:
        node = edge.get("node", edge) if isinstance(edge, dict) else {}
        addr = node.get("address") or node.get("contractAddress")
        if not addr:
            continue
        k = object_key(node.get("chainId", CHAIN_ID_BASE), addr)
        if k in out:
            raise SystemExit(f"FATAL duplicate OBJECT_KEY in profile edges: {k}")
        out[k] = {"source": "profile", "node": node}
    return out


def load_surface_chain(path: Path) -> dict[str, dict]:
    data = read_json(path)
    rows = data if isinstance(data, list) else data.get("logs", [])
    if not isinstance(rows, list):
        raise SystemExit("FATAL chain creation artifact has no logs list")

    out = {}
    seen_receipts = set()
    for row in rows:
        k = object_key(row["chain_id"], row["contract_address"])
        rk = receipt_key(row["chain_id"], row["tx_hash"], row["log_index"])

        if rk in seen_receipts:
            raise SystemExit(f"FATAL duplicate CREATION_RECEIPT_KEY in normalized chain artifact: {rk}")
        seen_receipts.add(rk)

        if k not in out:
            out[k] = {
                "source": "chain",
                "receipts": [],
                "raw_occurrences": 0,
                "rows": [],
            }
        out[k]["receipts"].append(rk)
        out[k]["raw_occurrences"] += int(row.get("raw_occurrences", 1))
        out[k]["rows"].append(row)
    return out


def load_surface_d(path: Path) -> dict[str, dict]:
    data = read_json(path)
    if data.get("schema") != "JASON_ZORA_BOSS_BRENDA_OBJECTS_V1":
        raise SystemExit(f"FATAL SURFACE_D schema mismatch: {data.get('schema')}")

    out = {}
    for obj in data.get("objects", []):
        k = obj["object_key"]
        if k in out:
            raise SystemExit(f"FATAL duplicate OBJECT_KEY in Boss Brenda surface: {k}")
        receipts = []
        if obj.get("creation_receipt_key"):
            receipts.append(obj["creation_receipt_key"])
        out[k] = {
            "source": "boss_brenda",
            "receipts": receipts,
            "raw_occurrences": len(receipts),
            "relationships": obj.get("relationships", []),
            "evidence_refs": obj.get("evidence_refs", []),
        }
    return out


def classify(presence: dict[str, bool], missing_surfaces: set[str]) -> str:
    # Fail closed: a required surface that is missing means the row cannot be
    # classified as complete/absent across that surface.
    if missing_surfaces:
        return "UNRECONCILED"

    present = [k for k in SURFACE_ORDER if presence[k]]
    absent = [k for k in SURFACE_ORDER if not presence[k]]

    if not absent:
        return "IN_ALL_SURFACES"
    if present == ["857"]:
        return "IN_857_ONLY"
    if present == ["profile"]:
        return "IN_PROFILE_ONLY"
    if present == ["chain"]:
        return "IN_CHAIN_ONLY"
    if len(present) >= 2:
        return "MULTI_SURFACE_PARTIAL"
    return "UNRECONCILED"


def reconcile(surfaces: dict[str, dict[str, dict]]) -> tuple[list[dict], list[str]]:
    missing = [name for name in SURFACE_ORDER if name not in surfaces]
    missing_set = set(missing)

    all_keys = set()
    for surface in surfaces.values():
        all_keys |= set(surface.keys())

    rows = []
    for k in sorted(all_keys):
        presence = {name: (k in surfaces.get(name, {})) for name in SURFACE_ORDER}
        evidence_refs = [
            name for name in SURFACE_ORDER if presence[name]
        ]
        rows.append({
            "object_key": k,
            "in_857": presence["857"],
            "in_profile": presence["profile"],
            "in_chain": presence["chain"],
            "in_boss_brenda": presence["boss_brenda"],
            "delta_class": classify(presence, missing_set),
            "evidence_refs": evidence_refs,
        })
    return rows, missing


def reconcile_creation_receipts(chain: dict, boss: dict, prior: dict) -> dict:
    prior_rk = set()
    for obj in prior.values():
        prior_rk |= set(obj.get("receipts", []))

    new_rk = set()
    for obj in chain.values():
        new_rk |= set(obj.get("receipts", []))
    for obj in boss.values():
        new_rk |= set(obj.get("receipts", []))

    return {
        "reconfirmed": sorted(prior_rk & new_rk),
        "reconciliation_exception": sorted(prior_rk - new_rk),
        "new_discovery": sorted(new_rk - prior_rk),
    }


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def write_json(path: Path, payload) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def write_outputs(
    out_dir: Path,
    rows: list[dict],
    receipts: dict,
    inputs: list[Path],
    missing_surfaces: list[str],
    prior_missing: bool,
    chain_meta: dict,
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    write_json(out_dir / "reconciliation_table.json", rows)

    cols = [
        "object_key",
        "in_857",
        "in_profile",
        "in_chain",
        "in_boss_brenda",
        "delta_class",
    ]
    with (out_dir / "reconciliation_table.csv").open(
        "w", encoding="utf-8", newline=""
    ) as handle:
        writer = csv.DictWriter(handle, fieldnames=cols, lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({c: row[c] for c in cols})

    missing_objects = [
        row for row in rows if row["delta_class"] != "IN_ALL_SURFACES"
    ]
    write_json(out_dir / "missing_objects.json", missing_objects)

    counts = defaultdict(int)
    for row in rows:
        counts[row["delta_class"]] += 1

    closure_blocked = (
        bool(missing_surfaces)
        or prior_missing
        or bool(receipts["reconciliation_exception"])
        or bool(chain_meta.get("gaps"))
        or not bool(chain_meta.get("complete_event_set", False))
    )

    summary = {
        "counts": dict(sorted(counts.items())),
        "total_objects": len(rows),
        "missing_surfaces": missing_surfaces,
        "prior_probe_missing": prior_missing,
        "receipt_overlap": {
            "reconfirmed": len(receipts["reconfirmed"]),
            "reconciliation_exception": len(receipts["reconciliation_exception"]),
            "new_discovery": len(receipts["new_discovery"]),
        },
        "chain_gaps": chain_meta.get("gaps", []),
        "complete_event_set": bool(chain_meta.get("complete_event_set", False)),
        "closure_blocked": closure_blocked,
    }
    write_json(out_dir / "reconciliation_summary.json", summary)
    write_json(out_dir / "creation_receipt_overlap.json", receipts)

    out_files = sorted(
        p for p in out_dir.iterdir()
        if p.is_file() and p.name != MANIFEST_NAME
    )
    manifest = {
        "inputs": {
            str(p): sha256_file(p)
            for p in sorted(set(inputs), key=lambda x: str(x))
            if p.exists()
        },
        "outputs": {p.name: sha256_file(p) for p in out_files},
        "reconciler_sha256": sha256_file(Path(__file__)),
        "missing_surfaces": missing_surfaces,
        "prior_probe_missing": prior_missing,
    }
    write_json(out_dir / MANIFEST_NAME, manifest)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", type=Path, default=Path("."))
    ap.add_argument("--out", type=Path, default=Path("data/reconciliation"))
    ap.add_argument("--prior", type=Path)
    args = ap.parse_args()

    root = args.root
    surfaces: dict[str, dict] = {}
    inputs: list[Path] = []
    chain_meta = {}

    p857 = root / "data/live_zora_items.json"
    if p857.exists():
        surfaces["857"] = load_surface_857(p857)
        inputs.append(p857)

    pedges = root / "discovery/zora/latest_profile_coins_edges.json"
    if pedges.exists():
        surfaces["profile"] = load_surface_profile(pedges)
        inputs.append(pedges)

    pchain = root / "data/chain/creation_logs.json"
    if pchain.exists():
        surfaces["chain"] = load_surface_chain(pchain)
        inputs.append(pchain)
        raw_chain = read_json(pchain)
        if isinstance(raw_chain, dict):
            chain_meta = {
                "gaps": raw_chain.get("gaps", []),
                "complete_event_set": raw_chain.get("complete_event_set", False),
            }

    pboss = root / "data/zora/boss_brenda_objects_v1.json"
    if pboss.exists():
        surfaces["boss_brenda"] = load_surface_d(pboss)
        inputs.append(pboss)

    rows, missing_surfaces = reconcile(surfaces)
    for name in missing_surfaces:
        print(f"SURFACE_{name}_MISSING", file=sys.stderr)

    prior = {}
    prior_missing = True
    if args.prior and args.prior.exists():
        prior = load_surface_chain(args.prior)
        inputs.append(args.prior)
        prior_missing = False
    elif args.prior:
        print(f"PRIOR_PROBE_MISSING={args.prior}", file=sys.stderr)

    receipts = reconcile_creation_receipts(
        surfaces.get("chain", {}),
        surfaces.get("boss_brenda", {}),
        prior,
    )

    write_outputs(
        args.out,
        rows,
        receipts,
        inputs,
        missing_surfaces,
        prior_missing,
        chain_meta,
    )
    print(f"wrote {len(rows)} rows -> {args.out}")


if __name__ == "__main__":
    main()
