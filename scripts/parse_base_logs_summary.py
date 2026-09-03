#!/usr/bin/env python3
import json, sys

if len(sys.argv) != 2:
    print("Usage: scripts/parse_base_logs_summary.py <logs_json>")
    sys.exit(1)

p = sys.argv[1]
j = json.load(open(p))
rows = j.get("result", [])

print("result_type|block_number|transaction_hash|contract_address|topic0|topic_count")
for log in rows:
    print("|".join([
        "RAW_LOG",
        str(int(log["blockNumber"], 16)),
        log.get("transactionHash",""),
        log.get("address",""),
        log.get("topics",[""])[0],
        str(len(log.get("topics",[])))
    ]))
