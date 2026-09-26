#!/usr/bin/env python3
"""
adapt_boss_brenda_to_v1.py

Normalize observed Boss Brenda artifacts into
JASON_ZORA_BOSS_BRENDA_OBJECTS_V1.

Important membrane:
RELATED_ADDRESS != ZORA_OBJECT
TRANSFER_SEEN != CREATED_BY_JASON

Only addresses that Boss Brenda already treats as candidate/known contracts are
promoted to object rows. Wallet counterparties and holders remain evidence.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

SCHEMA = "JASON_ZORA_BOSS_BRENDA_OBJECTS_V1"
CHAIN_ID = 8453


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def normalize_address(value):
    if not value:
        return None
    value = str(value).strip().lower()
    if value.startswith("0x") and len(value) == 42:
        return value
    return None


def add_object(objects, address, source_path, relation, evidence=None):
    address = normalize_address(address)
    if not address:
        return

    key = f"{CHAIN_ID}:{address}"
    obj = objects.setdefault(
        key,
        {
            "object_key": key,
            "chain_id": CHAIN_ID,
            "contract_address": address,
            "creation_receipt_key": None,
            "creation_block": None,
            "creation_tx_index": None,
            "tx_hash": None,
            "log_index": None,
            "factory_address": None,
            "event_family": None,
            "relationships": [],
            "evidence_refs": [],
        },
    )

    rel = {"relation": relation, "source_path": str(source_path)}
    if evidence is not None:
        rel["evidence"] = evidence
    if rel not in obj["relationships"]:
        obj["relationships"].append(rel)

    ref = {"path": str(source_path), "sha256": sha256_file(source_path)}
    if ref not in obj["evidence_refs"]:
        obj["evidence_refs"].append(ref)


def add_relationship_to_existing(objects, address, relation, source_path, evidence=None):
    address = normalize_address(address)
    if not address:
        return
    key = f"{CHAIN_ID}:{address}"
    obj = objects.get(key)
    if not obj:
        return
    rel = {"relation": relation, "source_path": str(source_path)}
    if evidence is not None:
        rel["evidence"] = evidence
    if rel not in obj["relationships"]:
        obj["relationships"].append(rel)


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def ingest_file(path: Path, objects: dict, gaps: list):
    try:
        data = read_json(path)
    except Exception as exc:
        gaps.append({
            "path": str(path),
            "status": "PARSE_ERROR",
            "error": str(exc),
        })
        return

    name = path.name

    if name == "jay-contract-graph.json":
        for row in data.get("graph", []):
            # graph contract is the contract whose Transfer logs were queried;
            # it is a candidate contract surface, not a counterparty address.
            add_object(
                objects,
                row.get("contract"),
                path,
                row.get("relationship", "GRAPH_RELATIONSHIP"),
                {
                    "first_seen_tx": row.get("first_seen_tx"),
                    "first_seen_block": row.get("first_seen_block"),
                },
            )
        return

    if name.startswith("EV-BBC-008-CREATOR-LANE"):
        root = data.get("root")
        add_object(
            objects,
            root,
            path,
            "CREATOR_LANE_ROOT",
            {
                "birth_block": data.get("birth_block"),
                "transfer_logs_found": data.get("transfer_logs_found"),
                "creation_tx": data.get("creation_tx"),
                "first_10_holders": data.get("first_10_holders", []),
                "first_10_transfer_txs": data.get("first_10_transfer_txs", []),
            },
        )
        return

    if name.startswith("EV-BBC-003A-WALLET-JAYWISDOM-SCAN"):
        token = data.get("jaywisdom_token")
        add_object(
            objects,
            token,
            path,
            "WALLET_SCAN_TARGET_TOKEN",
            {
                "wallet": data.get("wallet"),
                "scan_range": data.get("scan_range"),
                "entries_count": data.get("entries_count"),
            },
        )
        # Transaction from/to counterparties remain evidence on the known token;
        # they are not emitted as corpus objects.
        if token:
            for row in data.get("entries", []):
                add_relationship_to_existing(
                    objects,
                    token,
                    "WALLET_TX_OBSERVATION",
                    path,
                    {
                        "block": row.get("block"),
                        "tx_hash": row.get("tx_hash"),
                        "from": row.get("from"),
                        "to": row.get("to"),
                        "touches_jaywisdom_token": row.get("touches_jaywisdom_token"),
                    },
                )
        return

    if name == "boss-brenda-zora-registry.json":
        gaps.append({
            "path": str(path),
            "status": "SUMMARY_ONLY",
            "reason": "No object-level creation records in this artifact",
        })
        return

    gaps.append({
        "path": str(path),
        "status": "UNRECOGNIZED_BOSS_BRENDA_ARTIFACT",
    })


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in-dir", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    objects = {}
    gaps = []
    inputs = []

    if args.in_dir.exists():
        for path in sorted(args.in_dir.rglob("*.json")):
            inputs.append(path)
            ingest_file(path, objects, gaps)
    else:
        gaps.append({
            "path": str(args.in_dir),
            "status": "SURFACE_D_INPUT_DIR_MISSING",
        })

    result = {
        "schema": SCHEMA,
        "chain_id": CHAIN_ID,
        "source_repo": "jsonwisdom/boss-brenda-crawler",
        "source_ref": "main",
        "objects": [objects[key] for key in sorted(objects)],
        "gaps": gaps,
        "input_hashes": {
            str(path): sha256_file(path)
            for path in inputs
        },
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )

    print(json.dumps({
        "schema": SCHEMA,
        "objects": len(objects),
        "gaps": len(gaps),
        "output": str(args.out),
    }, sort_keys=True))


if __name__ == "__main__":
    main()
