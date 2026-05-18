import os
import json
import time
import requests
import psycopg2
from psycopg2.extras import execute_values
from openai import OpenAI

DATABASE_URL = os.getenv("DATABASE_URL")
ZORA_API_KEY = os.getenv("ZORA_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
WALLET = os.getenv("WALLET", "0x829adfedbe565f9885a7ea6bc78912acaef055e2")
HANDLE = os.getenv("HANDLE", "jaywisdom.base.eth")

client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

def db():
    return psycopg2.connect(DATABASE_URL)

def ensure_table(conn):
    with conn.cursor() as cur:
        cur.execute("""
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
        """)
    conn.commit()

def zora_url(contract, token_id):
    if contract and token_id:
        return f"https://zora.co/collect/base:{contract}/{token_id}"
    return "https://zora.co/@jaywisdom"

def enrich(title, description, image_uri):
    base_aliases = set()
    for text in [title or "", description or ""]:
        for word in text.replace("-", " ").replace("_", " ").split():
            clean = word.strip(".,:;!?()[]{}\"'").lower()
            if len(clean) > 2:
                base_aliases.add(clean)
    
    themes = {"zora", "base", "jay wisdom", "l2 creator index", "receipts"}
    
    if not client or not image_uri:
        return description or "", sorted(base_aliases), sorted(themes)
    
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
        ai_description = data.get("ai_description") or description or ""
        aliases = set(data.get("query_aliases") or [])
        aliases.update(base_aliases)
        t = set(data.get("themes") or [])
        t.update(themes)
        return ai_description, sorted(aliases), sorted(t)
    except Exception as e:
        print(f"vision enrichment skipped: {e}")
        return description or "", sorted(base_aliases), sorted(themes)

def fetch_zora_items():
    """
    Placeholder-safe crawler.
    Current behavior:
    - If data/manual_artworks.json exists, ingest it.
    - Otherwise seeds one test artifact so the local stack proves end-to-end.
    Next upgrade:
    - Replace this with live Zora API / indexer ingestion.
    """
    manual = "/app/data/manual_artworks.json"
    if os.path.exists(manual):
        with open(manual, "r") as f:
            return json.load(f)
    
    return [{
        "title": "Jay Wisdom Portal Test Relic",
        "description": "Seed artifact for receipt machine, goblin court, Base meme fox, and family OS search testing.",
        "image_uri": "",
        "contract": "0x829adfedbe565f9885a7ea6bc78912acaef055e2",
        "token_id": "seed-001",
        "chain": "base",
        "tx_hash": "0xseed",
        "created_at": None
    }]

def main():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL missing")
    
    print("🦊 crawler started")
    conn = db()
    ensure_table(conn)
    
    items = fetch_zora_items()
    rows = []
    
    for item in items:
        title = item.get("title") or "Untitled Relic"
        description = item.get("description") or ""
        image_uri = item.get("image_uri") or item.get("image") or item.get("image_url") or ""
        contract = item.get("contract") or WALLET
        token_id = str(item.get("token_id") or item.get("id") or int(time.time()))
        chain = item.get("chain") or "base"
        tx_hash = item.get("tx_hash") or ""
        created_at = item.get("created_at")
        
        ai_description, aliases, themes = enrich(title, description, image_uri)
        
        rows.append((
            title, ai_description, image_uri, zora_url(contract, token_id),
            contract, token_id, chain, tx_hash, created_at, themes, aliases
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
    print(f"✅ crawler complete: {len(rows)} artworks upserted")

if __name__ == "__main__":
    main()
