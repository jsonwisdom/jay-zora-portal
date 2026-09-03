#!/usr/bin/env python3
import json, sys

if len(sys.argv) != 2:
    print("Usage: scripts/decode_coincreated_v4_logs.py <logs_json>")
    sys.exit(1)

def topic_addr(topic):
    if not topic or len(topic) < 42:
        return ""
    return "0x" + topic[-40:].lower()

def word(data, idx):
    h = data[2:] if data.startswith("0x") else data
    return h[idx*64:(idx+1)*64]

p = sys.argv[1]
j = json.load(open(p))
rows = j.get("result", [])

print("result_type|block_number|transaction_hash|factory_address|version_topic|topic1_addr|topic2_addr|topic3_addr|data_word0|data_word1|data_word2")
for log in rows:
    topics = log.get("topics", [])
    data = log.get("data", "0x")
    print("|".join([
        "COIN_CREATED_V4_RAW_DECODE",
        str(int(log.get("blockNumber", "0x0"), 16)),
        log.get("transactionHash", ""),
        log.get("address", "").lower(),
        topics[0] if len(topics) > 0 else "",
        topic_addr(topics[1]) if len(topics) > 1 else "",
        topic_addr(topics[2]) if len(topics) > 2 else "",
        topic_addr(topics[3]) if len(topics) > 3 else "",
        "0x" + word(data, 0),
        "0x" + word(data, 1),
        "0x" + word(data, 2),
    ]))
