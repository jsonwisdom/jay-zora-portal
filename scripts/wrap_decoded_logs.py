#!/usr/bin/env python3
"""
wrap_decoded_logs.py

Normalize raw eth_getLogs responses from scripts/base_getlogs_window.sh into
object-level Zora creation receipts for the reconciler.

This intentionally reads the raw JSON because the existing pipe decoder drops
logIndex and does not emit the coin contract field required for stable receipt
identity.

Pinned event schema source:
ourzora/zora-protocol @ 32c2931a444b4405b107a49016dff0059b05b06f
packages/coins/src/interfaces/IZoraFactory.sol

For CoinCreated, CoinCreatedV4, and CreatorCoinCreated, the non-indexed coin
address is ABI data word 4.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

CHAIN_ID = 8453
ZORA_FACTORY = "0x777777751622c0d3258f214f9df38e35bf45baf3"

EVENT_TOPICS = {
    "0x3d1462491f7fa8396808c230d95c3fa60fd09ef59506d0b9bd1cf072d2a03f56": "CoinCreated",
    "0x2de436107c2096e039c98bbcc3c5a2560583738ce15c234557eecb4d3221aa81": "CoinCreatedV4",
    "0x74b670d628e152daa36ca95dda7cb0002d6ea7a37b55afe4593db7abd1515781": "CreatorCoinCreated",
}
TOPIC_PREFIX_TO_FULL = {topic[:10]: topic for topic in EVENT_TOPICS}
FILE_RE = re.compile(r"^logs_(\d+)_(\d+)_(0x[0-9a-fA-F]{8})\.json$")


def hex_int(value) -> int:
    if isinstance(value, int):
        return value
    return int(str(value), 16)


def data_word(data: str, index: int) -> str:
    h = data[2:] if data.startswith("0x") else data
    start = index * 64
    end = start + 64
    if len(h) < end:
        raise ValueError(f"data too short for word {index}: {len(h)} hex chars")
    return h[start:end]


def address_from_word(word: str) -> str:
    return "0x" + word[-40:].lower()


def receipt_key(tx_hash: str, log_index: int) -> str:
    return f"{CHAIN_ID}:{tx_hash.lower()}:{log_index}"


def validate_tiling(intervals, start: int, end: int):
    if not intervals:
        return False, [{"from": start, "to": end, "reason": "NO_RANGE_FILES"}]

    ordered = sorted(set(intervals))
    gaps = []
    cursor = start
    for a, b in ordered:
        if b < start or a > end:
            continue
        a = max(a, start)
        b = min(b, end)
        if a > cursor:
            gaps.append({"from": cursor, "to": a - 1, "reason": "RANGE_GAP"})
        if a < cursor:
            gaps.append({"from": a, "to": min(b, cursor - 1), "reason": "RANGE_OVERLAP"})
        cursor = max(cursor, b + 1)
    if cursor <= end:
        gaps.append({"from": cursor, "to": end, "reason": "RANGE_GAP"})
    return not gaps, gaps


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in-dir", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--scan-start", type=int, required=True)
    ap.add_argument("--scan-end", type=int, required=True)
    args = ap.parse_args()

    if args.scan_end < args.scan_start:
        raise SystemExit("FATAL scan_end < scan_start")

    by_receipt = {}
    gaps = []
    intervals_by_topic = {topic: [] for topic in EVENT_TOPICS}
    files_seen = []

    for path in sorted(args.in_dir.glob("logs_*.json")):
        match = FILE_RE.match(path.name)
        if not match:
            gaps.append({"path": str(path), "status": "UNRECOGNIZED_RAW_FILENAME"})
            continue

        start = int(match.group(1))
        end = int(match.group(2))
        prefix = match.group(3).lower()
        topic = TOPIC_PREFIX_TO_FULL.get(prefix)
        if not topic:
            gaps.append({
                "path": str(path),
                "status": "UNKNOWN_TOPIC_PREFIX",
                "topic_prefix": prefix,
            })
            continue

        intervals_by_topic[topic].append((start, end))
        files_seen.append(str(path))

        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            gaps.append({
                "path": str(path),
                "status": "PARSE_ERROR",
                "error": str(exc),
                "from": start,
                "to": end,
                "event_family": EVENT_TOPICS[topic],
            })
            continue

        if payload.get("error") is not None:
            gaps.append({
                "path": str(path),
                "status": "RPC_ERROR",
                "provider_response": payload.get("error"),
                "from": start,
                "to": end,
                "event_family": EVENT_TOPICS[topic],
            })
            continue

        result = payload.get("result")
        if not isinstance(result, list):
            gaps.append({
                "path": str(path),
                "status": "INVALID_RPC_RESULT",
                "from": start,
                "to": end,
                "event_family": EVENT_TOPICS[topic],
            })
            continue

        for log in result:
            topics = log.get("topics", [])
            topic0 = (topics[0] if topics else "").lower()
            if topic0 != topic:
                gaps.append({
                    "path": str(path),
                    "status": "TOPIC_MISMATCH",
                    "observed_topic0": topic0,
                    "expected_topic0": topic,
                    "tx_hash": log.get("transactionHash"),
                    "log_index": log.get("logIndex"),
                })
                continue

            factory = str(log.get("address", "")).lower()
            if factory != ZORA_FACTORY:
                gaps.append({
                    "path": str(path),
                    "status": "FOREIGN_EMITTER",
                    "factory_address": factory,
                    "tx_hash": log.get("transactionHash"),
                    "log_index": log.get("logIndex"),
                })
                continue

            try:
                coin = address_from_word(data_word(log.get("data", "0x"), 4))
                block_number = hex_int(log["blockNumber"])
                tx_index = hex_int(log["transactionIndex"])
                log_index = hex_int(log["logIndex"])
            except Exception as exc:
                gaps.append({
                    "path": str(path),
                    "status": "DECODE_ERROR",
                    "error": str(exc),
                    "tx_hash": log.get("transactionHash"),
                    "log_index": log.get("logIndex"),
                })
                continue

            tx_hash = str(log.get("transactionHash", "")).lower()
            rk = receipt_key(tx_hash, log_index)
            row = {
                "chain_id": CHAIN_ID,
                "contract_address": coin,
                "creation_receipt_key": rk,
                "creation_block": block_number,
                "creation_tx_index": tx_index,
                "tx_hash": tx_hash,
                "log_index": log_index,
                "factory_address": factory,
                "event_family": EVENT_TOPICS[topic],
                "topic0": topic,
                "query_roles": [EVENT_TOPICS[topic]],
                "raw_occurrences": 1,
                "source_files": [str(path)],
            }

            if rk in by_receipt:
                existing = by_receipt[rk]
                identity_fields = (
                    "chain_id",
                    "contract_address",
                    "creation_block",
                    "creation_tx_index",
                    "tx_hash",
                    "log_index",
                    "factory_address",
                    "event_family",
                )
                if any(existing[f] != row[f] for f in identity_fields):
                    raise SystemExit(f"FATAL conflicting duplicate receipt: {rk}")
                existing["raw_occurrences"] += 1
                if str(path) not in existing["source_files"]:
                    existing["source_files"].append(str(path))
                continue

            by_receipt[rk] = row

    coverage = {}
    complete_event_set = True
    for topic, family in EVENT_TOPICS.items():
        ok, range_gaps = validate_tiling(
            intervals_by_topic[topic], args.scan_start, args.scan_end
        )
        coverage[family] = {
            "topic0": topic,
            "range_coverage_complete": ok,
            "range_gaps": range_gaps,
        }
        if not ok:
            complete_event_set = False
            gaps.extend({
                **gap,
                "status": gap["reason"],
                "event_family": family,
            } for gap in range_gaps)

    if gaps:
        complete_event_set = False

    output = {
        "schema": "JASON_ZORA_CREATION_LOGS_V1",
        "chain_id": CHAIN_ID,
        "factory_address": ZORA_FACTORY,
        "scan_start": args.scan_start,
        "scan_end": args.scan_end,
        "declared_event_families": sorted(EVENT_TOPICS.values()),
        "complete_event_set": complete_event_set,
        "coverage": coverage,
        "gaps": gaps,
        "raw_files": files_seen,
        "logs": [by_receipt[key] for key in sorted(by_receipt)],
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(output, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )

    print(json.dumps({
        "logs": len(by_receipt),
        "gaps": len(gaps),
        "complete_event_set": complete_event_set,
        "out": str(args.out),
    }, sort_keys=True))


if __name__ == "__main__":
    main()
