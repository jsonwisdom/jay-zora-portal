#!/usr/bin/env python3
import argparse
import csv
import json
import os
import pathlib
import sys
import time
import urllib.parse
import urllib.request

FACTORY = "0x777777751622c0d3258f214F9DF38E35BF45baF3"
TOPIC0 = "0x2de436107c2096e039c98bbcc3c5a2560583738ce15c234557eecb4d3221aa81"
WALLET = "0x829AdfEdBe565F9885a7eA6Bc78912acAef055E2"
CHAIN_ID = "8453"
API = "https://api.etherscan.io/v2/api"

def pad_topic(addr: str) -> str:
    h = addr.lower().removeprefix("0x")
    if len(h) != 40:
        raise ValueError(f"bad address: {addr}")
    return "0x" + ("0" * 24) + h

def decode_coin(data: str) -> str:
    h = data[2:] if data.startswith("0x") else data
    start = 4 * 64
    word = h[start:start + 64]
    if len(word) != 64:
        raise ValueError("CoinCreatedV4 data too short for data[4]")
    return "0x" + word[-40:].lower()

def norm_int(v):
    if v is None or v == "":
        return None
    s = str(v)
    return int(s, 16) if s.startswith("0x") else int(s)

def fetch_json(params, retries=6):
    url = API + "?" + urllib.parse.urlencode(params)
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "jay-zora-factory-audit/0.1"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            last = e
            if attempt + 1 == retries:
                raise
            time.sleep(min(8.0, 0.75 * (2 ** attempt)))
    raise last

def api_page(api_key, role, page, offset, from_block, to_block):
    params = {
        "chainid": CHAIN_ID,
        "module": "logs",
        "action": "getLogs",
        "address": FACTORY,
        "fromBlock": str(from_block),
        "toBlock": str(to_block),
        "topic0": TOPIC0,
        "page": str(page),
        "offset": str(offset),
        "apikey": api_key,
    }
    if role == "caller":
        params["topic1"] = pad_topic(WALLET)
        params["topic0_1_opr"] = "and"
    elif role == "payout":
        params["topic2"] = pad_topic(WALLET)
        params["topic0_2_opr"] = "and"
    else:
        raise ValueError(role)
    return fetch_json(params)

def collect_role(api_key, role, raw_dir, offset, from_block, to_block, sleep_s):
    out = []
    page = 1
    while True:
        payload = api_page(api_key, role, page, offset, from_block, to_block)
        raw_path = raw_dir / f"{role}_page_{page:05d}.json"
        raw_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        status = str(payload.get("status", ""))
        message = str(payload.get("message", ""))
        result = payload.get("result")

        if isinstance(result, str):
            low = result.lower()
            if "no records found" in low:
                break
            raise RuntimeError(f"{role} page {page}: API error status={status} message={message} result={result}")

        if not isinstance(result, list):
            raise RuntimeError(f"{role} page {page}: unexpected result type {type(result).__name__}")

        out.extend(result)
        if len(result) < offset:
            break

        page += 1
        time.sleep(sleep_s)
    return out

def load_catalog(path: pathlib.Path):
    contracts = set()
    rows = 0
    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rows += 1
            c = (row.get("contract") or "").strip().lower()
            if c:
                contracts.add(c)
    return rows, contracts

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api-key", default=os.environ.get("ETHERSCAN_API_KEY", ""))
    ap.add_argument("--catalog", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--from-block", default="0")
    ap.add_argument("--to-block", default="999999999")
    ap.add_argument("--offset", type=int, default=1000)
    ap.add_argument("--sleep", type=float, default=0.36)
    args = ap.parse_args()

    if not args.api_key:
        raise SystemExit("ETHERSCAN_API_KEY is required")
    if args.offset < 1 or args.offset > 1000:
        raise SystemExit("--offset must be 1..1000")

    out_dir = pathlib.Path(args.out_dir)
    raw_dir = out_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)

    caller = collect_role(args.api_key, "caller", raw_dir, args.offset, args.from_block, args.to_block, args.sleep)
    payout = collect_role(args.api_key, "payout", raw_dir, args.offset, args.from_block, args.to_block, args.sleep)

    receipts = {}
    for role, rows in (("caller", caller), ("payout", payout)):
        for log in rows:
            tx = (log.get("transactionHash") or "").lower()
            li = norm_int(log.get("logIndex"))
            if not tx or li is None:
                raise RuntimeError(f"{role}: log missing transactionHash/logIndex")
            key = (tx, li)
            rec = receipts.setdefault(key, {
                "transaction_hash": tx,
                "log_index": li,
                "block_number": norm_int(log.get("blockNumber")),
                "factory_address": (log.get("address") or "").lower(),
                "caller_match": False,
                "payout_match": False,
                "coin": None,
                "topic0": None,
                "topic1": None,
                "topic2": None,
                "topic3": None,
            })
            rec[f"{role}_match"] = True
            topics = log.get("topics") or []
            if len(topics) < 3:
                raise RuntimeError(f"{role}: malformed topics on {tx}:{li}")
            rec["topic0"] = topics[0].lower() if len(topics) > 0 else None
            rec["topic1"] = topics[1].lower() if len(topics) > 1 else None
            rec["topic2"] = topics[2].lower() if len(topics) > 2 else None
            rec["topic3"] = topics[3].lower() if len(topics) > 3 else None
            coin = decode_coin(log.get("data") or "0x")
            if rec["coin"] not in (None, coin):
                raise RuntimeError(f"coin decode conflict on {tx}:{li}")
            rec["coin"] = coin

    receipt_rows = sorted(receipts.values(), key=lambda r: ((r["block_number"] or 0), r["log_index"], r["transaction_hash"]))
    coins = sorted({r["coin"] for r in receipt_rows if r["coin"]})

    catalog_path = pathlib.Path(args.catalog)
    catalog_rows, catalog = load_catalog(catalog_path)
    match = sorted(set(coins) & catalog)
    delta = sorted(set(coins) - catalog)

    (out_dir / "factory_v4_receipts.jsonl").write_text(
        "".join(json.dumps(r, sort_keys=True) + "\n" for r in receipt_rows),
        encoding="utf-8",
    )
    (out_dir / "factory_v4_coins.json").write_text(json.dumps(coins, indent=2) + "\n", encoding="utf-8")
    (out_dir / "v4_match.json").write_text(json.dumps(match, indent=2) + "\n", encoding="utf-8")
    (out_dir / "v4_delta.json").write_text(json.dumps(delta, indent=2) + "\n", encoding="utf-8")

    summary = {
        "schema": "JAY_ZORA_FACTORY_V4_CONTENT_COMPARE_V0_1",
        "chain_id": 8453,
        "factory": FACTORY.lower(),
        "topic0": TOPIC0,
        "wallet": WALLET.lower(),
        "join_field": "CoinCreatedV4.data[4].coin",
        "word0_as_coin": False,
        "from_block": str(args.from_block),
        "to_block": str(args.to_block),
        "caller_rows_raw": len(caller),
        "payout_rows_raw": len(payout),
        "deduped_receipts": len(receipt_rows),
        "unique_factory_v4_coins": len(coins),
        "catalog_rows": catalog_rows,
        "catalog_unique_contracts": len(catalog),
        "v4_match_count": len(match),
        "v4_delta_count": len(delta),
        "v4_delta_contracts": delta,
        "complete": True,
        "interpretation_boundary": "V4_DELTA is a factory-set difference only; it is not membership in the declared 72 without matching createdCoins.count semantics.",
    }
    (out_dir / "summary.json").write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2, sort_keys=True))

if __name__ == "__main__":
    main()
