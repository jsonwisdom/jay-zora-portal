#!/usr/bin/env python3
import json, sys

if len(sys.argv) != 2:
    print("Usage: scripts/decode_coincreated_v4_mapped.py <logs_json>")
    sys.exit(1)

def addr_from_word(w):
    return "0x" + w[-40:].lower()

def topic_addr(topic):
    return addr_from_word(topic[2:] if topic.startswith("0x") else topic)

def words(data):
    h = data[2:] if data.startswith("0x") else data
    return [h[i:i+64] for i in range(0, len(h), 64)]

p = sys.argv[1]
j = json.load(open(p))
rows = j.get("result", [])

print("result_type|block_number|tx_hash|factory|version_topic|topic1_addr|topic2_addr|topic3_addr|asset_addr|pool_key_hash|word_count")
for log in rows:
    ws = words(log.get("data","0x"))
    pool_key_hash = ""
    if len(ws) > 10:
        pool_key_hash = "0x" + ws[9][-24:] + ws[10]
    topics = log.get("topics", [])
    print("|".join([
        "COIN_CREATED_V4_MAPPED",
        str(int(log.get("blockNumber","0x0"), 16)),
        log.get("transactionHash",""),
        log.get("address","").lower(),
        topics[0] if len(topics) else "",
        topic_addr(topics[1]) if len(topics) > 1 else "",
        topic_addr(topics[2]) if len(topics) > 2 else "",
        topic_addr(topics[3]) if len(topics) > 3 else "",
        addr_from_word(ws[0]) if ws else "",
        pool_key_hash,
        str(len(ws))
    ]))
