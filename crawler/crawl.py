import os
import json
import time
import psycopg2
from psycopg2.extras import execute_values
from openai import OpenAI

DATABASE_URL = os.getenv("DATABASE_URL")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
WALLET = os.getenv("WALLET", "0x829adfedbe565f9885a7ea6bc78912acaef055e2")
HANDLE = os.getenv("HANDLE", "jaywisdom.base.eth")

client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS artworks (
  id SERIAL PRIMARY KEY,
  title TEXT,
  description TEXT,
  image_uri TEXT,
  zora_url TEXT,
  contract TEXT,
  token_id TEXT,
  chain TEXT,
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  themes TEXT[] DEFAULT ARRAY[]::TEXT[],
  query_aliases TEXT[] DEFAULT ARRAY[]::TEXT[],
  UNIQUE(contract, token_id)
);
"""

def db():
    return psycopg2.connect(DATABASE_URL)

def ensure_table(conn):
    with conn.cursor() as cur:
        cur.execute(CREATE_TABLE_SQL)
    conn.commit()

def build_zora_url(contract, token_id):
    if contract and token_id:
        return f"https://zora.co/collect/base:{contract}/{token_id}"
    return "https://zora.co/@jaywisdom"

def enrich(title, description, image_uri):
    aliases = set()
    for text in [title or "", description or ""]:
        for word in text.replace("-", " ").replace("_", " ").split():
            clean = word.strip(".,:;!?()[]{}\"'").lower()
            if len(clean) > 2:
                aliases.add(clean)

    themes = {"zora", "base", "jay wisdom", "l2 creator index", "receipts"}

    if not client or not image_uri:
        return description or "", sorted(aliases), sorted(themes)

    try:
        prompt = """
Return strict JSON only:
{
  "ai_description": "one concise visual description",
  "query_aliases": ["search phrases people might use"],
  "themes": ["short tags"]
}
Index Jay Wisdom Zora artwork. Include visual concepts, colors, symbols, mood, visible text, receipts, Base, Zora, goblin court, family OS, verification, and memory equity when relevant.
"""
        result = client.responses.create(
            model="gpt-4.1-mini",
            input=[{
                "role": "user",
                "content": [
                    {"type": "input_text", "text": prompt},
                    {"type": "input_text", "text": f"Title: {title}\nDescription: {description}"},
                    {"type": "input_image", "image_url": image_uri}
                ]
            }]
        )
        data = json.loads(result.output_text)
        aliases.update(data.get("query_aliases") or [])
        themes.update(data.get("themes") or [])
        return data.get("ai_description") or description or "", sorted(aliases), sorted(themes)
    except Exception as e:
        print(f"vision enrichment skipped: {e}")
        return description or "", sorted(aliases), sorted(themes)

def fetch_items():
    live = "/app/data/live_zora_items.json"
    manual = "/app/data/manual_artworks.json"

    for path in [live, manual]:
        if os.path.exists(path):
            print(f"loading items from {path}")
            with open(path, "r") as f:
                data = json.load(f)
            if isinstance(data, dict):
                data = data.get("items") or data.get("results") or data.get("data") or []
            return data

    return [{
        "title": "Jay Wisdom Portal Test Relic",
        "description": "Seed artifact for receipt machine, goblin court, Base meme fox, and family OS search testing.",
        "image_uri": "",
        "contract": WALLET,
        "token_id": "seed-001",
        "chain": "base",
        "tx_hash": "0xseed",
        "created_at": None
    }]

def main():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL missing")

    print("crawler started")
    conn = db()
    ensure_table(conn)

    rows = []
    for item in fetch_items():
        title = item.get("title") or "Untitled Relic"
        description = item.get("description") or ""
        image_uri = item.get("image_uri") or item.get("image") or item.get("image_url") or ""
        contract = item.get("contract") or WALLET
        token_id = str(item.get("token_id") or item.get("id") or int(time.time()))
        chain = item.get("chain") or "base"
        tx_hash = item.get("tx_hash") or ""
        created_at = item.get("created_at")

        ai_description, query_aliases, themes = enrich(title, description, image_uri)

        rows.append((
            title, ai_description, image_uri, build_zora_url(contract, token_id),
            contract, token_id, chain, tx_hash, created_at, themes, query_aliases
        ))

    with conn.cursor() as cur:
        execute_values(cur, """
            INSERT INTO artworks (
              title, description, image_uri, zora_url, contract, token_id,
              chain, tx_hash, created_at, themes, query_aliases
            ) VALUES %s
            ON CONFLICT (contract, token_id) DO UPDATE SET
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              image_uri = EXCLUDED.image_uri,
              zora_url = EXCLUDED.zora_url,
              chain = EXCLUDED.chain,
              tx_hash = EXCLUDED.tx_hash,
              themes = EXCLUDED.themes,
              query_aliases = EXCLUDED.query_aliases;
        """, rows)

    conn.commit()
    conn.close()
    print(f"crawler complete: {len(rows)} artworks upserted")

if __name__ == "__main__":
    main()
