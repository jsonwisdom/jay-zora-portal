#!/usr/bin/env python3
import json, sys
from collections import Counter

if len(sys.argv) < 2:
    print("Usage: scripts/summarize_entrypoint_logs.py <logs_json> [more_logs_json...]")
    sys.exit(1)

total=0
addresses=Counter()
topic0=Counter()
topic_count=Counter()
blocks=[]

for p in sys.argv[1:]:
    j=json.load(open(p))
    rows=j.get("result",[])
    total += len(rows)
    for log in rows:
        addresses[log.get("address","").lower()] += 1
        topics=log.get("topics",[])
        topic0[topics[0] if topics else "NO_TOPIC"] += 1
        topic_count[len(topics)] += 1
        if log.get("blockNumber"):
            blocks.append(int(log["blockNumber"],16))

print("ENTRYPOINT_LOG_SUMMARY")
print("files", len(sys.argv)-1)
print("total_logs", total)
print("first_block", min(blocks) if blocks else "")
print("last_block", max(blocks) if blocks else "")

print("\nTOPIC0_COUNTS")
for k,v in topic0.most_common(20):
    print(v, k)

print("\nTOPIC_COUNT_DISTRIBUTION")
for k,v in sorted(topic_count.items()):
    print(k, v)

print("\nADDRESS_COUNTS")
for k,v in addresses.most_common(10):
    print(v, k)
